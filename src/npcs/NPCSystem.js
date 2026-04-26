import * as THREE from 'three';
import { getHeight } from '../world/Terrain.js';

const SKIN  = [0xffd0a0,0xe8a870,0xc87040,0xffe0c0,0xd0a080,0xb87040];
const SHIRT = [0xdd3333,0x3355dd,0x33aa44,0xddaa22,0x8833cc,0xdd7722,0x22aacc,0xdddd22];
const DIALOGUE_CITIZEN = [
  "I saw a pigeon wearing sunglasses. Very suspicious.",
  "My car just told me to 'turn left into the ocean.' I said no.",
  "The hot dog cart has been following me for THREE days.",
  "I used to be an adventurer. Then I got a spreadsheet.",
  "Someone replaced all the traffic cones with garden gnomes.",
  "The mayor is definitely a raccoon. I have evidence.",
  "Watch out — the fish near the pier are unionised.",
  "Did you know the library is just a hat shop with extra steps?",
  "I tried counting the clouds. Got to four. Very stressful.",
  "My grandma is the fastest driver in this city. She's 92.",
  "There's a horse on the roof of the police station again.",
];
const DIALOGUE_QUEST = [
  "I need someone brave, fast, and slightly unhinged.",
  "My rubber ducks are missing. ALL forty of them.",
  "Deliver this box. Do NOT shake it. Do NOT listen to it.",
  "Race me to the beach. I'll explain later. Maybe.",
  "Those forest bandits stole my lucky sandwich.",
  "The wizard turned my car into a shopping trolley.",
  "Help — I launched my frisbee and it landed on a plane.",
  "I bet you can't fly the plane over the whole city.",
];
const DIALOGUE_SHOP = [
  "Best gear in town. Probably.",
  "Special offers. Limited supply. Unlimited excuses.",
  "You look like someone who needs more weapons.",
];

function buildNPCMesh(scene, x, z) {
  const g   = new THREE.Group();
  const sk  = new THREE.MeshLambertMaterial({color: SKIN[Math.floor(Math.random()*SKIN.length)]});
  const sh  = new THREE.MeshLambertMaterial({color: SHIRT[Math.floor(Math.random()*SHIRT.length)]});
  const pn  = new THREE.MeshLambertMaterial({color: 0x223366 + Math.floor(Math.random()*0x222)});
  const add = (geo,mat,px,py,pz,name)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(px,py,pz); if(name)m.name=name; g.add(m); };
  add(new THREE.BoxGeometry(0.50,0.85,0.35), sh,  0,0.22,0);
  add(new THREE.BoxGeometry(0.44,0.44,0.44), sk,  0,0.92,0);
  add(new THREE.BoxGeometry(0.22,0.65,0.22), pn, -0.13,-0.33,0,'nl0');
  add(new THREE.BoxGeometry(0.22,0.65,0.22), pn,  0.13,-0.33,0,'nl1');
  add(new THREE.BoxGeometry(0.18,0.65,0.18), sk, -0.38,0.20,0,'na0');
  add(new THREE.BoxGeometry(0.18,0.65,0.18), sk,  0.38,0.20,0,'na1');
  const h = getHeight(x, z);
  g.position.set(x, h + 0.9, z);
  g.castShadow = true;
  scene.add(g);
  return g;
}

export class NPCSystem {
  constructor(scene) {
    this.scene = scene;
    this.list  = [];
    this._build();
  }

  _build() {
    const rng = mulberry32(55);
    // 30 citizens in city
    for (let i = 0; i < 30; i++) {
      const x = (rng()-0.5)*160, z = (rng()-0.5)*160;
      this._spawn(x, z, 'citizen', rng);
    }
    // 8 quest givers
    [[22,42],[-44,18],[62,-28],[-24,-58],[48,68],[-62,8],[30,-72],[-48,50]].forEach(([x,z])=>{
      this._spawn(x, z, 'quest', rng);
    });
    // 4 shopkeepers (stationary)
    [[55,55],[-55,-55],[55,-55],[-55,55]].forEach(([x,z])=>{
      this._spawn(x, z, 'shopkeeper', rng);
    });
  }

