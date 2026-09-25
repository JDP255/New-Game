// Unified keyboard / mouse / gamepad input with per-frame "pressed" edges.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseButtons = new Set();
    this.pressedMouse = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.locked = false;
    this.sensitivity = 1;
    this.invertY = false;
    this.enabled = true;
    this.gpPrev = {};
    this.gp = {};
    this.usingGamepad = false;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      this.usingGamepad = false;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseButtons.clear(); });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseButtons.add(e.button);
      this.pressedMouse.add(e.button);
      this.usingGamepad = false;
    });
    addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      // Pointer lock gives free mouse-look; without it (e.g. sandboxed frames) drag with any button held.
      if (this.locked || this.mouseButtons.size > 0) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  requestLock() {
    if (!this.locked && this.canvas.requestPointerLock) {
      try {
        const p = this.canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* ignore */ }
    }
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && [...pads].find((p) => p && p.connected);
    this.gpPrev = this.gp;
    this.gp = {};
    this.gpAxes = [0, 0, 0, 0];
    if (!pad) return;
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    this.gpAxes = [dz(pad.axes[0] || 0), dz(pad.axes[1] || 0), dz(pad.axes[2] || 0), dz(pad.axes[3] || 0)];
    pad.buttons.forEach((b, i) => { if (b.pressed) this.gp[i] = true; });
    if (Object.keys(this.gp).length || this.gpAxes.some((a) => a !== 0)) this.usingGamepad = true;
  }
  gpDown(i) { return !!this.gp[i]; }
  gpPressed(i) { return !!this.gp[i] && !this.gpPrev[i]; }

  down(code) { return this.keys.has(code); }
  pressed(code) { return this.pressedKeys.has(code); }

  // Logical actions ---------------------------------------------------------
  get moveX() {
    let x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    if (this.gpAxes && this.gpAxes[0]) x = this.gpAxes[0];
    return x;
  }
  get moveY() {
    let y = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
    if (this.gpAxes && this.gpAxes[1]) y = -this.gpAxes[1];
    return y;
  }
  lookDelta() {
    let x = this.mouseDX * 0.0022 * this.sensitivity;
    let y = this.mouseDY * 0.0022 * this.sensitivity;
    if (this.gpAxes) {
      x += this.gpAxes[2] * 0.045 * this.sensitivity;
      y += this.gpAxes[3] * 0.035 * this.sensitivity;
    }
    if (this.invertY) y = -y;
    return [x, y];
  }
  get jumpPressed() { return this.pressed('Space') || this.gpPressed(0); }
  get jumpHeld() { return this.down('Space') || this.gpDown(0); }
  get dashPressed() { return this.pressed('ShiftLeft') || this.pressed('ShiftRight') || this.gpPressed(1); }
  get attackPressed() { return this.pressedMouse.has(0) || this.pressed('KeyJ') || this.gpPressed(2); }
  get heavyPressed() { return this.pressedMouse.has(2) || this.pressed('KeyK') || this.gpPressed(3); }
  get heavyHeld() { return this.mouseButtons.has(2) || this.down('KeyK') || this.gpDown(3); }
  get parryPressed() { return this.pressed('KeyQ') || this.gpPressed(4); }
  get specialPressed() { return this.pressed('KeyF') || this.gpPressed(5); }
  get interactPressed() { return this.pressed('KeyE') || this.gpPressed(6); }
  get lockPressed() { return this.pressed('Tab') || this.pressedMouse.has(1) || this.gpPressed(7) || this.gpPressed(11); }
  get pausePressed() { return this.pressed('Escape') || this.pressed('KeyP') || this.gpPressed(9); }
  get skipPressed() { return this.pressed('Enter') || this.pressed('Space') || this.pressed('Escape') || this.gpPressed(0) || this.gpPressed(9); }
  get advancePressed() { return this.pressed('Enter') || this.pressed('Space') || this.pressedMouse.has(0) || this.gpPressed(0); }
  get journalPressed() { return this.pressed('KeyI') || this.gpPressed(8); }

  endFrame() {
    this.pressedKeys.clear();
    this.pressedMouse.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
