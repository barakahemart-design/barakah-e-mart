# Security Specification & Assertions

This document details the security design, invariants, and "Dirty Dozen" toxic payloads engineered to test the limits of our Firestore Security policies.

## 1. Core Data Invariants

1. **Vault Identity Safety**: A passcode sync backup cannot be overwritten or retrieved unless the client is authenticated as the user who owns that email (`request.auth.token.email == linked_email`), or passes direct verified ownership validations.
2. **Resource Boundary Checks**: Products, Customers, Expenses, and Transactions cannot be created unless the `user_id` field strictly matches the caller's verified Firebase Auth UID (`request.auth.uid`).
3. **Idempotent Immutability**: Critical transaction IDs (`id`), product codes (`sku`), and owner tags (`user_id`, `owner_id`) cannot be tampered with or modified post-creation.
4. **Denial of Wallet Defense**: Any string or array field stored must respect maximum length boundaries (e.g., name string <= 128 characters, list sizes <= 1000 items) to prevent memory bloating and denial-of-service/wallet attacks.

---

## 2. The "Dirty Dozen" Toxic Payloads

Below are the 12 malicious payloads designed to test and break our rulesets, and which MUST return `PERMISSION_DENIED`.

1. **P1: Identity Spoofing on Create**
   - Attempting to write a product document where `user_id` is set to "someone_else_uid".
2. **P2: Privilege Escalation**
   - Attempting to set an `isAdmin` or role flag to `true` on the user profile creation.
3. **P3: Orphaned Data Hijacking**
   - Writing a transaction document with a missing or blank `user_id`.
4. **P4: Immortal Field Mutation**
   - Overwriting an existing transaction document's `created_at` or `user_id` fields.
5. **P5: Rogue Backup Mutation**
   - A guest user seeking to overwrite/update the `passcode_syncs` backup doc belonging to `barakahemart@gmail.com`.
6. **P6: Denial-of-Wallet String Bloat**
   - Writing a product with a 2MB string for `name` to cause cloud storage/read cost inflation.
7. **P7: Array Over-Sizing Attack**
   - Injecting an array of 50,000 sub-elements in a backup payload.
8. **P8: ID Poisoning Attack**
   - Creating a document with a path ID injection like `../poison_doc/junk`.
9. **P9: State Shortcutting / Backdating**
   - Simulating an update to a transaction with a fake, future `updated_at` timestamp from the client device instead of the mandatory server timeline (`request.time`).
10. **P10: Untested Read Scraping**
    - Executing a blanket query list command on the entire `/products` collecton without filtering by `user_id == request.auth.uid`.
11. **P11: Guest Document Erasure**
    - An unauthenticated user attempting to perform `delete` on any customer directory profiles.
12. **P12: Cross-Tenant PII Retrieval**
    - Querying the private contact profiles belonging to `barakahemart@gmail.com` from a guest account.

---

## 3. Test Verification Rules

We test all of these specifications using robust Firestore node integration tests. The actual `firestore.rules` file enforces these boundaries at the network layer.
