import * as THREE from 'three';
import { Game }           from './core/Game.js';
import { Input }          from './systems/Input.js';
import { Particles }      from './systems/Particles.js';
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
const lighting  = new Lighting(game.scene);
const city      = new City(game.scene);
const env       = new Environment(game.scene);

// Player
const player    = new Player(game.scene);
const cam       = new CameraController(game.camera);

// Systems
const vehicles  = new VehicleSystem(game.scene);
const activity  = new ActivitySystem(player, game.scene);
const npcs      = new NPCSystem(game.scene);
const quests    = new QuestSystem(game.scene, player);
const combat    = new CombatSystem(game.scene, player, particles);
const hud       = new HUD();
const minimap   = new Minimap();

// Spawn vehicles
vehicles.spawn('car',   30, -18, 0xff3333);
vehicles.spawn('car',  -42,  14, 0x3355ff);
vehicles.spawn('car',   58,  36, 0xffaa00);
vehicles.spawn('car',  -20, -55, 0x22cc44);
vehicles.spawn('bike',  18,  48, 0x111122);
vehicles.spawn('bike', -55,  28, 0x882200);
vehicles.spawn('horse',-82, -28);
vehicles.spawn('horse', 42, -75);
vehicles.spawn('plane',  0,-188, 0xdddddd); // on runway

// Assign first quest after 4s
setTimeout(() => quests.assignRandom(npcs.list), 4000);

// ── Input bindings ─────────────────────────────────────────────
let shopOpen = false;
window._closeShop = () => { document.getElementById('shop').style.display='none'; shopOpen=false; input.lock(game.canvas); };

window.addEventListener('keydown', e => {
  if (e.key === ' ') { player.jump(audio); e.preventDefault(); }

  if (e.key === 'e' || e.key === 'E') {
    if (shopOpen) return;
    // Interact priority: vehicle > NPC > fish reel
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
      if (catch_) { hud.notify(`🎣 CAUGHT: ${catch_}`); audio.pickup(); }
      else hud.notify('No bite yet... wait for it.');
      return;
    }
    if (activity._nearWater() && !player.inVehicle) { activity.setMode('fish'); hud.notify('🎣 Started fishing! Press E to reel in.'); return; }
  }

  if ((e.key === 'f' || e.key === 'F') && player.inVehicle) {
    vehicles.exit(player);
    hud.notify('Exited vehicle');
  }

  if (e.key === 'q' || e.key === 'Q') { // Skate toggle
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
      if (fired) audio.shoot();
      else hud.notify('No ammo!');
    } else {
      combat.punch(game.camera);
      audio.punch();
    }
  }
});

function openShop() {
  document.getElementById('shop').style.display='flex';
  input.unlock(); shopOpen=true;
}

// Shop buy
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
  player.x=8; player.y=3; player.z=8; player.vx=0; player.vz=0;
  player.mesh.visible=true; player.invTimer=2.5;
  document.getElementById('death').style.opacity='0';
  setTimeout(()=>document.getElementById('death').style.display='none', 600);
  hud.notify('Respawned. Try not to die again.');
}

// ── Game loop ──────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const dt   = Math.min(game.clock.getDelta(), 0.05);
  const time = game.clock.elapsedTime;

  input.update();

  // Mouse look
  if (input.mouse.dx || input.mouse.dy) cam.applyMouse(input.mouse.dx, input.mouse.dy);

  const dayFrac = lighting.update(dt);
  game.setDayFrac(dayFrac);

  if (!player.dead) {
    player.update(dt, input, cam.yaw);
    if (audio._ready) audio.footstep();
  }

  vehicles.update(dt, time, input, audio);
  activity.update(dt, time, input, audio);
  npcs.update(dt, time);
  combat.update(dt, quests);
  quests.update(dt, player);
  particles.update(dt);

  // Quest complete / fail callbacks
  if (quests.active === null && quests._prevActive) {
    setTimeout(() => quests.assignRandom(npcs.list), 12000);
  }
  quests._prevActive = quests.active;

  // Sync player position when in vehicle
  if (player.inVehicle) {
    const v = player.inVehicle;
    player.x=v.x; player.y=v.y+1.8; player.z=v.z;
  }

  checkPrompt();
  cam.update(dt, player, vehicles.active);
  hud.update(player, vehicles, activity, quests, dt);
  minimap.update(player, vehicles, npcs, combat);

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
