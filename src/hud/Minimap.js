export class Minimap {
  constructor() {
    this.canvas = document.getElementById('minimap');
    this.ctx    = this.canvas.getContext('2d');
    this.D      = 160;
    this.scale  = this.D / 440;
  }

  _w(x) { return x * this.scale + this.D / 2; }
  _h(z) { return z * this.scale + this.D / 2; }

  update(player, vehicleSystem, npcSystem, combatSystem) {
    const { ctx, D } = this;
    ctx.clearRect(0, 0, D, D);
    // Background
    ctx.fillStyle = 'rgba(8,14,8,0.88)';
    ctx.fillRect(0,0,D,D);
    // City grid lines
    ctx.strokeStyle='rgba(60,64,80,0.5)'; ctx.lineWidth=1;
    [-84,-56,-28,0,28,56,84].forEach(s=>{
      ctx.beginPath(); ctx.moveTo(this._w(s),0); ctx.lineTo(this._w(s),D); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,this._h(s)); ctx.lineTo(D,this._h(s)); ctx.stroke();
    });
    // Forest zone
    ctx.fillStyle='rgba(20,70,20,0.35)'; ctx.fillRect(0,0,this._w(-120),D);
    // Ocean zone
    ctx.fillStyle='rgba(15,55,110,0.45)'; ctx.fillRect(0,this._h(168),D,D);
    // NPCs
    npcSystem.list.forEach(n=>{
      const mx=this._w(n.x),mz=this._h(n.z);
      ctx.fillStyle = n.type==='quest'?'#ffdd00':n.type==='shopkeeper'?'#00ddff':'rgba(200,200,200,0.35)';
      ctx.beginPath(); ctx.arc(mx,mz,n.type==='citizen'?1.2:3,0,Math.PI*2); ctx.fill();
    });
    // Vehicles
    vehicleSystem.list.forEach(v=>{
      const mx=this._w(v.x),mz=this._h(v.z);
      ctx.fillStyle = v.type==='plane'?'#aaddff':v.type==='horse'?'#cc8844':'#ff6644';
      ctx.beginPath(); ctx.arc(mx,mz,3.5,0,Math.PI*2); ctx.fill();
    });
    // Enemies
    combatSystem.enemies.forEach(e=>{
      if(!e.alive) return;
      ctx.fillStyle='#ff3333';
      ctx.beginPath(); ctx.arc(this._w(e.x),this._h(e.z),2.5,0,Math.PI*2); ctx.fill();
    });
    // Player
    const px=this._w(player.x),pz=this._h(player.z);
    ctx.fillStyle='#00ff88';
    ctx.beginPath(); ctx.arc(px,pz,5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(px,pz,5,0,Math.PI*2); ctx.stroke();
    // Border
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
    ctx.strokeRect(0,0,D,D);
  }
}
