import {
  ActiveMissionState,
  MissionRow,
  PlayerState,
  UserCharacterRow,
  Vector2D,
  VehicleRow,
} from '../types/game';

export const AI_DALADALA_ROUTE: Vector2D[] = [
  { x: 220, y: 445 },
  { x: 2180, y: 445 },
  { x: 2180, y: 495 },
  { x: 220, y: 495 },
];

export const AI_USHIRIKA_ROUTE: Vector2D[] = [
  { x: 1200, y: 580 },
  { x: 1200, y: 1875 },
  { x: 2015, y: 1875 },
  { x: 2015, y: 1205 },
  { x: 1200, y: 1205 },
];

/**
 * Updates all real user characters in the world (except the currently active player,
 * whose position is driven directly by keyboard/touch controls).
 */
export function updateRealUserCharacters(
  characters: UserCharacterRow[],
  activeUsername: string,
  player: PlayerState,
  dt: number
): void {
  for (const ch of characters) {
    if (ch.username === activeUsername) {
      ch.x = player.x;
      ch.y = player.y;
      ch.angle = player.angle;
      ch.in_vehicle_id = player.inVehicleId;
      continue;
    }

    let waypoints: Vector2D[] = [];
    try {
      waypoints = JSON.parse(ch.waypoints_json);
    } catch {
      continue;
    }
    if (waypoints.length === 0) continue;

    const wpIndex = (ch.currentWaypoint ?? 0) % waypoints.length;
    const target = waypoints[wpIndex];
    const dx = target.x - ch.x;
    const dy = target.y - ch.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 10) {
      ch.currentWaypoint = (wpIndex + 1) % waypoints.length;
    } else {
      ch.angle = Math.atan2(dy, dx);
      ch.x += Math.cos(ch.angle) * ch.speed * dt;
      ch.y += Math.sin(ch.angle) * ch.speed * dt;
      ch.walkCycle = (ch.walkCycle ?? 0) + dt * 9;
    }
  }
}

export function updateAIVehicles(
  vehicles: VehicleRow[],
  playerX: number,
  playerY: number,
  dt: number
): void {
  for (const v of vehicles) {
    if (!v.is_ai) continue;

    const loop = v.kind === 'daladala' ? AI_DALADALA_ROUTE : AI_USHIRIKA_ROUTE;
    const idx = (v.aiTargetIndex ?? 0) % loop.length;
    const target = loop[idx];

    const dx = target.x - v.x;
    const dy = target.y - v.y;
    const distToTarget = Math.hypot(dx, dy);
    const distToPlayer = Math.hypot(playerX - v.x, playerY - v.y);

    const desiredSpeed =
      distToPlayer < 78 ? 22 : v.kind === 'daladala' ? 155 : 125;
    v.speed += (desiredSpeed - v.speed) * Math.min(1, dt * 4);

    if (distToTarget < 36) {
      v.aiTargetIndex = (idx + 1) % loop.length;
    } else {
      const targetAngle = Math.atan2(dy, dx);
      let diff = targetAngle - v.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.angle += diff * Math.min(1, dt * 4.5);
    }

    v.vx = Math.cos(v.angle) * v.speed;
    v.vy = Math.sin(v.angle) * v.speed;
    v.x += v.vx * dt;
    v.y += v.vy * dt;
  }
}

export function createActiveMission(
  missions: MissionRow[],
  index: number
): ActiveMissionState {
  const mission = missions[index % missions.length];
  return {
    mission,
    stage: 'pickup',
    timeLeftSeconds: mission.time_limit_seconds,
  };
}

export function tickActiveMission(
  state: ActiveMissionState,
  player: PlayerState,
  dt: number
): {
  status: 'ongoing' | 'picked_up' | 'completed' | 'expired';
  target: Vector2D;
  distanceMeters: number;
} {
  const target: Vector2D =
    state.stage === 'pickup'
      ? { x: state.mission.pickup_x, y: state.mission.pickup_y }
      : { x: state.mission.dropoff_x, y: state.mission.dropoff_y };

  const distUnits = Math.hypot(player.x - target.x, player.y - target.y);
  const distanceMeters = Math.round(distUnits * 0.45);

  if (state.stage === 'dropoff') {
    state.timeLeftSeconds = Math.max(0, state.timeLeftSeconds - dt);
    if (state.timeLeftSeconds <= 0) {
      state.stage = 'pickup';
      state.timeLeftSeconds = state.mission.time_limit_seconds;
      return {
        status: 'expired',
        target: { x: state.mission.pickup_x, y: state.mission.pickup_y },
        distanceMeters,
      };
    }
  }

  if (distUnits < 62) {
    if (state.stage === 'pickup') {
      state.stage = 'dropoff';
      state.timeLeftSeconds = state.mission.time_limit_seconds;
      return {
        status: 'picked_up',
        target: { x: state.mission.dropoff_x, y: state.mission.dropoff_y },
        distanceMeters: 0,
      };
    } else {
      player.moneyTZS += state.mission.reward_tzs;
      player.reputation += 5;
      return {
        status: 'completed',
        target,
        distanceMeters: 0,
      };
    }
  }

  return { status: 'ongoing', target, distanceMeters };
}
