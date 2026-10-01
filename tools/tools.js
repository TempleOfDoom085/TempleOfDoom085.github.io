/* Shared chrome for Temple Tools pages: gold cursor trail + click burst. */
(function(){
  const c = document.getElementById('cursor');
  if(!c) return;
  let t = 0;
  document.addEventListener('mousemove', e => {
    c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
    const now = Date.now();
    if(now - t > 40){ t = now;
      const p = document.createElement('div'); p.className = 'cursor-trail';
      p.style.left = e.clientX + 'px'; p.style.top = e.clientY + 'px';
      document.body.appendChild(p); setTimeout(() => p.remove(), 560);
    }
  });
  document.addEventListener('mouseleave', () => c.style.opacity = '0');
  document.addEventListener('mouseenter', () => c.style.opacity = '1');
  document.querySelectorAll('a,button,[role="button"]').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
})();

/* ── GOLD PARTICLE BURST ON CLICK ─────────────────────────────────────── */
(function(){
  var COLORS = ['rgba(184,147,58,0.95)','rgba(212,180,88,0.9)','rgba(255,215,80,0.85)','rgba(201,168,76,0.8)'];
  document.addEventListener('click', function(e){
    var N = 20;
    for(var i = 0; i < N; i++){
      (function(i){
        var s = document.createElement('div');
        var angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
        var speed = 50 + Math.random() * 80;
        var size  = 2 + Math.random() * 4;
        var color = COLORS[Math.floor(Math.random() * COLORS.length)];
        s.style.cssText = 'position:fixed;pointer-events:none;z-index:99997;border-radius:50%;'
          + 'width:' + size + 'px;height:' + size + 'px;'
          + 'background:' + color + ';'
          + 'left:' + e.clientX + 'px;top:' + e.clientY + 'px;'
          + 'transform:translate(-50%,-50%);transition:none;';
        document.body.appendChild(s);
        var vx = Math.cos(angle) * speed;
        var vy = Math.sin(angle) * speed;
        var dur = 500 + Math.random() * 300;
        var start = null;
        function step(ts){
          if(!start) start = ts;
          var p = (ts - start) / dur;
          if(p >= 1){ s.remove(); return; }
          s.style.left = (e.clientX + vx * p) + 'px';
          s.style.top  = (e.clientY + vy * p + 120 * p * p) + 'px';
          s.style.opacity = 1 - p;
          s.style.width  = (size * (1 - p * 0.5)) + 'px';
          s.style.height = (size * (1 - p * 0.5)) + 'px';
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      })(i);
    }
  });
})();
