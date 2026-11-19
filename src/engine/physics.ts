import {
  BuildingRow,
  DustParticle,
  InputState,
  PlayerState,
  RoadRow,
  TreeRow,
  VehicleRow,
} from '../types/game';

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 2400;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getSurfaceAtPoint(
  x: number,
  y: number,
  roads: RoadRow[]
): 'tarmac' | 'murram' | 'grass' {
  for (const r of roads) {
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
      return r.surface;
    }
  }
  return 'grass';
}

export function resolveCircleAABB(
  cx: number,
  cy: number,
  radius: number,
  rect: BuildingRow
): { x: number; y: number; collided: boolean } {
  const closestX = clamp(cx, rect.x, rect.x + rect.width);
  const closestY = clamp(cy, rect.y, rect.y + rect.height);
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= radius * radius) {
    return { x: cx, y: cy, collided: false };
  }

  const dist = Math.sqrt(distSq);
  if (dist > 0.0001) {
    const overlap = radius - dist;
    return {
      x: cx + (dx / dist) * overlap,
      y: cy + (dy / dist) * overlap,
      collided: true,
    };
  }

  const leftPen = cx - rect.x;
  const rightPen = rect.x + rect.width - cx;
  const topPen = cy - rect.y;
  const bottomPen = rect.y + rect.height - cy;
  const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);

  if (minPen === leftPen) return { x: rect.x - radius, y: cy, collided: true };
  if (minPen === rightPen)
    return { x: rect.x + rect.width + radius, y: cy, collided: true };
  if (minPen === topPen) return { x: cx, y: rect.y - radius, collided: true };
  return { x: cx, y: rect.y + rect.height + radius, collided: true };
}

export function updatePlayerOnFoot(
  player: PlayerState,
  input: InputState,
  buildings: BuildingRow[],
  trees: TreeRow[],
  dt: number
): void {
  const walkSpeed = 168;
  const len = Math.hypot(input.moveX, input.moveY);
  const normX = len > 1 ? input.moveX / len : input.moveX;
  const normY = len > 1 ? input.moveY / len : input.moveY;

  player.vx = normX * walkSpeed;
  player.vy = normY * walkSpeed;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (Math.hypot(player.vx, player.vy) > 8) {
    player.angle = Math.atan2(player.vy, player.vx);
    player.walkCycle += dt * 10.5;
  }

  player.x = clamp(player.x, player.radius + 10, WORLD_WIDTH - player.radius - 10);
  player.y = clamp(player.y, player.radius + 10, WORLD_HEIGHT - player.radius - 10);

  for (const b of buildings) {
    const res = resolveCircleAABB(player.x, player.y, player.radius, b);
    player.x = res.x;
    player.y = res.y;
  }

  for (const t of trees) {
    const trunkR = t.radius * 0.44;
    const dx = player.x - t.x;
    const dy = player.y - t.y;
    const dist = Math.hypot(dx, dy);
    const minDist = player.radius + trunkR;
    if (dist < minDist && dist > 0.001) {
      const push = minDist - dist;
      player.x += (dx / dist) * push;
      player.y += (dy / dist) * push;
    }
  }
}

