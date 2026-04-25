export class HUD {
  constructor() {
    this._notifTimer = 0;
    this._notifEl   = document.getElementById('notif');
    this._promptEl  = document.getElementById('prompt');
  }

  update(player, vehicleSystem, activitySystem, questSystem, dt) {
    // HP
    document.getElementById('hp-fill').style.width = (player.hp / player.maxHp * 100) + '%';
    // Money
    document.getElementById('money').textContent = `$${player.money}`;
    // Wanted
    document.getElementById('wanted').textContent = '⭐'.repeat(player.wanted) + '☆'.repeat(Math.max(0, 5-player.wanted));
    // Vehicle / activity
    const veh = vehicleSystem.active;
    if (veh) {
      document.getElementById('mode').textContent = veh.type.toUpperCase();
      document.getElementById('speed').textContent = Math.round(Math.abs(veh.speed)) + ' MPH';
    } else {
      document.getElementById('mode').textContent  = activitySystem.label;
      document.getElementById('speed').textContent = '';
    }
    // Ammo
    document.getElementById('ammo').textContent = player.weapon==='pistol' ? `🔫 ${player.ammo}` : player.weapon==='sword' ? '⚔️' : '👊';
    // Quest
    this._updateQuest(questSystem);
    // Notif timer
    if (this._notifTimer > 0) {
      this._notifTimer -= dt;
      if (this._notifTimer <= 0) this._notifEl.style.opacity = '0';
    }
  }

  _updateQuest(qs) {
    const q = qs.active;
    document.getElementById('quest-title').textContent = q ? q.title : 'OPEN WORLD';
    document.getElementById('quest-obj').textContent   = q ? q.obj + (q.count!==undefined ? ` (${q.count}/${q.target})` : '') : 'Find 🟡 NPCs for missions.';
    document.getElementById('quest-timer').textContent = q?.timerLeft ? `⏱ ${Math.ceil(q.timerLeft)}s` : '';
  }

  notify(msg, duration = 3.5) {
    this._notifEl.textContent = msg;
    this._notifEl.style.opacity = '1';
    this._notifTimer = duration;
  }

  prompt(msg) {
    this._promptEl.textContent = msg;
    this._promptEl.style.opacity = msg ? '1' : '0';
  }
}
