import * as THREE from 'three';
import { getHeight } from '../world/Terrain.js';

const POOL = [
  { id:'ducks',  title:'🦆 OPERATION RUBBER DUCK',
    flavor:'My 40-year duck collection vanished overnight. Yes, ALL of them.',
    gen: ()=>({type:'collect',item:'duck', target:5, obj:'Collect 5 rubber ducks hidden around town', reward:350 })},
  { id:'pizza',  title:'🍕 EXTREME PIZZA DELIVERY',
    flavor:'Customer on the beach is VERY hungry. And large. And impatient.',
    gen: ()=>({type:'reach', dest:{x:30,z:210}, timer:65, obj:'Reach the beach delivery spot in 65s', reward:220 })},
  { id:'race',   title:'🏁 GRANDMA ROSA\'S RACE',
    flavor:"She's 87 and she cheats. Watch your mirrors.",
    gen: ()=>({type:'reach', dest:{x:0,z:0}, timer:40, obj:'Reach the park fountain in 40s', reward:420 })},
  { id:'bandits',title:'⚔️ THE SANDWICH BANDITS',
    flavor:'They took my lucky BLT. This is EXTREMELY personal.',
    gen: ()=>({type:'kill', target:4, obj:'Defeat 4 bandits in the forest', reward:500 })},
  { id:'ghost',  title:'👻 PIRATE GHOST TREASURE',
    flavor:"Arr — I buried me gold somewhere obvious. Very obvious.",
    gen: ()=>({type:'reach', dest:{x:75,z:195}, timer:90, obj:'Find the treasure on the beach pier', reward:780 })},
  { id:'airshow',title:'✈️ UNAUTHORIZED AIRSHOW',
    flavor:'The crowd is gathering. You have 55 seconds. Fly fast.',
    gen: ()=>({type:'fly', timer:55, obj:'Fly the plane over the city at altitude', reward:650 })},
  { id:'cat',    title:"🐱 THE MAYOR'S CAT",
    flavor:'He has a tiny briefcase. Do NOT ask what\'s in it.',
    gen: ()=>({type:'reach', dest:{x:-42,z:-42}, timer:50, obj:"Chase the mayor's cat to the park", reward:280 })},
  { id:'horse',  title:'🐴 HORSE ON THE ROOF',
    flavor:"Don't ask how it got there. Just get it down. Please.",
    gen: ()=>({type:'altitude', minY:12, timer:80, obj:'Find the rooftop horse (get 12m altitude)', reward:380 })},
];

export class QuestSystem {
  constructor(scene, player) {
    this.scene    = scene;
    this.player   = player;
    this.active   = null;
    this.completed= 0;
    this._objects = [];
    this._killCount=0;
    this.onComplete = null; // (reward, title) => void
    this.onFail     = null; // () => void
  }

  assign(npc) {
    if (this.active || !npc.pendingQuest) return false;
    const q = npc.pendingQuest;
    this.active = { ...q.gen(), title:q.title, flavor:q.flavor, id:q.id, reward:q.reward, count:0 };
    if (this.active.timer) this.active.timerLeft = this.active.timer;
    this._spawnMarkers();
    if (npc.indicator) { this.scene.remove(npc.indicator); npc.indicator=null; }
    npc.questGiven=true; npc.hasQuest=false; npc.pendingQuest=null;
    return true;
  }

  _spawnMarkers() {
    this._clearObjects();
    const q = this.active;
    const markerMat = new THREE.MeshLambertMaterial({color:0x00ffcc, emissive:0x00aa88});
    const ringMat   = new THREE.MeshLambertMaterial({color:0x00ffcc, emissive:0x00aa88, transparent:true, opacity:0.6});
    if (q.type === 'collect') {
      const rng = mulberry32(Date.now());
      for (let i=0;i<q.target;i++) {
        const x=(rng()-.5)*120, z=(rng()-.5)*120;
        const m=new THREE.Mesh(new THREE.SphereGeometry(0.38,8,8),new THREE.MeshLambertMaterial({color:0xffdd00,emissive:0x886600}));
        m.position.set(x, getHeight(x,z)+0.9, z); this.scene.add(m);
        const ring=new THREE.Mesh(new THREE.TorusGeometry(0.6,0.08,6,16),ringMat);
        ring.rotation.x=Math.PI/2; ring.position.set(x,getHeight(x,z)+0.5,z); this.scene.add(ring);
        this._objects.push({mesh:m, ring, type:'collectible',x,z,done:false});
      }
    }
    if (q.dest) {
      const {x,z} = q.dest;
      const h = getHeight(x,z);
      const marker=new THREE.Mesh(new THREE.CylinderGeometry(0.6,2.8,0.22,16),markerMat);
      marker.position.set(x,h+0.1,z); this.scene.add(marker);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(3.5,0.18,8,28),ringMat);
      ring.rotation.x=Math.PI/2; ring.position.set(x,h+0.6,z); this.scene.add(ring);
      this._objects.push({mesh:marker,ring,type:'dest',x,z});
    }
    this._killCount=0;
  }

  _clearObjects() {
    this._objects.forEach(o=>{ this.scene.remove(o.mesh); if(o.ring) this.scene.remove(o.ring); });
    this._objects=[];
  }

  onKill() {
    if (!this.active || this.active.type!=='kill') return;
    this._killCount++;
    this.active.count = this._killCount;
    if (this._killCount >= this.active.target) this.complete();
  }

  update(dt, player) {
    if (!this.active) return;
    const q = this.active;
    if (q.timerLeft !== undefined) {
      q.timerLeft -= dt;
      if (q.timerLeft <= 0) { this._fail(); return; }
    }
    // Animate markers
    this._objects.forEach(o => {
      if (o.ring) o.ring.rotation.z += dt*1.4;
      if (o.type==='collectible' && !o.done) o.mesh.rotation.y += dt*2.2;
    });
    const pp = player.position;
    // Collect items
    if (q.type==='collect') {
      this._objects.forEach(o=>{
        if(o.done) return;
        if(Math.hypot(pp.x-o.x,pp.z-o.z)<2.8){
          o.done=true; this.scene.remove(o.mesh); if(o.ring) this.scene.remove(o.ring);
          q.count++; if(q.count>=q.target) this.complete();
        }
      });
    }
    // Reach destination
    if (q.type==='reach' && q.dest) {
      if (Math.hypot(pp.x-q.dest.x,pp.z-q.dest.z)<9) this.complete();
    }
    // Fly mission
    if (q.type==='fly') {
      const v = player.inVehicle;
      if (v?.type==='plane' && v.speed>60 && v.y>18) this.complete();
    }
    // Altitude mission
    if (q.type==='altitude') {
      if (pp.y > q.minY) this.complete();
    }
  }

  complete() {
    if (!this.active) return;
    const r = this.active.reward;
    this.player.money += r;
    this.completed++;
    this._clearObjects();
    const title = this.active.title;
    this.active = null;
    if (this.onComplete) this.onComplete(r, title);
    return { title, reward: r };
  }

  _fail() {
    this._clearObjects();
    this.active = null;
    if (this.onFail) this.onFail();
    return 'fail';
  }

  assignRandom(npcs) {
    const q = POOL[Math.floor(Math.random()*POOL.length)];
    const free = npcs.filter(n=>n.type==='quest'&&!n.questGiven&&!n.pendingQuest);
    if (free.length===0) return;
    const npc = free[Math.floor(Math.random()*free.length)];
    npc.pendingQuest = q;
    npc.hasQuest = true;
  }
}

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