export function updateDrivenVehicle(
  vehicle: VehicleRow,
  input: InputState,
  roads: RoadRow[],
  buildings: BuildingRow[],
  trees: TreeRow[],
  dustParticles: DustParticle[],
  dt: number
): void {
  const surface = getSurfaceAtPoint(vehicle.x, vehicle.y, roads);
  const surfaceMaxFactor =
    surface === 'tarmac' ? 1.0 : surface === 'murram' ? 0.92 : 0.72;
  const surfaceGrip =
    surface === 'tarmac'
      ? vehicle.drift_grip
      : surface === 'murram'
      ? vehicle.drift_grip * 0.85
      : vehicle.drift_grip * 0.75;

  const forwardThrottle = input.gas || input.moveY < -0.25;
  const reverseOrBrake = input.brake || input.moveY > 0.35;

  if (forwardThrottle && vehicle.fuel_level > 0) {
    vehicle.speed += vehicle.acceleration * dt;
    vehicle.fuel_level = Math.max(0, vehicle.fuel_level - dt * 0.35);
  } else if (reverseOrBrake) {
    if (vehicle.speed > 20) {
      vehicle.speed -= vehicle.braking * dt;
    } else {
      vehicle.speed -= vehicle.acceleration * 0.65 * dt;
    }
  } else {
    const drag = surface === 'grass' ? 210 : 125;
    if (Math.abs(vehicle.speed) <= drag * dt) {
      vehicle.speed = 0;
    } else {
      vehicle.speed -= Math.sign(vehicle.speed) * drag * dt;
    }
  }

  vehicle.speed = clamp(
    vehicle.speed,
    -vehicle.reverse_speed,
    vehicle.max_speed * surfaceMaxFactor
  );

  const steerInput = clamp(input.moveX, -1, 1);
  vehicle.steering = steerInput;

  if (Math.abs(vehicle.speed) > 8) {
    const speedRatio = clamp(Math.abs(vehicle.speed) / 140, 0.25, 1.0);
    const dirSign = vehicle.speed >= 0 ? 1 : -1;
    vehicle.angle += steerInput * vehicle.turn_speed * speedRatio * dirSign * dt;
  }

  const forwardX = Math.cos(vehicle.angle);
  const forwardY = Math.sin(vehicle.angle);
  const targetVx = forwardX * vehicle.speed;
  const targetVy = forwardY * vehicle.speed;

  const blend = clamp(surfaceGrip * 10 * dt, 0.12, 1);
  vehicle.vx = (vehicle.vx ?? 0) + (targetVx - (vehicle.vx ?? 0)) * blend;
  vehicle.vy = (vehicle.vy ?? 0) + (targetVy - (vehicle.vy ?? 0)) * blend;

  vehicle.x += vehicle.vx * dt;
  vehicle.y += vehicle.vy * dt;

  if (surface !== 'tarmac' && Math.abs(vehicle.speed) > 80 && Math.random() < 0.6) {
    const backX = vehicle.x - forwardX * (vehicle.length * 0.45);
    const backY = vehicle.y - forwardY * (vehicle.length * 0.45);
    dustParticles.push({
      x: backX + (Math.random() - 0.5) * 14,
      y: backY + (Math.random() - 0.5) * 14,
      vx: -vehicle.vx * 0.15 + (Math.random() - 0.5) * 22,
      vy: -vehicle.vy * 0.15 + (Math.random() - 0.5) * 22,
      size: 5 + Math.random() * 7,
      alpha: 0.58,
      color: surface === 'murram' ? '#BA6442' : '#657D4C',
    });
  }

  const colliderRadius = Math.max(vehicle.width, vehicle.length) * 0.42;
  vehicle.x = clamp(vehicle.x, colliderRadius + 8, WORLD_WIDTH - colliderRadius - 8);
  vehicle.y = clamp(vehicle.y, colliderRadius + 8, WORLD_HEIGHT - colliderRadius - 8);

  for (const b of buildings) {
    const res = resolveCircleAABB(vehicle.x, vehicle.y, colliderRadius, b);
    if (res.collided) {
      vehicle.x = res.x;
      vehicle.y = res.y;
      vehicle.speed *= -0.25;
      vehicle.vx *= -0.25;
      vehicle.vy *= -0.25;
    }
  }

  for (const t of trees) {
    const trunkR = t.radius * 0.45;
    const dx = vehicle.x - t.x;
    const dy = vehicle.y - t.y;
    const dist = Math.hypot(dx, dy);
    const minDist = colliderRadius + trunkR;
    if (dist < minDist && dist > 0.001) {
      const overlap = minDist - dist;
      vehicle.x += (dx / dist) * overlap;
      vehicle.y += (dy / dist) * overlap;
      vehicle.speed *= 0.45;
    }
  }
}

export function findNearestVehicle(
  player: PlayerState,
  vehicles: VehicleRow[],
  maxDist = 66
): VehicleRow | null {
  let nearest: VehicleRow | null = null;
  let best = maxDist;
  for (const v of vehicles) {
    const d = Math.hypot(player.x - v.x, player.y - v.y);
    if (d < best) {
      best = d;
      nearest = v;
    }
  }
  return nearest;
}

export function toggleEnterExitVehicle(
  player: PlayerState,
  vehicles: VehicleRow[]
): { action: 'entered' | 'exited' | 'none'; vehicle: VehicleRow | null } {
  if (player.inVehicleId) {
    const current = vehicles.find((v) => v.id === player.inVehicleId) || null;
    player.inVehicleId = null;
    if (current) {
      current.driver_player_id = null;
      const sideAngle = current.angle - Math.PI / 2;
      player.x = current.x + Math.cos(sideAngle) * (current.width * 0.9 + 14);
      player.y = current.y + Math.sin(sideAngle) * (current.width * 0.9 + 14);
      current.speed *= 0.3;
    }
    return { action: 'exited', vehicle: current };
  }

  const candidate = findNearestVehicle(player, vehicles);
  if (candidate) {
    candidate.is_ai = 0;
    candidate.driver_player_id = player.id;
    player.inVehicleId = candidate.id;
    player.x = candidate.x;
    player.y = candidate.y;
    return { action: 'entered', vehicle: candidate };
  }

  return { action: 'none', vehicle: null };
}
