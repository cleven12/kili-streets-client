import {
  createActiveMission,
  tickActiveMission,
  updateAIVehicles,
  updateRealUserCharacters,
} from './engine/aiAndMissions';
import { SoundEffects } from './engine/audio';
import { ControlsManager } from './engine/controls';
import {
  findNearestVehicle,
  toggleEnterExitVehicle,
  updateDrivenVehicle,
  updatePlayerOnFoot,
} from './engine/physics';
import { WorldRenderer25D } from './engine/renderer25d';
import { BackendSyncConnector } from './sqlite/backendSync';
import { ClientSqliteDB } from './sqlite/clientSqlite';
import {
  CharacterRole,
  DustParticle,
  HeadgearStyle,
  PlayerState,
  UserCharacterRow,
  ZoneRow,
} from './types/game';

class KiliStreetsClientApp {
  private clientDb: ClientSqliteDB;
  private syncConnector: BackendSyncConnector;
  private renderer: WorldRenderer25D;
  private controls: ControlsManager;
  private sfx: SoundEffects;

  private player: PlayerState = {
    id: 'plr_cleven12',
    username: 'cleven12',
    displayName: 'Cleven Godson',
    role: 'Software Engineer',
    skinTone: '#4A2C18',
    jacketColor: '#1D63B8',
    accentColor: '#F4B41A',
    headgear: 'cap',
    x: 1125,
    y: 1580,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: 13,
    health: 100,
    stamina: 100,
    reputation: 50,
    moneyTZS: 5000,
    inVehicleId: null,
    walkCycle: 0,
  };

  private zones = [] as ZoneRow[];
  private roads = [] as ReturnType<ClientSqliteDB['selectAllRoads']>;
  private buildings = [] as ReturnType<ClientSqliteDB['selectAllBuildings']>;
  private trees = [] as ReturnType<ClientSqliteDB['selectAllTrees']>;
  private vehicles = [] as ReturnType<ClientSqliteDB['selectAllVehicles']>;
  private missions = [] as ReturnType<ClientSqliteDB['selectAllMissions']>;
  private characters = [] as UserCharacterRow[];
  private dustParticles: DustParticle[] = [];

  private currentMissionIndex = 0;
  private activeMissionState;
  private lastTimestamp = performance.now();
  private syncTimerSec = 0;
  private toastTimeout: number | null = null;

  // HUD DOM elements
  private elZoneName = document.getElementById('hud-zone-name');
  private elZoneSub = document.getElementById('hud-zone-sub');
  private elTzs = document.getElementById('hud-tzs');
  private elSpeed = document.getElementById('hud-speed');
  private elFuelBar = document.getElementById('fuel-bar');
  private elStaminaBar = document.getElementById('stamina-bar');
  private elMissionTitle = document.getElementById('mission-title');
  private elMissionTimer = document.getElementById('mission-timer');
  private elMissionDesc = document.getElementById('mission-desc');
  private elMissionDist = document.getElementById('mission-distance');
  private elBtnHijack = document.getElementById('btn-hijack');
  private elToast = document.getElementById('toast-banner');
  private elSqliteDot = document.getElementById('sqlite-status-dot');
  private elSqliteLabel = document.getElementById('sqlite-status-label');
  private elRealUserCount = document.getElementById('real-user-count');

