import {
  GenerateCharacterInput,
  PlayerState,
  UserCharacterRow,
} from '../types/game';
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

      const genRes = await fetch(`${this.baseUrl}/characters/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: player.username,
          displayName: player.displayName,
          role: player.role,
          skinTone: player.skinTone,
          jacketColor: player.jacketColor,
          accentColor: player.accentColor,
          headgear: player.headgear,
        }),
      });

      if (genRes.ok) {
        const genData = (await genRes.json()) as {
          player: { id: string; reputation: number };
          character: UserCharacterRow;
          wallet: { balance_tzs: number };
          allCharacters: UserCharacterRow[];
        };
        player.id = genData.player.id;
        player.reputation = genData.player.reputation;
        player.moneyTZS = genData.wallet.balance_tzs;
        this.clientDb.replaceUserCharacters(genData.allCharacters);
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

  public async generateCharacter(
    input: GenerateCharacterInput,
    player: PlayerState
  ): Promise<UserCharacterRow> {
    const localChar = this.clientDb.upsertUserCharacter(
      input,
      player.x,
      player.y
    );

    try {
      const res = await fetch(`${this.baseUrl}/characters/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          player: { id: string; reputation: number };
          character: UserCharacterRow;
          wallet: { balance_tzs: number };
          allCharacters: UserCharacterRow[];
        };
        player.id = data.player.id;
        player.moneyTZS = data.wallet.balance_tzs;
        this.clientDb.replaceUserCharacters(data.allCharacters);
        this.clientDb.backendOnline = true;
        return data.character;
      }
    } catch {
      this.clientDb.backendOnline = false;
      this.clientDb.enqueueSyncEvent('character_update', { ...input });
    }

    return localChar;
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
          clientSqliteVersion: 2,
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
        characters?: UserCharacterRow[];
      };

      this.clientDb.markEventsSynced(pending.map((p) => p.event_id));
      this.clientDb.backendOnline = true;
      player.moneyTZS = data.wallet.balance_tzs;
      if (data.characters) {
        this.clientDb.replaceUserCharacters(data.characters);
      }
      this.clientDb.setMeta('balance_tzs', String(player.moneyTZS));
      return data.syncedCount;
    } catch {
      this.clientDb.backendOnline = false;
      return 0;
    }
  }
}
