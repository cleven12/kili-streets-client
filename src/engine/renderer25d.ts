import {
  ActiveMissionState,
  BuildingRow,
  DustParticle,
  NpcRow,
  PlayerState,
  RoadRow,
  TreeRow,
  Vector2D,
  VehicleRow,
} from '../types/game';
import { WORLD_HEIGHT, WORLD_WIDTH } from './physics';

export class WorldRenderer25D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public cameraX = 1125;
  public cameraY = 1580;
  public cameraZoom = 1.02;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D context');
    }
    this.ctx = context;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public render(
    player: PlayerState,
    vehicles: VehicleRow[],
    npcs: NpcRow[],
    roads: RoadRow[],
    buildings: BuildingRow[],
    trees: TreeRow[],
    dustParticles: DustParticle[],
    activeMission: ActiveMissionState,
    activeTarget: Vector2D,
    nearestVehicle: VehicleRow | null,
    isBraking: boolean,
    timeSec: number,
    dt: number
  ): void {
    const ctx = this.ctx;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    const driven = player.inVehicleId
      ? vehicles.find((v) => v.id === player.inVehicleId) || null
      : null;

    const lookAheadX = driven ? (driven.vx ?? 0) * 0.3 : 0;
    const lookAheadY = driven ? (driven.vy ?? 0) * 0.3 : 0;
    const targetX = (driven ? driven.x : player.x) + lookAheadX;
    const targetY = (driven ? driven.y : player.y) + lookAheadY;
    const speedMag = driven ? Math.abs(driven.speed) : 0;
    const desiredZoom = driven
      ? Math.max(0.76, 1.0 - (speedMag / 380) * 0.22)
      : 1.06;

    this.cameraX += (targetX - this.cameraX) * Math.min(1, dt * 7.5);
    this.cameraY += (targetY - this.cameraY) * Math.min(1, dt * 7.5);
    this.cameraZoom += (desiredZoom - this.cameraZoom) * Math.min(1, dt * 4);

    // Highland Kilimanjaro turf base
    ctx.fillStyle = '#183B23';
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(this.cameraZoom, this.cameraZoom);
    ctx.translate(-this.cameraX, -this.cameraY);

    this.drawTerrainAndShambas();
    this.drawRoads(roads);
    this.drawKCMCRoundaboutAndHelipad();
    this.drawMissionBeacon(activeTarget, activeMission.stage, timeSec);
    this.drawDust(dustParticles);
    this.drawNpcs(npcs);
    this.drawVehicles(
      vehicles,
      player.inVehicleId,
      nearestVehicle,
      isBraking,
      timeSec
    );

    if (!player.inVehicleId) {
      this.drawPlayerOnFoot(player);
    }

    this.drawBuildings25D(buildings);
    this.drawTrees25D(trees, timeSec);

    ctx.restore();

    this.drawGPSGuidanceArrow(
      player,
      activeTarget,
      activeMission.stage,
      viewW,
      viewH
    );
    this.drawCircularCompassRadar(
      player,
      vehicles,
      roads,
      activeTarget,
      activeMission.stage
    );
  }

  private drawTerrainAndShambas(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#1E472A';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Cultivated Chagga shamba plots with terraced rows
    for (let x = 90; x < WORLD_WIDTH; x += 340) {
      for (let y = 580; y < WORLD_HEIGHT; y += 340) {
        ctx.fillStyle = '#1A3F25';
        ctx.fillRect(x, y, 230, 230);
        ctx.strokeStyle = 'rgba(46, 125, 50, 0.25)';
        ctx.lineWidth = 2;
        for (let r = 20; r < 220; r += 28) {
          ctx.beginPath();
          ctx.moveTo(x + 12, y + r);
          ctx.lineTo(x + 218, y + r);
          ctx.stroke();
        }
      }
    }

    ctx.strokeStyle = '#102817';
    ctx.lineWidth = 20;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  private drawRoads(roads: RoadRow[]): void {
    const ctx = this.ctx;

    for (const r of roads) {
      if (r.surface === 'tarmac') {
        // Paved KCMC Road with concrete curb & drainage shoulder
        ctx.fillStyle = '#15181C';
        ctx.fillRect(r.x - 7, r.y - 7, r.width + 14, r.height + 14);
        ctx.fillStyle = '#525B66';
        ctx.fillRect(r.x - 3, r.y - 3, r.width + 6, r.height + 6);
        ctx.fillStyle = '#282D35';
        ctx.fillRect(r.x, r.y, r.width, r.height);

        if (r.has_center_line) {
          ctx.save();
          ctx.strokeStyle = '#F4B41A';
          ctx.lineWidth = 3;
          ctx.setLineDash([24, 18]);
          ctx.beginPath();
          if (r.orientation === 'horizontal') {
            const cy = r.y + r.height / 2;
            ctx.moveTo(r.x, cy);
            ctx.lineTo(r.x + r.width, cy);
          } else {
            const cx = r.x + r.width / 2;
            ctx.moveTo(cx, r.y);
            ctx.lineTo(cx, r.y + r.height);
          }
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // Volcanic red-earth laterite murram road (Ushirika wa Neema)
        ctx.fillStyle = '#5E2B18';
        ctx.fillRect(r.x - 7, r.y - 7, r.width + 14, r.height + 14);
        ctx.fillStyle = '#9D4E31';
        ctx.fillRect(r.x, r.y, r.width, r.height);

        // Dual tire ruts
        ctx.strokeStyle = 'rgba(94, 43, 24, 0.5)';
        ctx.lineWidth = 9;
        ctx.beginPath();
        if (r.orientation === 'vertical') {
          ctx.moveTo(r.x + r.width * 0.3, r.y);
          ctx.lineTo(r.x + r.width * 0.3, r.y + r.height);
          ctx.moveTo(r.x + r.width * 0.7, r.y);
          ctx.lineTo(r.x + r.width * 0.7, r.y + r.height);
        } else {
          ctx.moveTo(r.x, r.y + r.height * 0.3);
          ctx.lineTo(r.x + r.width, r.y + r.height * 0.3);
          ctx.moveTo(r.x, r.y + r.height * 0.7);
          ctx.lineTo(r.x + r.width, r.y + r.height * 0.7);
        }
        ctx.stroke();
      }
    }

    // Zebra pedestrian crossing at KCMC Main Gate
    ctx.fillStyle = 'rgba(240, 244, 248, 0.75)';
    for (let zx = 1132; zx < 1268; zx += 20) {
      ctx.fillRect(zx, 370, 11, 32);
    }
  }

  private drawKCMCRoundaboutAndHelipad(): void {
    const ctx = this.ctx;
    const rx = 1200;
    const ry = 470;

    ctx.fillStyle = '#282D35';
    ctx.beginPath();
    ctx.arc(rx, ry, 88, 0, Math.PI * 2);
    ctx.fill();

    // Red-white island curb
    ctx.strokeStyle = '#E03131';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(rx, ry, 36, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#235E35';
    ctx.beginPath();
    ctx.arc(rx, ry, 32, 0, Math.PI * 2);
    ctx.fill();

    // Monument obelisk in center of KCMC roundabout
    ctx.fillStyle = '#F4B41A';
    ctx.beginPath();
    ctx.arc(rx, ry, 8, 0, Math.PI * 2);
    ctx.fill();

    // KCMC Hospital Emergency Helipad (North-West of gate)
    const hx = 605;
    const hy = 120;
    ctx.fillStyle = '#2B313A';
    ctx.beginPath();
    ctx.arc(hx, hy, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F4B41A';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#F4B41A';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', hx, hy);
  }

  private drawMissionBeacon(
    target: Vector2D,
    stage: 'pickup' | 'dropoff',
    timeSec: number
  ): void {
    const ctx = this.ctx;
    const pulse = 1 + Math.sin(timeSec * 5.5) * 0.16;
    const color = stage === 'pickup' ? '#F4B41A' : '#2ECC71';

    ctx.save();
    ctx.translate(target.x, target.y);

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 40 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle =
      stage === 'pickup'
        ? 'rgba(244, 180, 26, 0.25)'
        : 'rgba(46, 204, 113, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(stage === 'pickup' ? '▼ CHUKUA HAPA' : '▼ SHUSHA HAPA', 0, -48);
    ctx.restore();
  }

  private drawDust(particles: DustParticle[]): void {
    const ctx = this.ctx;
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawNpcs(npcs: NpcRow[]): void {
    const ctx = this.ctx;
    for (const npc of npcs) {
      ctx.save();
      ctx.translate(npc.x, npc.y);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.beginPath();
      ctx.arc(2, 3, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.rotate(npc.angle ?? 0);
      ctx.fillStyle = npc.shirt_color;
      ctx.beginPath();
      ctx.roundRect(-7, -10, 14, 20, 6);
      ctx.fill();

      ctx.fillStyle = '#5C3A21';
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Floating villager name tag
      ctx.fillStyle = 'rgba(12, 20, 15, 0.75)';
      ctx.beginPath();
      ctx.roundRect(-34, -24, 68, 13, 3);
      ctx.fill();
      ctx.fillStyle = '#E2ECE6';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(npc.name, 0, -15);

      ctx.restore();
    }
  }

  private drawPlayerOnFoot(player: PlayerState): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(player.x, player.y);

    ctx.strokeStyle = 'rgba(244, 180, 26, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(player.angle);
    const swing = Math.sin(player.walkCycle) * 4.5;
    ctx.fillStyle = '#181D1A';
    ctx.fillRect(swing - 3, -9, 7, 5);
    ctx.fillRect(-swing - 3, 4, 7, 5);

    ctx.fillStyle = '#1D63B8';
    ctx.beginPath();
    ctx.roundRect(-8, -11, 16, 22, 6);
    ctx.fill();

    ctx.fillStyle = '#F4B41A';
    ctx.fillRect(-4, -9, 8, 18);

    ctx.fillStyle = '#4A2C18';
    ctx.beginPath();
    ctx.arc(1, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawVehicles(
    vehicles: VehicleRow[],
    drivenId: string | null,
    nearestVehicle: VehicleRow | null,
    isBraking: boolean,
    timeSec: number
  ): void {
    const ctx = this.ctx;

    for (const v of vehicles) {
      const w = v.width;
      const l = v.length;
      ctx.save();
      ctx.translate(v.x, v.y);

      if (!drivenId && nearestVehicle && nearestVehicle.id === v.id) {
        const pulse = 1 + Math.sin(timeSec * 7) * 0.1;
        ctx.strokeStyle = '#F4B41A';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(w, l) * 0.75 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Plate & prompt badge above vehicle
        ctx.fillStyle = 'rgba(12, 20, 15, 0.92)';
        ctx.beginPath();
        ctx.roundRect(-58, -42, 116, 18, 5);
        ctx.fill();
        ctx.fillStyle = '#F4B41A';
        ctx.font = 'bold 9.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`[E] ${v.plate_number}`, 0, -30);
      }

      ctx.rotate(v.angle);

      // Headlight beam
      const grad = ctx.createLinearGradient(l * 0.4, 0, l * 0.4 + 92, 0);
      grad.addColorStop(0, 'rgba(255, 245, 190, 0.3)');
      grad.addColorStop(1, 'rgba(255, 245, 190, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(l * 0.4, -w * 0.3);
      ctx.lineTo(l * 0.4 + 92, -w * 1.2);
      ctx.lineTo(l * 0.4 + 92, w * 1.2);
      ctx.lineTo(l * 0.4, w * 0.3);
      ctx.closePath();
      ctx.fill();

      // Brake tail glow when braking
      if (v.id === drivenId && isBraking) {
        ctx.fillStyle = 'rgba(255, 42, 42, 0.65)';
        ctx.beginPath();
        ctx.arc(-l * 0.48, -w * 0.3, 6, 0, Math.PI * 2);
        ctx.arc(-l * 0.48, w * 0.3, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.roundRect(-l / 2 + 4, -w / 2 + 5, l, w, 6);
      ctx.fill();

      if (v.kind === 'bodaboda') {
        ctx.fillStyle = '#14171A';
        ctx.fillRect(l * 0.25, -3, 10, 6);
        ctx.fillRect(-l * 0.45, -3, 10, 6);

        ctx.strokeStyle = '#DCE4EC';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(l * 0.18, -w * 0.58);
        ctx.lineTo(l * 0.18, w * 0.58);
        ctx.stroke();

        ctx.fillStyle = v.secondary_color;
        ctx.beginPath();
        ctx.roundRect(-l * 0.38, -w * 0.32, l * 0.65, w * 0.64, 4);
        ctx.fill();

        ctx.fillStyle = v.primary_color;
        ctx.beginPath();
        ctx.roundRect(-2, -w * 0.36, l * 0.34, w * 0.72, 4);
        ctx.fill();

        if (v.id === drivenId || v.is_ai) {
          ctx.fillStyle = '#F4B41A';
          ctx.beginPath();
          ctx.arc(-3, 0, 6.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (v.kind === 'bajaji') {
        ctx.fillStyle = '#181A1C';
        ctx.fillRect(l * 0.28, -3, 8, 6);
        ctx.fillRect(-l * 0.38, -w / 2 - 2, 10, 4);
        ctx.fillRect(-l * 0.38, w / 2 - 2, 10, 4);

        ctx.fillStyle = v.primary_color;
        ctx.beginPath();
        ctx.moveTo(l / 2, 0);
        ctx.lineTo(l * 0.08, -w * 0.45);
        ctx.lineTo(l * 0.08, w * 0.45);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = v.secondary_color;
        ctx.beginPath();
        ctx.roundRect(-l * 0.46, -w * 0.48, l * 0.58, w * 0.96, 6);
        ctx.fill();

        ctx.fillStyle = '#202428';
        ctx.beginPath();
        ctx.roundRect(-l * 0.4, -w * 0.4, l * 0.44, w * 0.8, 4);
        ctx.fill();

        ctx.fillStyle = '#F4B41A';
        ctx.fillRect(-l * 0.25, -w * 0.32, 6, w * 0.64);
      } else {
        ctx.fillStyle = v.primary_color;
        ctx.beginPath();
        ctx.roundRect(-l / 2, -w / 2, l, w, 7);
        ctx.fill();

        ctx.fillStyle = v.secondary_color;
        ctx.fillRect(-l * 0.46, -w / 2, l * 0.92, 4.5);
        ctx.fillRect(-l * 0.46, w / 2 - 4.5, l * 0.92, 4.5);

        ctx.fillStyle = '#24313C';
        ctx.fillRect(l * 0.22, -w * 0.4, l * 0.16, w * 0.8);
      }

      ctx.restore();
    }
  }

  /**
   * 2.5D Oblique Extruded Buildings with Front Facade, Windows, Awnings & Roof Overhang
   */
  private drawBuildings25D(buildings: BuildingRow[]): void {
    const ctx = this.ctx;

    for (const b of buildings) {
      const extrusionH = b.category === 'hospital' || b.category === 'hostel' ? 24 : 16;
      const roofY = b.y - extrusionH;

      // Ground cast shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
      ctx.fillRect(b.x + 10, b.y + 12, b.width, b.height);

      // South-facing 2.5D vertical facade wall
      ctx.fillStyle = b.wall_color;
      ctx.fillRect(b.x, b.y + b.height - extrusionH, b.width, extrusionH);

      // Facade architectural windows / doors
      ctx.fillStyle =
        b.category === 'food' ? '#F59F00' : 'rgba(28, 45, 62, 0.78)';
      const winStep = 28;
      for (let wx = b.x + 14; wx < b.x + b.width - 20; wx += winStep) {
        ctx.fillRect(wx, b.y + b.height - extrusionH + 4, 12, extrusionH - 7);
      }

      // Duka la Mangi M-Pesa green/red awning stripe
      if (b.category === 'shop' || b.category === 'pharmacy') {
        ctx.fillStyle = '#1B8A5A';
        ctx.fillRect(b.x, b.y + b.height - extrusionH - 3, b.width, 5);
      }

      // Extruded Roof deck
      ctx.fillStyle = b.roof_color;
      ctx.fillRect(b.x, roofY, b.width, b.height);

      // Metallic corrugated roof seams
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      for (let rx = b.x + 16; rx < b.x + b.width; rx += 18) {
        ctx.beginPath();
        ctx.moveTo(rx, roofY + 4);
        ctx.lineTo(rx, roofY + b.height - 4);
        ctx.stroke();
      }

      // Roof ridge highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x + 10, roofY + b.height / 2);
      ctx.lineTo(b.x + b.width - 10, roofY + b.height / 2);
      ctx.stroke();

      // Red Cross emblem on KCMC Hospital wings
      if (b.category === 'hospital') {
        const cx = b.x + 28;
        const cy = roofY + 26;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E03131';
        ctx.fillRect(cx - 3, cy - 9, 6, 18);
        ctx.fillRect(cx - 9, cy - 3, 18, 6);
      }

      if (b.label) {
        const textW = Math.min(b.width - 12, b.label.length * 7.3 + 16);
        const boxX = b.x + (b.width - textW) / 2;
        const boxY = roofY + b.height / 2 - 12;

        ctx.fillStyle = 'rgba(12, 20, 15, 0.88)';
        ctx.strokeStyle = 'rgba(244, 180, 26, 0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, textW, 24, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#F8F9FA';
        ctx.font = 'bold 10.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.label, b.x + b.width / 2, roofY + b.height / 2);
      }
    }
  }

  private drawTrees25D(trees: TreeRow[], timeSec: number): void {
    const ctx = this.ctx;
    const sway = Math.sin(timeSec * 1.8) * 1.8;

    for (const t of trees) {
      ctx.save();
      ctx.translate(t.x, t.y);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.arc(5, 6, t.radius, 0, Math.PI * 2);
      ctx.fill();

      // Trunk
      ctx.fillStyle = '#4A321F';
      ctx.beginPath();
      ctx.arc(0, 0, t.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(sway, -4);

      if (t.kind === 'banana') {
        ctx.fillStyle = '#2E7D32';
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 3);
          ctx.beginPath();
          ctx.ellipse(
            t.radius * 0.54,
            0,
            t.radius * 0.64,
            t.radius * 0.25,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#66BB6A';
        ctx.beginPath();
        ctx.arc(0, 0, t.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = t.kind === 'coffee' ? '#1B5E20' : '#33691E';
        ctx.beginPath();
        ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#558B2F';
        ctx.beginPath();
        ctx.arc(-4, -4, t.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private drawGPSGuidanceArrow(
    player: PlayerState,
    target: Vector2D,
    stage: 'pickup' | 'dropoff',
    viewW: number,
    viewH: number
  ): void {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 150) return;

    const angle = Math.atan2(dy, dx);
    const orbitR = Math.min(viewW, viewH) * 0.28;
    const ax = viewW / 2 + Math.cos(angle) * orbitR;
    const ay = viewH / 2 + Math.sin(angle) * orbitR;

    const ctx = this.ctx;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);

    ctx.fillStyle = stage === 'pickup' ? '#F4B41A' : '#2ECC71';
    ctx.strokeStyle = '#0C140F';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawCircularCompassRadar(
    player: PlayerState,
    vehicles: VehicleRow[],
    roads: RoadRow[],
    activeTarget: Vector2D,
    stage: 'pickup' | 'dropoff'
  ): void {
    const ctx = this.ctx;
    const size = 124;
    const pad = 12;
    const cx = pad + size / 2;
    const cy = pad + size / 2;
    const radius = size / 2;
    const scale = size / WORLD_WIDTH;

    ctx.save();

    // Circular radar clip
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 20, 15, 0.92)';
    ctx.fill();
    ctx.save();
    ctx.clip();

    ctx.translate(pad, pad);

    for (const r of roads) {
      ctx.fillStyle = r.surface === 'tarmac' ? '#6C757D' : '#B86343';
      ctx.fillRect(
        r.x * scale,
        r.y * scale,
        Math.max(2, r.width * scale),
        Math.max(2, r.height * scale)
      );
    }

    for (const v of vehicles) {
      ctx.fillStyle = v.kind === 'bodaboda' ? '#E03131' : '#F4B41A';
      ctx.fillRect(v.x * scale - 2, v.y * scale - 2, 4, 4);
    }

    ctx.fillStyle = stage === 'pickup' ? '#F4B41A' : '#2ECC71';
    ctx.beginPath();
    ctx.arc(activeTarget.x * scale, activeTarget.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(player.x * scale, player.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Radar compass ring
    ctx.strokeStyle = 'rgba(244, 180, 26, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#F4B41A';
    ctx.font = 'bold 9.5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N • KCMC', cx, pad + 11);

    ctx.restore();
  }
}
