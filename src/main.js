import * as THREE from 'three';
import { Game }           from './core/Game.js';
import { Input }          from './systems/Input.js';
import { Particles }      from './systems/Particles.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { WorldEvents }    from './systems/WorldEvents.js';
import { Terrain }        from './world/Terrain.js';
import { Lighting }       from './world/Lighting.js';
import { City }           from './world/City.js';
import { Environment }    from './world/Environment.js';
import { Player }         from './player/Player.js';
import { CameraController} from './player/Camera.js';
import { VehicleSystem }  from './vehicles/VehicleSystem.js';
import { ActivitySystem } from './activities/ActivitySystem.js';
import { NPCSystem }      from './npcs/NPCSystem.js';
import { QuestSystem }    from './quests/QuestSystem.js';
import { CombatSystem }   from './combat/CombatSystem.js';
import { PoliceSystem }   from './systems/PoliceSystem.js';
import { AudioSystem }    from './audio/AudioSystem.js';
import { HUD }            from './hud/HUD.js';
import { Minimap }        from './hud/Minimap.js';

// ── Globals ────────────────────────────────────────────────────
const game      = new Game();
const input     = new Input();
const audio     = new AudioSystem();
const particles = new Particles(game.scene);

// World
const terrain   = new Terrain(game.scene);
const lighting  = new Lighting(game.scene, game.renderer);
const collision = new CollisionSystem();
const city      = new City(game.scene, collision);
const env       = new Environment(game.scene);

// Player
const player    = new Player(game.scene, collision);
const cam       = new CameraController(game.camera);

// Systems
const vehicles  = new VehicleSystem(game.scene, collision);
const activity  = new ActivitySystem(player, game.scene);
const npcs      = new NPCSystem(game.scene);
const quests    = new QuestSystem(game.scene, player);
const combat    = new CombatSystem(game.scene, player, particles);
const hud       = new HUD();
const minimap   = new Minimap();
const worldEvt  = new WorldEvents(game.scene, hud, particles);
const police    = new PoliceSystem(game.scene, player, hud, audio);

// Spawn vehicles
vehicles.spawn('car',   30, -18, 0xff3333);
vehicles.spawn('car',  -42,  14, 0x3355ff);
vehicles.spawn('car',   58,  36, 0xffaa00);
vehicles.spawn('car',  -20, -55, 0x22cc44);
vehicles.spawn('bike',  18,  48, 0x111122);
vehicles.spawn('bike', -55,  28, 0x882200);
vehicles.spawn('horse',-82, -28);
vehicles.spawn('horse', 42, -75);
vehicles.spawn('plane',  0,-188, 0xdddddd);

// First quest after 4s
setTimeout(() => quests.assignRandom(npcs.list), 4000);

// ── Quest callbacks ─────────────────────────────────────────────
quests.onComplete = (reward, title) => {
  player.addXP(120);
  hud.notify(`✅ ${title}\nCOMPLETE! +$${reward}  +120 XP`, 4.5);
  audio.quest();
  setTimeout(() => quests.assignRandom(npcs.list), 12000);
};
quests.onFail = () => {
  hud.notify('❌ MISSION FAILED', 3);
  audio.fail();
  setTimeout(() => quests.assignRandom(npcs.list), 10000);
};

// ── Player callbacks ────────────────────────────────────────────
player.onDamage = (amt) => {
  cam.addShake(amt * 0.016);
  hud.hitFlash();
};
player.onLevelUp = (level) => {
  hud.notify(`⬆️ LEVEL UP! You are now Level ${level}`, 4);
  audio.levelUp();
};

// ── Power surge hook (used by WorldEvents) ──────────────────────
window._powerSurge = () => {
  const flash = document.getElementById('hit-flash');
  if (!flash) return;
  flash.style.background = '#ffff00';
  flash.style.opacity = '0.35';
  setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => { flash.style.background = '#ff0000'; }, 300); }, 180);
};

// ── Input bindings ─────────────────────────────────────────────
let shopOpen = false;
window._closeShop = () => { document.getElementById('shop').style.display='none'; shopOpen=false; input.lock(game.canvas); };

