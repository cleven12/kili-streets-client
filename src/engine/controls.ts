import { InputState } from '../types/game';

export class ControlsManager {
  private keys = new Set<string>();
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchGas = false;
  private touchBrake = false;
  private touchHorn = false;
  private queuedInteract = false;
  private queuedMissionCycle = false;

  constructor() {
    this.bindKeyboard();
    this.bindTouchControls();
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)
      ) {
        e.preventDefault();
      }
      if (!this.keys.has(code)) {
        if (code === 'KeyE' || code === 'Enter' || code === 'KeyF') {
          this.queuedInteract = true;
        }
        if (code === 'KeyM') {
          this.queuedMissionCycle = true;
        }
      }
      this.keys.add(code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  private bindTouchControls(): void {
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    const btnGas = document.getElementById('btn-gas');
    const btnBrake = document.getElementById('btn-brake');
    const btnHorn = document.getElementById('btn-horn');
    const btnHijack = document.getElementById('btn-hijack');
    const btnMissionNext = document.getElementById('btn-mission-next');

    if (zone && knob) {
      let activePointerId: number | null = null;
      const maxRadius = 42;

      const updateKnob = (clientX: number, clientY: number) => {
        const rect = zone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius) {
          dx = (dx / dist) * maxRadius;
          dy = (dy / dist) * maxRadius;
        }
        knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
        this.touchMoveX = dx / maxRadius;
        this.touchMoveY = dy / maxRadius;
      };

      const resetKnob = () => {
        activePointerId = null;
        knob.style.transform = 'translate(0px, 0px)';
        this.touchMoveX = 0;
        this.touchMoveY = 0;
      };

      zone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        activePointerId = e.pointerId;
        zone.setPointerCapture(e.pointerId);
        updateKnob(e.clientX, e.clientY);
      });

      zone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== activePointerId) return;
        updateKnob(e.clientX, e.clientY);
      });

      zone.addEventListener('pointerup', (e) => {
        if (e.pointerId === activePointerId) resetKnob();
      });

      zone.addEventListener('pointercancel', (e) => {
        if (e.pointerId === activePointerId) resetKnob();
      });
    }

    const bindHoldButton = (
      el: HTMLElement | null,
      setter: (val: boolean) => void
    ) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.classList.add('active');
        setter(true);
      });
      const release = () => {
        el.classList.remove('active');
        setter(false);
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', release);
    };

    bindHoldButton(btnGas, (v) => (this.touchGas = v));
    bindHoldButton(btnBrake, (v) => (this.touchBrake = v));
    bindHoldButton(btnHorn, (v) => (this.touchHorn = v));

    if (btnHijack) {
      btnHijack.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.queuedInteract = true;
      });
    }

    if (btnMissionNext) {
      btnMissionNext.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.queuedMissionCycle = true;
      });
    }
  }

  public poll(): InputState {
    let kbX = 0;
    let kbY = 0;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kbX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kbX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kbY -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kbY += 1;

    const moveX = Math.abs(this.touchMoveX) > 0.05 ? this.touchMoveX : kbX;
    const moveY = Math.abs(this.touchMoveY) > 0.05 ? this.touchMoveY : kbY;

    const gas =
      this.touchGas || this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const brake =
      this.touchBrake ||
      this.keys.has('Space') ||
      this.keys.has('KeyS') ||
      this.keys.has('ArrowDown');
    const hornPressed = this.touchHorn || this.keys.has('KeyH');

    const interactJustPressed = this.queuedInteract;
    const missionCycleJustPressed = this.queuedMissionCycle;

    this.queuedInteract = false;
    this.queuedMissionCycle = false;

    return {
      moveX,
      moveY,
      gas,
      brake,
      hornPressed,
      interactJustPressed,
      missionCycleJustPressed,
    };
  }
}