  _spawn(x, z, type, rng) {
    const mesh = buildNPCMesh(this.scene, x, z);
    let indicator = null;
    if (type === 'quest') {
      indicator = new THREE.Mesh(new THREE.SphereGeometry(0.24,8,8),new THREE.MeshLambertMaterial({color:0xffdd00,emissive:0xffaa00}));
      indicator.position.set(x, getHeight(x,z)+3.0, z);
      this.scene.add(indicator);
    }
    if (type === 'shopkeeper') {
      indicator = new THREE.Mesh(new THREE.SphereGeometry(0.24,8,8),new THREE.MeshLambertMaterial({color:0x00ddff,emissive:0x008888}));
      indicator.position.set(x, getHeight(x,z)+3.0, z);
      this.scene.add(indicator);
    }
    const dlg = type==='quest'   ? DIALOGUE_QUEST[Math.floor(rng()*DIALOGUE_QUEST.length)]
              : type==='shopkeeper' ? DIALOGUE_SHOP[Math.floor(rng()*DIALOGUE_SHOP.length)]
              : DIALOGUE_CITIZEN[Math.floor(rng()*DIALOGUE_CITIZEN.length)];
    const npc = { mesh, type, x, z, wx:x, wz:z, speed:1.6+rng()*1.2, walkPhase:rng()*Math.PI*2,
      alive:true, indicator, dialogue:dlg, hasQuest: type==='quest', questGiven:false, pendingQuest:null };
    this.list.push(npc);
    return npc;
  }

  nearest(px, pz, maxDist = 4.5) {
    let best = null, bd = maxDist;
    this.list.forEach(n => {
      const d = Math.hypot(px-n.x, pz-n.z);
      if (d < bd) { bd=d; best=n; }
    });
    return best;
  }

  update(dt, time, player = null) {
    this.list.forEach(n => {
      if (!n.alive || n.type==='shopkeeper') return;

      // Flee from player when wanted level is high
      if (player && player.wanted >= 2 && n.type === 'citizen') {
        const pdist = Math.hypot(n.x - player.x, n.z - player.z);
        if (pdist < 22) {
          const ang = Math.atan2(n.z - player.z, n.x - player.x);
          n.wx = THREE.MathUtils.clamp(n.x + Math.cos(ang)*32, -88, 88);
          n.wz = THREE.MathUtils.clamp(n.z + Math.sin(ang)*32, -88, 88);
          n._fleeSpd = 5.2;
        }
      }
      if (n._fleeSpd > 0) n._fleeSpd = Math.max(0, n._fleeSpd - dt * 0.6);

      const dx = n.wx - n.x, dz = n.wz - n.z, dist = Math.hypot(dx,dz);
      if (dist < 1.2 || Math.random() < 0.003) {
        n.wx = THREE.MathUtils.clamp(n.x+(Math.random()-.5)*40,-88,88);
        n.wz = THREE.MathUtils.clamp(n.z+(Math.random()-.5)*40,-88,88);
      }
      const spd = (n._fleeSpd || n.speed) * dt;
      if (dist > 0.1) { n.x += (dx/dist)*spd; n.z += (dz/dist)*spd; }
      const h = getHeight(n.x, n.z);
      n.mesh.position.set(n.x, h+0.9, n.z);
      n.mesh.rotation.y = Math.atan2(dx,dz);
      n.walkPhase += dt * n.speed * 2.4;
      const l0=n.mesh.getObjectByName('nl0'),l1=n.mesh.getObjectByName('nl1');
      if(l0) l0.rotation.x= Math.sin(n.walkPhase)*0.5;
      if(l1) l1.rotation.x=-Math.sin(n.walkPhase)*0.5;
      if (n.indicator) {
        n.indicator.position.set(n.x, h+3.0, n.z);
        n.indicator.rotation.y += dt*2.2;
      }
    });
  }
}

function mulberry32(a) {
  return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
