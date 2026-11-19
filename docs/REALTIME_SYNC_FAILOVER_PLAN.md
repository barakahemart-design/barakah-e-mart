# BARAKAH Realtime Sync Failover — Implementation Plan

## Goal

Keep the existing Firebase Authentication and Firestore as the primary system for now, while adding an independent, durable realtime path so devices can exchange and retain business changes when Firestore is unavailable or its quota is exhausted.

This is a failover path, not a replacement of Firestore. No production data should be migrated, overwritten, or deleted as part of the first release.

## Repository audit (2026-11-14)

- The web POS is a Vite/React application.
- `src/lib/firestoreService.ts` writes business records directly to Firestore and subscribes to Firestore snapshots.
- `src/lib/firebase.ts` currently configures Firestore with `memoryLocalCache()`; this is not durable across reloads.
- `src/lib/mockDB.ts` uses browser `localStorage` for local copies. That is device-local only and is not a cross-device sync service.
- `src/lib/syncService.ts` expects `/api/sync/stream` and `/api/sync/poll`.
- `server.ts` implements those endpoints using in-memory SSE clients and an in-memory change history. That history is lost on process restart and is not shared between server instances.
- The checked-in `vercel.json` builds and serves a static Vite SPA with an index rewrite. It does not configure the Express `server.ts` as a deployed API/server. Therefore the current browser SSE client cannot be assumed to reach the Express endpoints in the production Vercel deployment.
- The repository contains a Supabase dependency and a Supabase project URL/anon key in `.env.example`, plus a Flutter reference implementation/schema. However, the current web POS data path remains Firestore, and the Flutter service source shown here currently calls a Cloud Run REST proxy. The actual Supabase project schema, ownership, RLS, and credentials must be verified before using it for live business data.

## Required architecture

1. **Local durable outbox in each client**
   - Use IndexedDB (not localStorage) for queued business mutations.
   - Persist a mutation before showing it as safely saved.
   - Give each mutation a globally unique operation ID, account/store ID, entity/table, record ID, operation, payload, created time, and retry metadata.
   - Keep explicit states: pending, sending, synced, conflict, failed.
   - Never discard a pending mutation automatically.

2. **Independent cloud write path**
   - Send queued mutations to a separately deployed API/service.
   - Verify Firebase ID tokens server-side. Never trust client-supplied UID/email headers as authentication.
   - Enforce store/account ownership on every operation.
   - Persist each operation durably before acknowledging it.
   - Make writes idempotent by operation ID.
   - Do not put service-role or admin credentials in browser code.

3. **Realtime fan-out**
   - Authenticated devices subscribe to changes for their own store only.
   - The realtime notification is a hint; clients must reconcile against durable stored events/snapshots.
   - Reconnect with a cursor/sequence number so missed events are replayed.
   - Use tombstones for deletes and deterministic conflict rules for simultaneous edits.

4. **Firestore reconciliation**
   - Keep Firestore as the current primary store when healthy.
   - When Firestore returns, replay queued changes with idempotency and compare server versions.
   - Never blindly overwrite newer data with an older queued snapshot.
   - Record reconciliation outcomes and surface conflicts for review.

5. **Backup and recovery**
   - Keep independent scheduled backups of the durable failover database.
   - Test restores; a successful backup job alone is not proof that restore works.

## Safe rollout phases

### Phase 0 — Audit (current)
Confirm the actual Vercel deployment model, Firebase auth flow, current account/store identity rules, and whether the existing Supabase project is configured and owned by BARAKAH.

### Phase 1 — Local durable outbox
Implement and test IndexedDB queueing in the web POS without changing the current Firestore write path. Verify reload, browser restart, quota errors, and multiple tabs.

### Phase 2 — Independent cloud service
Choose and provision one backend after credentials/ownership are confirmed. Preferred candidate: a small authenticated realtime service with durable event storage (Cloudflare Worker + Durable Object + D1, or a correctly secured Supabase Realtime/Postgres integration). Do not expose business records on public channels.

### Phase 3 — Shadow sync
Mirror a limited test account's changes to the new backend while Firestore remains authoritative. Compare counts and payload hashes. Do not enable failover writes for production until verified.

### Phase 4 — Controlled failover
Enable fallback only for recognized Firestore quota/unavailable errors. Show clear UI state: Saved on this device, Waiting to sync, Synced to cloud, Conflict needs review. Keep a manual export/recovery path.

### Phase 5 — Mobile client and backup
Bring the actual mobile client onto the same authenticated event protocol, then configure independent backups and restore tests.

## Acceptance criteria

- A sale/customer mutation is persisted locally before success is shown.
- If Firestore quota is exhausted, the user sees an explicit pending/failover state, not a false “synced” status.
- A second authorized device receives the change through the independent service while Firestore is unavailable.
- Reloading/restarting the first device does not lose queued operations.
- Retrying an operation never creates duplicate sales, customers, or stock movements.
- Reconnect/replay recovers missed realtime events.
- A device cannot subscribe to or read another store's data.
- Firestore recovery reconciles without silently overwriting newer data.
- Backup restore is tested before production rollout.

## Safety constraints

- Do not change or delete existing Firestore collections.
- Do not automatically overwrite production data from a backup.
- Do not treat in-memory SSE history or localStorage as durable backup.
- Do not enable cross-device fallback until server authentication, account isolation, idempotency, and replay tests pass.
- Do not claim “zero data loss”; expose pending/synced status and preserve recoverable copies.