window.addEventListener('keydown', e => {
  if (e.key === ' ') { player.jump(audio); e.preventDefault(); }

  if (e.key === 'e' || e.key === 'E') {
    if (shopOpen) return;
    const nearV = vehicles.nearest(player.x, player.z);
    if (nearV && !player.inVehicle) { vehicles.enter(nearV, player); hud.notify(`Entered ${nearV.type.toUpperCase()} — F to exit`); return; }
    const nearN = npcs.nearest(player.x, player.z);
    if (nearN) {
      if (nearN.type === 'shopkeeper') { openShop(); return; }
      if (nearN.type === 'quest' && nearN.pendingQuest && !quests.active) {
        const ok = quests.assign(nearN);
        if (ok) { hud.notify(`📋 MISSION: ${quests.active?.title || ''}\n"${nearN.dialogue}"`); audio.quest(); return; }
      }
      hud.notify(`💬 "${nearN.dialogue}"`); audio.notif();
      return;
    }
    if (activity.mode === 'fish') {
      const catch_ = activity.reelIn();
      if (catch_) { hud.notify(`🎣 CAUGHT: ${catch_}`); player.addXP(15); audio.pickup(); }
      else hud.notify('No bite yet... wait for it.');
      return;
    }
    if (activity._nearWater() && !player.inVehicle) { activity.setMode('fish'); hud.notify('🎣 Started fishing! Press E to reel in.'); return; }
  }

  if ((e.key === 'f' || e.key === 'F') && player.inVehicle) {
    vehicles.exit(player);
    hud.notify('Exited vehicle');
  }

  if (e.key === 'q' || e.key === 'Q') {
    if (!player.inVehicle) {
      const next = activity.mode === 'skate' ? 'walk' : 'skate';
      activity.setMode(next);
      hud.notify(next==='skate' ? '🛹 Skate mode ON' : '🚶 Walking');
    }
  }

  if (e.key === 'Escape') { if(shopOpen) window._closeShop(); }
});

window.addEventListener('mousedown', e => {
  if (!input.locked || shopOpen) return;
  if (e.button === 0) {
    if (player.weapon==='pistol' && player.ammo>0) {
      const fired = combat.shoot(game.camera);
      if (fired) {
        audio.shoot();
        const nearN = npcs.nearest(player.x, player.z);
        if (nearN && nearN.type==='citizen') { player.wanted = Math.min(5, player.wanted+1); hud.notify('🚔 WANTED +1'); }
        if (police.isNearUnit(player.x, player.z, 6)) { player.wanted = Math.min(5, player.wanted+2); hud.notify('🚔 WANTED +2 — Attacking police!'); }
      } else { hud.notify('No ammo!'); }
    } else {
      combat.punch(game.camera);
      audio.punch();
      const nearN = npcs.nearest(player.x, player.z);
      if (nearN && nearN.type==='citizen') { player.wanted = Math.min(5, player.wanted+1); hud.notify('🚔 WANTED +1'); }
      if (police.isNearUnit(player.x, player.z, 4)) { player.wanted = Math.min(5, player.wanted+2); hud.notify('🚔 WANTED +2 — Attacking police!'); }
    }
  }
});

function openShop() {
  document.getElementById('shop').style.display='flex';
  input.unlock(); shopOpen=true;
}

window.buyItem = (item) => {
  const prices = { health:100, pistol:250, sword:350, bike:500 };
  const p = prices[item];
  if (player.money < p) { hud.notify('Not enough money!'); return; }
  player.money -= p;
  if (item==='health') { player.heal(55); hud.notify('❤️ +55 HP'); audio.pickup(); }
  if (item==='pistol') { player.weapon='pistol'; player.ammo=24; hud.notify('🔫 Pistol — 24 rounds'); audio.pickup(); }
  if (item==='sword')  { player.weapon='sword'; hud.notify('⚔️ Sword equipped'); audio.pickup(); }
  if (item==='bike')   { vehicles.spawn('bike',player.x+3,player.z,0x882200); hud.notify('🏍️ Bike spawned!'); audio.coin(); }
};

