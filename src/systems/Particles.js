import * as THREE from 'three';

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
  }

  burst(pos, color = 0xff4422, count = 16, speed = 8) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 4, 4),
        new THREE.MeshLambertMaterial({ color, transparent: true })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      const a = Math.random() * Math.PI * 2, el = (Math.random() - 0.5) * Math.PI;
      this.pool.push({
        mesh,
        vx: Math.cos(a) * Math.cos(el) * speed,
        vy: Math.abs(Math.sin(el)) * speed + 2,
        vz: Math.sin(a) * Math.cos(el) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
      });
    }
  }

  update(dt) {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.vx *= 0.90; p.vy -= 20 * dt; p.vz *= 0.90;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.life -= dt;
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.pool.splice(i, 1);
      }
    }
  }
}
