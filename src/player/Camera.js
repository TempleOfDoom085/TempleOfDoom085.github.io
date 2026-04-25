import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.yaw   = 0;
    this.pitch = -0.18;
    this._target = new THREE.Vector3();
  }

  applyMouse(dx, dy) {
    this.yaw   -= dx * 0.0022;
    this.pitch  = THREE.MathUtils.clamp(this.pitch - dy * 0.0022, -0.75, 0.5);
  }

  update(dt, player, vehicle) {
    if (vehicle) {
      // Chase cam for vehicles
      const v = vehicle;
      const dist  = v.type === 'plane' ? 18 : 12;
      const ht    = v.type === 'plane' ? 7  : 4;
      const behind = new THREE.Vector3(-Math.sin(v.angle)*dist, ht, -Math.cos(v.angle)*dist);
      const target = new THREE.Vector3(v.x, v.y, v.z).add(behind);
      this.camera.position.lerp(target, 0.07);
      this._target.lerp(new THREE.Vector3(v.x, v.y + 1.5, v.z), 0.1);
      this.camera.lookAt(this._target);
    } else {
      // Third-person follow
      const dist = 6.5, ht = 2.8;
      const tx = player.x - Math.sin(this.yaw) * dist;
      const ty = player.y + ht + Math.sin(this.pitch) * dist;
      const tz = player.z - Math.cos(this.yaw) * dist;
      this.camera.position.lerp(new THREE.Vector3(tx, ty, tz), 0.14);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    }
  }
}