// ── Prompt check ───────────────────────────────────────────────
function checkPrompt() {
  if (player.inVehicle) { hud.prompt('[ F ]  Exit vehicle'); return; }
  const nearV = vehicles.nearest(player.x, player.z);
  if (nearV) { hud.prompt(`[ E ]  Enter ${nearV.type.toUpperCase()}`); return; }
  const nearN = npcs.nearest(player.x, player.z);
  if (nearN) {
    if (nearN.type==='shopkeeper') { hud.prompt('[ E ]  Open Shop'); return; }
    if (nearN.hasQuest) { hud.prompt(`[ E ]  ${nearN.dialogue.substring(0,48)}…`); return; }
    hud.prompt('[ E ]  Talk'); return;
  }
  if (activity._nearWater() && !player.inVehicle && activity.mode!=='fish') { hud.prompt('[ E ]  Go fishing 🎣'); return; }
  if (activity.mode==='fish') { hud.prompt('[ E ]  Reel in!'); return; }
  hud.prompt('');
}

// ── Respawn ────────────────────────────────────────────────────
function respawn() {
  player.hp = player.maxHp; player.dead = false;
  player.wanted = 0; police.clear();
  player.x=8; player.y=3; player.z=8; player.vx=0; player.vz=0;
  player.mesh.visible=true; player.invTimer=2.5;
  document.getElementById('death').style.opacity='0';
  setTimeout(()=>document.getElementById('death').style.display='none', 600);
  hud.notify('Respawned. Try not to die again.');
}

// ── Zone tracking for ambient audio ────────────────────────────
let _lastZone = '';
function getZone() {
  const { x, z } = player;
  if (Math.abs(x) < 110 && Math.abs(z) < 110) return 'city';
  if (z > 145) return 'beach';
  if (x < -100) return 'forest';
  return 'plain';
}

// ── Game loop ──────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const dt   = Math.min(game.clock.getDelta(), 0.05);
  const time = game.clock.elapsedTime;

  input.update();

  if (input.mouse.dx || input.mouse.dy) cam.applyMouse(input.mouse.dx, input.mouse.dy);

  const dayFrac = lighting.update(dt);
  game.setDayFrac(dayFrac);
  city.update(dayFrac);
  env.update(time);

  if (!player.dead) {
    player.update(dt, input, cam.yaw);
    if (audio._ready && player.onGround && player.speed > 0.8 && !player.inVehicle)
      audio.footstep();
  }

  // Ambient zone cross-fade
  const zone = getZone();
  if (zone !== _lastZone) { audio.setZone(zone); _lastZone = zone; }

  vehicles.update(dt, time, input, audio);

  // Vehicle dust + exhaust particles
  if (vehicles.active) {
    const v = vehicles.active;
    const spd = Math.abs(v.speed);
    if ((v.type==='car' || v.type==='bike') && spd > 6) {
      if (Math.random() < spd * 0.025)
        particles.dust(new THREE.Vector3(v.x, v.y - 0.3, v.z), 0x887766, 3, 2.2);
      if ((input.is('w')||input.is('s')) && Math.random() < 0.12)
        particles.exhaust(new THREE.Vector3(v.x - Math.sin(v.angle)*3.5, v.y + 0.4, v.z - Math.cos(v.angle)*3.5));
    }
  }
  activity.update(dt, time, input, audio);
  npcs.update(dt, time, player);
  combat.update(dt, quests);
  quests.update(dt, player);
  police.update(dt, time);
  particles.update(dt);
  worldEvt.update(dt, player);

  // Sync player to vehicle
  if (player.inVehicle) {
    const v = player.inVehicle;
    player.x=v.x; player.y=v.y+1.8; player.z=v.z;
  }

  checkPrompt();
  cam.update(dt, player, vehicles.active);
  hud.update(player, vehicles, activity, quests, dt);
  minimap.update(player, vehicles, npcs, combat, police);

  // Death screen
  if (player.dead && !document.getElementById('death').style.display.includes('flex')) {
    document.getElementById('death').style.display='flex';
    document.getElementById('death').style.opacity='1';
    setTimeout(respawn, 3000);
  }

  game.render();
}

// ── Start ──────────────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', () => {
  audio.init();
  const overlay = document.getElementById('overlay');
  overlay.style.opacity='0';
  setTimeout(()=>overlay.style.display='none', 900);
  input.lock(game.canvas);
  animate();
});
