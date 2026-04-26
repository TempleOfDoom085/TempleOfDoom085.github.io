import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera    = camera;
    this.yaw       = 0;
    this.pitch     = -0.18;
    this._target   = new THREE.Vector3();
    this._bobPhase = 0;
  }

  applyMouse(dx, dy) {
    this.yaw   -= dx * 0.0022;
    this.pitch  = THREE.MathUtils.clamp(this.pitch - dy * 0.0022, -0.75, 0.5);
  }

  update(dt, player, vehicle) {
    if (vehicle) {
      const dist  = vehicle.type === 'plane' ? 18 : 12;
      const ht    = vehicle.type === 'plane' ? 7  : 4;
      const behind = new THREE.Vector3(-Math.sin(vehicle.angle)*dist, ht, -Math.cos(vehicle.angle)*dist);
      const target = new THREE.Vector3(vehicle.x, vehicle.y, vehicle.z).add(behind);
      this.camera.position.lerp(target, 0.07);
      this._target.lerp(new THREE.Vector3(vehicle.x, vehicle.y + 1.5, vehicle.z), 0.1);
      this.camera.lookAt(this._target);

      // FOV: zoom out slightly at high vehicle speed
      const spd = Math.abs(vehicle.speed || 0);
      const targetFov = 70 + Math.min(spd * 0.3, 18);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.05);
      this.camera.updateProjectionMatrix();
    } else {
      const dist = 6.5, ht = 2.8;
      const tx = player.x - Math.sin(this.yaw) * dist;
      const tz = player.z - Math.cos(this.yaw) * dist;

      // Camera bob while walking on ground
      const grounded = player.onGround && !player.inVehicle;
      const moving   = player.speed > 0.8;
      if (grounded && moving) this._bobPhase += dt * 7.5;
      const bob = (grounded && moving) ? Math.sin(this._bobPhase) * 0.09 : 0;

      const ty = player.y + ht + Math.sin(this.pitch) * dist + bob;
      this.camera.position.lerp(new THREE.Vector3(tx, ty, tz), 0.14);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;

      // FOV widens with speed (sprint feel)
      const targetFov = 70 + Math.min(player.speed * 0.5, 14);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.06);
      this.camera.updateProjectionMatrix();
    }
  }
}
