import * as THREE from 'three';

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pool  = [];
  }

  burst(pos, color = 0xff4422, count = 16, speed = 8) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 4, 4),
        new THREE.MeshLambertMaterial({ color, transparent: true })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      const a = Math.random()*Math.PI*2, el = (Math.random()-0.5)*Math.PI;
      this.pool.push({
        mesh,
        vx: Math.cos(a)*Math.cos(el)*speed,
        vy: Math.abs(Math.sin(el))*speed + 2,
        vz: Math.sin(a)*Math.cos(el)*speed,
        life: 0.5 + Math.random()*0.4,
        maxLife: 0.9,
        gravity: true,
      });
    }
  }

  // Tyre dust / dirt cloud when driving fast
  dust(pos, color = 0x998877, count = 5, speed = 2.5) {
    for (let i = 0; i < count; i++) {
      const size = 0.18 + Math.random()*0.22;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 4, 4),
        new THREE.MeshLambertMaterial({ color, transparent: true })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      const a = Math.random()*Math.PI*2;
      this.pool.push({
        mesh,
        vx: Math.cos(a)*speed*(0.3 + Math.random()*0.7),
        vy: speed*0.6 + Math.random()*speed*0.5,
        vz: Math.sin(a)*speed*(0.3 + Math.random()*0.7),
        life: 0.7 + Math.random()*0.6,
        maxLife: 1.3,
        gravity: false, // floats upward, no gravity
      });
    }
  }

  // Exhaust puff (darker, smaller, upward drift)
  exhaust(pos, count = 3) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 + Math.random()*0.12, 4, 4),
        new THREE.MeshLambertMaterial({ color: 0x333333, transparent: true })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.pool.push({
        mesh,
        vx: (Math.random()-0.5)*0.8,
        vy: 1.5 + Math.random(),
        vz: (Math.random()-0.5)*0.8,
        life: 0.5 + Math.random()*0.4,
        maxLife: 0.9,
        gravity: false,
      });
    }
  }

  update(dt) {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.vx *= 0.90; p.vz *= 0.90;
      if (p.gravity) p.vy -= 20 * dt;
      else           p.vy -= 1.5 * dt; // slow float
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
