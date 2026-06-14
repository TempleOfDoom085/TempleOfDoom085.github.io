// Particle trail cursor — injected site-wide
(function(){
  'use strict';
  if(typeof document==='undefined')return;
  var N=22;
  var pts=[];
  var mx=window.innerWidth/2,my=window.innerHeight/2;
  for(var i=0;i<N;i++)pts.push({x:mx,y:my});

  var cvs=document.createElement('canvas');
  cvs.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  document.body.appendChild(cvs);
  var ctx=cvs.getContext('2d');

  function resize(){cvs.width=window.innerWidth;cvs.height=window.innerHeight;}
  resize();
  window.addEventListener('resize',resize);
  window.addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY;});

  function tick(){
    ctx.clearRect(0,0,cvs.width,cvs.height);

    // Chain: each point follows the one ahead of it
    pts[0].x+=(mx-pts[0].x)*.30;
    pts[0].y+=(my-pts[0].y)*.30;
    for(var i=1;i<N;i++){
      pts[i].x+=(pts[i-1].x-pts[i].x)*.35;
      pts[i].y+=(pts[i-1].y-pts[i].y)*.35;
    }

    // Draw trail
    for(var j=N-1;j>=0;j--){
      var life=(N-j)/N;
      var sz=life*3.5;
      var r=Math.round(60+life*100);
      var g=Math.round(life*50);
      var b=Math.round(180+life*70);
      ctx.beginPath();
      ctx.arc(pts[j].x,pts[j].y,sz,0,Math.PI*2);
      ctx.fillStyle='rgba('+r+','+g+','+b+','+(life*.60)+')';
      ctx.fill();
    }

    // Cursor dot
    ctx.beginPath();
    ctx.arc(mx,my,2,0,Math.PI*2);
    ctx.fillStyle='rgba(0,220,255,0.95)';
    ctx.fill();

    requestAnimationFrame(tick);
  }
  tick();
})();
