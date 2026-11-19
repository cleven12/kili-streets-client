import { describe, expect, test } from 'bun:test';
import {
  createActiveMission,
  tickActiveMission,
} from '../src/engine/aiAndMissions';
import {
  resolveCircleAABB,
  toggleEnterExitVehicle,
  updateDrivenVehicle,
} from '../src/engine/physics';
import { ClientSqliteDB } from '../src/sqlite/clientSqlite';
import { PlayerState } from '../src/types/game';

describe('Kili Streets Client SQLite & 2.5D Engine', () => {
  test('hydrates ClientSqliteDB with Ushirika wa Neema & KCMC tables and tracks sync queue', () => {
    const db = new ClientSqliteDB();
    const stats = db.getStats();

    expect(stats.tables.find((t) => t.tableName === 'zones')?.rowCount).toBe(5);
    expect(stats.tables.find((t) => t.tableName === 'buildings')?.rowCount).toBe(12);
    expect(stats.tables.find((t) => t.tableName === 'vehicles')?.rowCount).toBe(6);
    expect(stats.tables.find((t) => t.tableName === 'missions')?.rowCount).toBe(4);

    const ev = db.enqueueSyncEvent('mission_complete', {
      missionId: 'mission-kcmc-patient',
      rewardTzs: 3000,
    });
    expect(db.getPendingSyncEvents().length).toBe(1);

    db.markEventsSynced([ev.event_id]);
    expect(db.getPendingSyncEvents().length).toBe(0);
  });

  test('handles vehicle enter/exit, fuel consumption, and mission TZS payout', () => {
    const db = new ClientSqliteDB();
    const vehicles = db.selectAllVehicles();
    const roads = db.selectAllRoads();
    const buildings = db.selectAllBuildings();
    const missions = db.selectAllMissions();

    const boda = vehicles[0];
    const player: PlayerState = {
      id: 'plr_test',
      username: 'Cleven',
      x: boda.x + 12,
      y: boda.y,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 13,
      health: 100,
      stamina: 100,
      reputation: 10,
      moneyTZS: 5000,
      inVehicleId: null,
      walkCycle: 0,
    };

    const enterRes = toggleEnterExitVehicle(player, vehicles);
    expect(enterRes.action).toBe('entered');
    expect(player.inVehicleId).toBe(boda.id);

    updateDrivenVehicle(
      boda,
      {
        moveX: 0.2,
        moveY: 0,
        gas: true,
        brake: false,
        hornPressed: false,
        interactJustPressed: false,
        missionCycleJustPressed: false,
      },
      roads,
      buildings,
      [],
      [],
      0.1
    );
    expect(boda.speed).toBeGreaterThan(0);
    expect(boda.fuel_level).toBeLessThan(100);

    // Building collision check
    const mangi = buildings.find((b) => b.id === 'duka-la-mangi')!;
    const col = resolveCircleAABB(mangi.x + 2, mangi.y + 20, 14, mangi);
    expect(col.collided).toBe(true);

    // Mission completion check
    const active = createActiveMission(missions, 0);
    player.x = active.mission.pickup_x;
    player.y = active.mission.pickup_y;
    const t1 = tickActiveMission(active, player, 0.016);
    expect(t1.status).toBe('picked_up');

    player.x = active.mission.dropoff_x;
    player.y = active.mission.dropoff_y;
    const t2 = tickActiveMission(active, player, 0.016);
    expect(t2.status).toBe('completed');
    expect(player.moneyTZS).toBe(8000);
  });
});
