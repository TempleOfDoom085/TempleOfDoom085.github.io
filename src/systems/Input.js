export class Input {
  constructor() {
    this.keys = {};
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: {} };
    this.locked = false;
    this._dx = 0; this._dy = 0;

    window.addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()] = false;
      this.keys[e.code] = false;
    });
    window.addEventListener('mousedown', e => { this.mouse.buttons[e.button] = true; });
    window.addEventListener('mouseup',   e => { this.mouse.buttons[e.button] = false; });
    window.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this._dx += e.movementX;
      this._dy += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = !!document.pointerLockElement;
    });
  }

  update() {
    this.mouse.dx = this._dx;
    this.mouse.dy = this._dy;
    this._dx = 0; this._dy = 0;
  }

  is(key) { return !!this.keys[key.toLowerCase()] || !!this.keys[key]; }
  pressed(key) { return !!this.keys[key.toLowerCase()]; }
  lock(canvas) { canvas.requestPointerLock(); }
  unlock() { if (document.exitPointerLock) document.exitPointerLock(); }
}