  constructor() {
    this.clientDb = new ClientSqliteDB();
    this.syncConnector = new BackendSyncConnector(this.clientDb);
    this.reloadEntitiesFromClientSqlite();

    this.activeMissionState = createActiveMission(this.missions, 0);

    const canvas = document.getElementById('world-canvas') as HTMLCanvasElement;
    this.renderer = new WorldRenderer25D(canvas);
    this.controls = new ControlsManager();
    this.sfx = new SoundEffects();

    this.bindModalsAndCharacterStudio();
    this.refreshMissionBanner();
    this.initBackendSync();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  private reloadEntitiesFromClientSqlite(): void {
    this.zones = this.clientDb.selectAllZones();
    this.roads = this.clientDb.selectAllRoads();
    this.buildings = this.clientDb.selectAllBuildings();
    this.trees = this.clientDb.selectAllTrees();
    this.vehicles = this.clientDb.selectAllVehicles();
    this.missions = this.clientDb.selectAllMissions();
    this.characters = this.clientDb.selectAllUserCharacters();
    if (this.elRealUserCount) {
      this.elRealUserCount.textContent = String(this.characters.length);
    }
  }

  private async initBackendSync(): Promise<void> {
    const online = await this.syncConnector.bootstrapFromBackend(this.player);
    if (online) {
      this.reloadEntitiesFromClientSqlite();
      this.showToast('SQLite WAL: CONNECTED TO BACKEND & REAL USER ROSTER!');
    } else {
      this.showToast('OFFLINE MODE: CLIENT SQLite ENGINE ACTIVE');
    }
    this.updateSqliteIndicator();
  }

  private bindModalsAndCharacterStudio(): void {
    const modalCharacter = document.getElementById('modal-character');
    const modalSqlite = document.getElementById('modal-sqlite');
    const modalShop = document.getElementById('modal-shop');

    const inputUsername = document.getElementById(
      'char-username'
    ) as HTMLInputElement | null;
    const inputDisplayName = document.getElementById(
      'char-displayname'
    ) as HTMLInputElement | null;
    const selectRole = document.getElementById(
      'char-role'
    ) as HTMLSelectElement | null;
    const selectHeadgear = document.getElementById(
      'char-headgear'
    ) as HTMLSelectElement | null;
    const selectSkinTone = document.getElementById(
      'char-skintone'
    ) as HTMLSelectElement | null;
    const selectJacket = document.getElementById(
      'char-jacket'
    ) as HTMLSelectElement | null;

    const updatePreviewCanvas = () => {
      const previewCanvas = document.getElementById(
        'character-preview-canvas'
      ) as HTMLCanvasElement | null;
      if (!previewCanvas) return;
      const pctx = previewCanvas.getContext('2d');
      if (!pctx) return;

      const [jacketColor, accentColor] = (
        selectJacket?.value || '#1D63B8|#F4B41A'
      ).split('|');
      const skinTone = selectSkinTone?.value || '#4A2C18';
      const headgear = (selectHeadgear?.value || 'cap') as HeadgearStyle;

      pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      pctx.save();
      pctx.translate(55, 58);
      pctx.scale(2.3, 2.3);
      this.renderer.drawCharacterSpriteBody(
        pctx,
        -Math.PI / 4,
        0.5,
        skinTone,
        jacketColor,
        accentColor,
        headgear,
        true
      );
      pctx.restore();
    };

    [selectRole, selectHeadgear, selectSkinTone, selectJacket].forEach((el) =>
      el?.addEventListener('change', updatePreviewCanvas)
    );

    document
      .getElementById('btn-open-character')
      ?.addEventListener('click', () => {
        updatePreviewCanvas();
        this.renderRealUsersRoster();
        modalCharacter?.classList.add('open');
      });

    document
      .getElementById('btn-close-character')
      ?.addEventListener('click', () => {
        modalCharacter?.classList.remove('open');
      });

    document
      .getElementById('btn-randomize-char')
      ?.addEventListener('click', () => {
        const sampleNames = [
          ['eliud_dev', 'Eliud Mushi', 'Software Engineer'],
          ['fadhili_boda', 'Fadhili Tarimo', 'Bodaboda Rider'],
          ['amina_medic', 'Dr. AminaSwai', 'KCMC Medic'],
          ['kelvin_tvs', 'Kelvin Minja', 'Bajaji Captain'],
          ['esther_kili', 'Esther Urio', 'University Student'],
          ['david_trader', 'David Chuwa', 'Kilimanjaro Trader'],
        ];
        const pick =
          sampleNames[Math.floor(Math.random() * sampleNames.length)];
        if (inputUsername) {
          inputUsername.value = `${pick[0]}_${Math.floor(10 + Math.random() * 89)}`;
        }
        if (inputDisplayName) inputDisplayName.value = pick[1];
        if (selectRole) selectRole.value = pick[2];

        const randomSelect = (sel: HTMLSelectElement | null) => {
          if (!sel) return;
          sel.selectedIndex = Math.floor(Math.random() * sel.options.length);
        };
        randomSelect(selectHeadgear);
        randomSelect(selectSkinTone);
        randomSelect(selectJacket);
        updatePreviewCanvas();
      });

    document
      .getElementById('btn-save-character')
      ?.addEventListener('click', async () => {
        const username = inputUsername?.value.trim() || 'kili_user';
        const displayName = inputDisplayName?.value.trim() || username;
        const role = (selectRole?.value ||
          'Software Engineer') as CharacterRole;
        const headgear = (selectHeadgear?.value || 'cap') as HeadgearStyle;
        const skinTone = selectSkinTone?.value || '#4A2C18';
        const [jacketColor, accentColor] = (
          selectJacket?.value || '#1D63B8|#F4B41A'
        ).split('|');

        const created = await this.syncConnector.generateCharacter(
          {
            username,
            displayName,
            role,
            skinTone,
            jacketColor,
            accentColor,
            headgear,
          },
          this.player
        );

        this.switchActiveUserCharacter(created);
        this.reloadEntitiesFromClientSqlite();
        this.renderRealUsersRoster();
        this.updateSqliteIndicator();
        this.sfx.playChime('reward');
        modalCharacter?.classList.remove('open');
        this.showToast(
          `SPAWNED REAL USER: @${created.username.toUpperCase()} (${created.role.toUpperCase()})`
        );
      });

    document.getElementById('btn-open-sqlite')?.addEventListener('click', () => {
      this.renderSqliteInspector();
      modalSqlite?.classList.add('open');
    });
    document.getElementById('btn-close-sqlite')?.addEventListener('click', () => {
      modalSqlite?.classList.remove('open');
    });
    document.getElementById('btn-force-sync')?.addEventListener('click', async () => {
      const count = await this.syncConnector.flushSyncQueue(this.player);
      this.reloadEntitiesFromClientSqlite();
      this.renderSqliteInspector();
      this.updateSqliteIndicator();
      this.showToast(`SQLite SYNCED: ${count} EVENTS PUSHED`);
    });

    document.getElementById('btn-open-shop')?.addEventListener('click', () => {
      modalShop?.classList.add('open');
    });
    document.getElementById('btn-close-shop')?.addEventListener('click', () => {
      modalShop?.classList.remove('open');
    });

    document.querySelectorAll('[data-shop-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        const item = el.getAttribute('data-shop-item');
        const cost = Number(el.getAttribute('data-cost') || 0);

        if (this.player.moneyTZS < cost) {
          this.showToast('INSUFFICIENT TZS BALANCE!');
          return;
        }

        this.player.moneyTZS -= cost;
        this.clientDb.setMeta('balance_tzs', String(this.player.moneyTZS));
        this.sfx.playChime('shop');

        if (item === 'ndizi') {
          this.player.stamina = 100;
          this.player.health = 100;
          this.showToast('ATE BEEF BANANA STEW AT MAMA NTILIE (+100% STAMINA)');
        } else if (item === 'fuel') {
          for (const v of this.vehicles) v.fuel_level = 100;
          this.showToast('VEHICLE FUEL TANK REFILLED TO 100%!');
        } else {
          this.player.reputation += 15;
          this.showToast('PURCHASED VOUCHER AT MANGI STORE (+15 REPUTATION)');
        }

        this.clientDb.enqueueSyncEvent('shop_purchase', {
          item,
          costTzs: cost,
        });
        modalShop?.classList.remove('open');
      });
    });
  }

  private switchActiveUserCharacter(ch: UserCharacterRow): void {
    this.player.id = ch.player_id;
    this.player.username = ch.username;
    this.player.displayName = ch.display_name;
    this.player.role = ch.role;
    this.player.skinTone = ch.skin_tone;
    this.player.jacketColor = ch.jacket_color;
    this.player.accentColor = ch.accent_color;
    this.player.headgear = ch.headgear;
    this.player.x = ch.x;
    this.player.y = ch.y;
    this.player.inVehicleId = null;
  }

  private renderRealUsersRoster(): void {
    const container = document.getElementById('real-users-roster');
    if (!container) return;

    this.characters = this.clientDb.selectAllUserCharacters();
    container.innerHTML = this.characters
      .map(
        (ch) => `
        <div class="roster-card ${
          ch.username === this.player.username ? 'active' : ''
        }" data-switch-user="${ch.username}">
          <div>
            <div style="font-weight:800; font-size:0.78rem; color:#F4F7F5;">
              ● @${ch.username}
            </div>
            <div style="font-size:0.7rem; color:#9BB0A3;">
              ${ch.display_name} • ${ch.role}
            </div>
          </div>
          <span style="font-family:var(--font-mono); font-size:0.68rem; color:#F4B41A;">
            ${ch.username === this.player.username ? 'ACTIVE' : 'PLAY'}
          </span>
        </div>`
      )
      .join('');

    container.querySelectorAll('[data-switch-user]').forEach((card) => {
      card.addEventListener('click', () => {
        const uname = (card as HTMLElement).getAttribute('data-switch-user');
        const found = this.characters.find((c) => c.username === uname);
        if (found) {
          this.switchActiveUserCharacter(found);
          this.renderRealUsersRoster();
          this.showToast(
            `NOW PLAYING AS REAL USER: @${found.username.toUpperCase()} (${found.role})`
          );
        }
      });
    });
  }

  private renderSqliteInspector(): void {
    const grid = document.getElementById('sqlite-table-grid');
    const meta = document.getElementById('sqlite-sync-meta');
    if (!grid) return;

    const stats = this.clientDb.getStats();
    grid.innerHTML = stats.tables
      .map(
        (t) => `
        <div class="sqlite-cell">
          <span style="color:#9BB0A3">${t.tableName}</span>
          <strong style="color:#2ECC71">${t.rowCount} rows</strong>
        </div>`
      )
      .join('');

    if (meta) {
      meta.textContent = `Queue: ${stats.pendingSyncEvents} pending • Backend: ${
        stats.backendOnline ? 'ONLINE (Port 4000)' : 'LOCAL WAL'
      }`;
    }
  }

  private updateSqliteIndicator(): void {
    const stats = this.clientDb.getStats();
    if (this.elSqliteDot) {
      this.elSqliteDot.className = stats.backendOnline
        ? 'status-dot'
        : 'status-dot offline';
    }
    if (this.elSqliteLabel) {
      this.elSqliteLabel.textContent = stats.backendOnline
        ? `SQLite SYNCED (${stats.pendingSyncEvents})`
        : `SQLite LOCAL (${stats.pendingSyncEvents})`;
    }
    if (this.elRealUserCount) {
      this.elRealUserCount.textContent = String(this.characters.length);
    }
  }

  private showToast(msg: string): void {
    if (!this.elToast) return;
    this.elToast.textContent = msg;
    this.elToast.classList.add('visible');
    if (this.toastTimeout) window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      this.elToast?.classList.remove('visible');
    }, 2600);
  }

  private refreshMissionBanner(): void {
    const m = this.activeMissionState.mission;
    if (this.elMissionTitle) {
      this.elMissionTitle.textContent = `${m.title} (+TZS ${m.reward_tzs.toLocaleString()})`;
    }
    if (this.elMissionDesc) {
      if (this.activeMissionState.stage === 'pickup') {
        this.elMissionDesc.textContent = `Go to: ${m.pickup_label} — ${m.description}`;
      } else {
        this.elMissionDesc.textContent = `Deliver now to: ${m.dropoff_label}!`;
      }
    }
  }

  private loop(timestamp: number): void {
    const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    const timeSec = timestamp / 1000;

    const input = this.controls.poll();

    if (input.interactJustPressed) {
      const res = toggleEnterExitVehicle(this.player, this.vehicles);
      if (res.action === 'entered' && res.vehicle) {
        this.sfx.playChime('enter');
        this.showToast(
          `ENTERED: ${res.vehicle.display_name.toUpperCase()} (${res.vehicle.plate_number})`
        );
        this.clientDb.enqueueSyncEvent('player_move', {
          x: this.player.x,
          y: this.player.y,
          angle: this.player.angle,
          inVehicleId: res.vehicle.id,
        });
      } else if (res.action === 'exited') {
        this.showToast('EXITED VEHICLE');
        this.clientDb.enqueueSyncEvent('player_move', {
          x: this.player.x,
          y: this.player.y,
          angle: this.player.angle,
          inVehicleId: null,
        });
      }
    }

    if (input.missionCycleJustPressed) {
      this.currentMissionIndex =
        (this.currentMissionIndex + 1) % this.missions.length;
      this.activeMissionState = createActiveMission(
        this.missions,
        this.currentMissionIndex
      );
      this.refreshMissionBanner();
      this.showToast(
        `NEW MISSION: ${this.activeMissionState.mission.title}`
      );
    }

    const drivenVehicle = this.player.inVehicleId
      ? this.vehicles.find((v) => v.id === this.player.inVehicleId) || null
      : null;

    if (input.hornPressed) {
      this.sfx.playHorn(drivenVehicle ? drivenVehicle.kind : null, dt);
    }

    if (drivenVehicle) {
      updateDrivenVehicle(
        drivenVehicle,
        input,
        this.roads,
        this.buildings,
        this.trees,
        this.dustParticles,
        dt
      );
      this.player.x = drivenVehicle.x;
      this.player.y = drivenVehicle.y;
      this.player.angle = drivenVehicle.angle;
    } else {
      updatePlayerOnFoot(this.player, input, this.buildings, this.trees, dt);
    }

    updateAIVehicles(this.vehicles, this.player.x, this.player.y, dt);
    updateRealUserCharacters(
      this.characters,
      this.player.username,
      this.player,
      dt
    );
    this.updateDust(dt);

    const missionTick = tickActiveMission(
      this.activeMissionState,
      this.player,
      dt
    );
    if (missionTick.status === 'picked_up') {
      this.sfx.playChime('pickup');
      this.refreshMissionBanner();
      this.showToast(
        `PASSENGER/CARGO PICKED UP! DELIVER TO: ${this.activeMissionState.mission.dropoff_label.toUpperCase()}`
      );
    } else if (missionTick.status === 'completed') {
      const completedMission = this.activeMissionState.mission;
      this.sfx.playChime('reward');
      this.clientDb.setMeta('balance_tzs', String(this.player.moneyTZS));
      this.clientDb.enqueueSyncEvent('mission_complete', {
        missionId: completedMission.id,
        rewardTzs: completedMission.reward_tzs,
      });
      this.showToast(
        `MISSION COMPLETE! EARNED +TZS ${completedMission.reward_tzs.toLocaleString()}`
      );
      this.currentMissionIndex =
        (this.currentMissionIndex + 1) % this.missions.length;
      this.activeMissionState = createActiveMission(
        this.missions,
        this.currentMissionIndex
      );
      this.refreshMissionBanner();
    } else if (missionTick.status === 'expired') {
      this.refreshMissionBanner();
      this.showToast('TIME EXPIRED! RETURN TO PICKUP POINT.');
    }

    this.syncTimerSec += dt;
    if (this.syncTimerSec >= 4.0) {
      this.syncTimerSec = 0;
      this.syncConnector.flushSyncQueue(this.player).then(() => {
        this.updateSqliteIndicator();
      });
    }

    const nearestVehicle = !drivenVehicle
      ? findNearestVehicle(this.player, this.vehicles)
      : null;

    this.updateHUD(
      drivenVehicle,
      nearestVehicle,
      missionTick.distanceMeters
    );

    this.renderer.render(
      this.player,
      this.vehicles,
      this.characters,
      this.roads,
      this.buildings,
      this.trees,
      this.dustParticles,
      this.activeMissionState,
      missionTick.target,
      nearestVehicle,
      input.brake,
      timeSec,
      dt
    );

    requestAnimationFrame((ts) => this.loop(ts));
  }

  private updateDust(dt: number): void {
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 8;
      p.alpha -= dt * 0.95;
      if (p.alpha <= 0) this.dustParticles.splice(i, 1);
    }
  }

  private updateHUD(
    drivenVehicle: (typeof this.vehicles)[number] | null,
    nearestVehicle: (typeof this.vehicles)[number] | null,
    distanceMeters: number
  ): void {
    let closestZone = this.zones[2] || this.zones[0];
    let bestDist = Infinity;
    for (const z of this.zones) {
      const d = Math.hypot(
        this.player.x - z.center_x,
        this.player.y - z.center_y
      );
      if (d < bestDist) {
        bestDist = d;
        closestZone = z;
      }
    }

    if (closestZone) {
      if (this.elZoneName) this.elZoneName.textContent = closestZone.title;
      if (this.elZoneSub) this.elZoneSub.textContent = closestZone.subtitle;
    }

    if (this.elTzs) {
      this.elTzs.textContent = `TZS ${this.player.moneyTZS.toLocaleString()}`;
    }

    if (this.elSpeed) {
      if (drivenVehicle) {
        const kmh = Math.round(Math.abs(drivenVehicle.speed) * 0.24);
        this.elSpeed.textContent = `${drivenVehicle.display_name.toUpperCase()} • ${kmh} km/h`;
      } else {
        this.elSpeed.textContent = `ON FOOT • @${this.player.username} (${this.player.role})`;
      }
    }

    if (this.elFuelBar) {
      const fuel = drivenVehicle ? drivenVehicle.fuel_level : 100;
      this.elFuelBar.style.width = `${Math.round(fuel)}%`;
    }
    if (this.elStaminaBar) {
      this.elStaminaBar.style.width = `${Math.round(this.player.stamina)}%`;
    }

    if (this.elMissionDist) {
      this.elMissionDist.textContent = `DISTANCE: ${distanceMeters}m`;
    }

    if (this.elMissionTimer) {
      if (this.activeMissionState.stage === 'dropoff') {
        this.elMissionTimer.textContent = `⏱ ${Math.ceil(
          this.activeMissionState.timeLeftSeconds
        )}s`;
      } else {
        this.elMissionTimer.textContent = '';
      }
    }

    if (this.elBtnHijack) {
      if (drivenVehicle) {
        this.elBtnHijack.classList.remove('hidden');
        this.elBtnHijack.textContent = 'EXIT (E)';
      } else if (nearestVehicle) {
        this.elBtnHijack.classList.remove('hidden');
        this.elBtnHijack.textContent = `ENTER ${nearestVehicle.kind.toUpperCase()} (E)`;
      } else {
        this.elBtnHijack.classList.add('hidden');
        this.elBtnHijack.textContent = 'ENTER (E)';
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new KiliStreetsClientApp();
});
