import { describe, expect, test } from 'bun:test';
import {
  createActiveMission,
  tickActiveMission,
  updateRealUserCharacters,
} from '../src/engine/aiAndMissions';
import {
  resolveCircleAABB,
  toggleEnterExitVehicle,
  updateDrivenVehicle,
} from '../src/engine/physics';
import { ClientSqliteDB } from '../src/sqlite/clientSqlite';
import { PlayerState } from '../src/types/game';

describe('Kili Streets Client SQLite & Real User Character Generator', () => {
  test('hydrates ClientSqliteDB with English world data and generates new real user characters in SQLite', () => {
    const db = new ClientSqliteDB();
    const stats = db.getStats();

    expect(stats.tables.find((t) => t.tableName === 'zones')?.rowCount).toBe(5);
    expect(stats.tables.find((t) => t.tableName === 'buildings')?.rowCount).toBe(12);
    expect(stats.tables.find((t) => t.tableName === 'vehicles')?.rowCount).toBe(6);
    expect(stats.tables.find((t) => t.tableName === 'missions')?.rowCount).toBe(4);
    expect(
      stats.tables.find((t) => t.tableName === 'user_characters')?.rowCount
    ).toBe(6);

    const newChar = db.upsertUserCharacter({
      username: 'brian_moshi',
      displayName: 'Brian Kimaro',
      role: 'Software Engineer',
      skinTone: '#4A2C18',
      jacketColor: '#1B8A5A',
      accentColor: '#F4B41A',
      headgear: 'helmet',
    });

    expect(newChar.username).toBe('brian_moshi');
    expect(db.selectAllUserCharacters().length).toBe(7);
  });

  test('handles vehicle enter/exit, real user character movement, and mission TZS payout', () => {
    const db = new ClientSqliteDB();
    const vehicles = db.selectAllVehicles();
    const roads = db.selectAllRoads();
    const buildings = db.selectAllBuildings();
    const missions = db.selectAllMissions();
    const characters = db.selectAllUserCharacters();

    const boda = vehicles[0];
    const player: PlayerState = {
      id: 'plr_cleven12',
      username: 'cleven12',
      displayName: 'Cleven Godson',
      role: 'Software Engineer',
      skinTone: '#4A2C18',
      jacketColor: '#1D63B8',
      accentColor: '#F4B41A',
      headgear: 'cap',
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

    updateRealUserCharacters(characters, player.username, player, 0.1);

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

    const mangi = buildings.find((b) => b.id === 'duka-la-mangi')!;
    const col = resolveCircleAABB(mangi.x + 2, mangi.y + 20, 14, mangi);
    expect(col.collided).toBe(true);

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
