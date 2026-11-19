export interface Vector2D {
  x: number;
  y: number;
}

export type VehicleKind = 'bodaboda' | 'bajaji' | 'daladala';

export interface ZoneRow {
  id: string;
  title: string;
  subtitle: string;
  center_x: number;
  center_y: number;
  radius: number;
  danger_level: number;
  ambient_sound: string;
}

export interface BuildingRow {
  id: string;
  zone_id: string;
  name: string;
  label: string | null;
  category: 'hospital' | 'pharmacy' | 'shop' | 'food' | 'hostel' | 'community' | 'residential';
  x: number;
  y: number;
  width: number;
  height: number;
  roof_color: string;
  wall_color: string;
}

export interface RoadRow {
  id: string;
  name: string;
  surface: 'tarmac' | 'murram';
  orientation: 'horizontal' | 'vertical';
  x: number;
  y: number;
  width: number;
  height: number;
  has_center_line: number;
}

export interface TreeRow {
  id: string;
  kind: 'banana' | 'acacia' | 'coffee';
  x: number;
  y: number;
  radius: number;
}

export interface VehicleRow {
  id: string;
  kind: VehicleKind;
  display_name: string;
  plate_number: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  max_speed: number;
  reverse_speed: number;
  acceleration: number;
  braking: number;
  turn_speed: number;
  drift_grip: number;
  width: number;
  length: number;
  primary_color: string;
  secondary_color: string;
  is_ai: number;
  driver_player_id: string | null;
  fuel_level: number;
  condition_percent: number;
  vx?: number;
  vy?: number;
  steering?: number;
  aiTargetIndex?: number;
}

export interface MissionRow {
  id: string;
  title: string;
  description: string;
  pickup_label: string;
  pickup_x: number;
  pickup_y: number;
  dropoff_label: string;
  dropoff_x: number;
  dropoff_y: number;
  reward_tzs: number;
  time_limit_seconds: number;
  recommended_vehicle: VehicleKind | null;
}

export interface NpcRow {
  id: string;
  name: string;
  role: string;
  shirt_color: string;
  x: number;
  y: number;
  speed: number;
  waypoints_json: string;
  dialogue_sw: string;
  angle?: number;
  currentWaypoint?: number;
}

export interface SyncQueueRow {
  event_id: string;
  event_type: 'player_move' | 'vehicle_move' | 'mission_complete' | 'shop_purchase';
  payload_json: string;
  timestamp: string;
  synced: number;
}

export interface PlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  health: number;
  stamina: number;
  reputation: number;
  moneyTZS: number;
  inVehicleId: string | null;
  walkCycle: number;
}

export interface ActiveMissionState {
  mission: MissionRow;
  stage: 'pickup' | 'dropoff';
  timeLeftSeconds: number;
}

export interface InputState {
  moveX: number;
  moveY: number;
  gas: boolean;
  brake: boolean;
  hornPressed: boolean;
  interactJustPressed: boolean;
  missionCycleJustPressed: boolean;
}

export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

export interface SqliteStats {
  engineMode: 'WASM/Indexed-SQLite-WAL';
  tables: Array<{ tableName: string; rowCount: number }>;
  pendingSyncEvents: number;
  lastSyncIso: string | null;
  backendOnline: boolean;
}
