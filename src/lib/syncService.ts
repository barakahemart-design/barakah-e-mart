// Multi-device real-time sync service for Barakah Mart POS & Admin
import { getActiveStoreEmail } from './firestoreService';

export interface SyncChangeEvent {
  type: 'upsert' | 'delete';
  table: string;
  id: string;
  data?: any;
  storeEmail?: string;
  timestamp: number;
}

export type SyncStatus = 'connecting' | 'connected' | 'reconciling' | 'offline' | 'error';

type ChangeCallback = (event: SyncChangeEvent) => void;
type StatusCallback = (status: SyncStatus) => void;

class RealtimeSyncManager {
  private eventSource: EventSource | null = null;
  private changeListeners = new Set<ChangeCallback>();
  private statusListeners = new Set<StatusCallback>();
  private pollInterval: any = null;
  private lastSyncTime: number = 0;
  private isRunning = false;
  private currentEmail: string = '';
  private currentUid: string = '';
  private reconnectTimeout: any = null;
  private status: SyncStatus = 'offline';

  public addChangeListener(cb: ChangeCallback): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  public addStatusListener(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  private setStatus(newStatus: SyncStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach(cb => {
        try { cb(newStatus); } catch (_) {}
      });
    }
  }

  public start(email: string, uid: string) {
    const cleanEmail = (email || getActiveStoreEmail()).trim().toLowerCase();
    const cleanUid = uid || cleanEmail;

    if (this.isRunning && this.currentEmail === cleanEmail && this.currentUid === cleanUid) {
      return;
    }

    this.stop();
    this.isRunning = true;
    this.currentEmail = cleanEmail;
    this.currentUid = cleanUid;
    this.lastSyncTime = Date.now() - 5000; // Look back 5s initially

    this.setStatus('connecting');
    this.connectSSE();
    this.startPolling();

    // Trigger immediate poll
    this.pollChanges();
  }

  public stop() {
    this.isRunning = false;
    if (this.eventSource) {
      try { this.eventSource.close(); } catch (_) {}
      this.eventSource = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.setStatus('offline');
  }

  private connectSSE() {
    if (!this.isRunning) return;

    if (this.eventSource) {
      try { this.eventSource.close(); } catch (_) {}
      this.eventSource = null;
    }

    try {
      const url = `/api/sync/stream?email=${encodeURIComponent(this.currentEmail)}&uid=${encodeURIComponent(this.currentUid)}`;
      const es = new EventSource(url);
      this.eventSource = es;

      es.onopen = () => {
        if (!this.isRunning) return;
        this.setStatus('connected');
      };

      es.onmessage = (e) => {
        if (!this.isRunning) return;
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && (parsed.type === 'upsert' || parsed.type === 'delete')) {
            if (parsed.timestamp && parsed.timestamp > this.lastSyncTime) {
              this.lastSyncTime = parsed.timestamp;
            }
            this.notifyListeners(parsed);
          } else if (parsed.type === 'connected') {
            this.setStatus('connected');
          }
        } catch (_) {}
      };

      es.onerror = () => {
        if (!this.isRunning) return;
        try { es.close(); } catch (_) {}
        this.eventSource = null;
        // Reconnect after 3 seconds
        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.isRunning) {
              this.connectSSE();
            }
          }, 3000);
        }
      };
    } catch (e) {
      console.warn('[SyncManager] SSE initialize warning:', e);
    }
  }

  private startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    // Lightweight polling every 2.5 seconds to guarantee 100% sync consistency across any network/device
    this.pollInterval = setInterval(() => {
      if (this.isRunning) {
        this.pollChanges();
      }
    }, 2500);

    // Also poll immediately when window comes into focus or device goes online
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleWindowFocus);
      window.addEventListener('online', this.handleWindowFocus);
    }
  }

  private handleWindowFocus = () => {
    if (this.isRunning) {
      this.pollChanges();
    }
  };

  public async pollChanges() {
    if (!this.isRunning || !this.currentEmail) return;

    try {
      const url = `/api/sync/poll?since=${this.lastSyncTime}&email=${encodeURIComponent(this.currentEmail)}&uid=${encodeURIComponent(this.currentUid)}`;
      const res = await fetch(url, {
        headers: {
          'x-user-email': this.currentEmail,
          'x-user-uid': this.currentUid
        }
      });

      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.changes) && json.changes.length > 0) {
          json.changes.forEach((change: any) => {
            if (change.timestamp && change.timestamp > this.lastSyncTime) {
              this.lastSyncTime = change.timestamp;
            }
            this.notifyListeners({
              type: change.isDelete ? 'delete' : 'upsert',
              table: change.table,
              id: change.docId || change.id,
              data: change.data,
              storeEmail: change.storeEmail,
              timestamp: change.timestamp || Date.now()
            });
          });
        }
        if (json.serverTime && json.serverTime > this.lastSyncTime) {
          this.lastSyncTime = json.serverTime;
        }
        this.setStatus('connected');
      }
    } catch (err) {
      // Silently retry on next tick
    }
  }

  private notifyListeners(event: SyncChangeEvent) {
    this.changeListeners.forEach(cb => {
      try {
        cb(event);
      } catch (e) {
        console.error('[SyncManager] Error in change listener:', e);
      }
    });
  }

  // Force trigger full cloud fetch
  public async fetchFullState(email?: string): Promise<any | null> {
    const targetEmail = (email || this.currentEmail || getActiveStoreEmail()).trim().toLowerCase();
    if (!targetEmail) return null;
    try {
      const res = await fetch(`/api/sync/full?email=${encodeURIComponent(targetEmail)}`, {
        headers: {
          'x-user-email': targetEmail,
          'x-user-uid': this.currentUid || targetEmail
        }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[SyncManager] fetchFullState warning:', e);
    }
    return null;
  }
}

export const syncManager = new RealtimeSyncManager();
