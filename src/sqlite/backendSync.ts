import { PlayerState } from '../types/game';
import { ClientSqliteDB } from './clientSqlite';

export class BackendSyncConnector {
  private baseUrl: string;

  constructor(private clientDb: ClientSqliteDB) {
    const host =
      typeof window !== 'undefined' && window.location.hostname
        ? window.location.hostname
        : 'localhost';
    this.baseUrl = `http://${host}:4000/api/v1`;
  }

  public async bootstrapFromBackend(player: PlayerState): Promise<boolean> {
    try {
      const bootRes = await fetch(`${this.baseUrl}/world/bootstrap`);
      if (!bootRes.ok) throw new Error('Bootstrap HTTP error');
      const snapshot = await bootRes.json();
      this.clientDb.hydrateFromSeed(snapshot);

      const authRes = await fetch(`${this.baseUrl}/players/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: player.username }),
      });

      if (authRes.ok) {
        const authData = (await authRes.json()) as {
          player: { id: string; reputation: number };
          wallet: { balance_tzs: number };
        };
        player.id = authData.player.id;
        player.reputation = authData.player.reputation;
        player.moneyTZS = authData.wallet.balance_tzs;
        this.clientDb.setMeta('player_id', player.id);
        this.clientDb.setMeta('balance_tzs', String(player.moneyTZS));
      }

      this.clientDb.backendOnline = true;
      this.clientDb.lastSyncIso = new Date().toISOString();
      return true;
    } catch {
      this.clientDb.backendOnline = false;
      const savedBalance = this.clientDb.getMeta('balance_tzs');
      if (savedBalance) {
        player.moneyTZS = Number(savedBalance) || player.moneyTZS;
      }
      return false;
    }
  }

  public async flushSyncQueue(player: PlayerState): Promise<number> {
    const pending = this.clientDb.getPendingSyncEvents();
    if (pending.length === 0) return 0;

    try {
      const res = await fetch(`${this.baseUrl}/sync/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          clientSqliteVersion: 1,
          events: pending.map((row) => ({
            eventId: row.event_id,
            eventType: row.event_type,
            timestamp: row.timestamp,
            payload: JSON.parse(row.payload_json),
          })),
        }),
      });

      if (!res.ok) throw new Error('Batch sync failed');
      const data = (await res.json()) as {
        syncedCount: number;
        wallet: { balance_tzs: number };
      };

      this.clientDb.markEventsSynced(pending.map((p) => p.event_id));
      this.clientDb.backendOnline = true;
      player.moneyTZS = data.wallet.balance_tzs;
      this.clientDb.setMeta('balance_tzs', String(player.moneyTZS));
      return data.syncedCount;
    } catch {
      this.clientDb.backendOnline = false;
      return 0;
    }
  }
}
