// Page-to-page particle dissolve transitions — site-wide
(function(){
  'use strict';
  if(typeof document==='undefined')return;

  var cvs=document.createElement('canvas');
  cvs.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99997;';
  document.body.appendChild(cvs);
  var ctx=cvs.getContext('2d');
  function resize(){cvs.width=window.innerWidth;cvs.height=window.innerHeight;}
  resize();window.addEventListener('resize',resize);

  var particles=[];
  function spawnBurst(x,y,n){
    n=n||80;
    for(var i=0;i<n;i++){
      var ang=Math.random()*Math.PI*2,spd=1.5+Math.random()*9;
      var hue=Math.random()<.5?(185+Math.random()*35):(255+Math.random()*30);
      particles.push({x:x,y:y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
        life:1.,decay:.018+Math.random()*.038,sz:1.5+Math.random()*5.5,hue:hue});
    }
  }

  var rafId=null;
  function loop(){
    ctx.clearRect(0,0,cvs.width,cvs.height);
    for(var i=particles.length-1;i>=0;i--){
      var p=particles[i];
      p.x+=p.vx;p.y+=p.vy;p.vx*=.91;p.vy*=.91;p.vy+=.12;p.life-=p.decay;
      if(p.life<=0){particles.splice(i,1);continue;}
      ctx.beginPath();ctx.arc(p.x,p.y,p.sz*p.life,0,Math.PI*2);
      ctx.fillStyle='hsla('+p.hue+',100%,65%,'+(p.life*.78)+')';ctx.fill();
    }
    if(particles.length>0)rafId=requestAnimationFrame(loop);
    else{rafId=null;ctx.clearRect(0,0,cvs.width,cvs.height);}
  }

  // Intercept same-origin link clicks
  document.addEventListener('click',function(e){
    var link=e.target.closest('a[href]');
    if(!link)return;
    var href=link.getAttribute('href');
    if(!href||href.charAt(0)==='#'||/^(https?:)?\/\//.test(href)||href.indexOf('mailto')===0)return;

    e.preventDefault();
    var cx=e.clientX||cvs.width/2,cy=e.clientY||cvs.height/2;
    spawnBurst(cx,cy,90);
    if(!rafId)loop();

    // Full-page fade out
    document.body.style.transition='opacity 0.32s ease';
    document.body.style.opacity='0';
    setTimeout(function(){window.location.href=href;},340);
  });

  // Entrance: fade in from black
  document.body.style.opacity='0';
  document.body.style.transition='none';
  window.addEventListener('DOMContentLoaded',function(){
    setTimeout(function(){
      document.body.style.transition='opacity 0.55s ease';
      document.body.style.opacity='1';
    },40);
  });
  // Fallback if DOMContentLoaded already fired
  if(document.readyState!=='loading'){
    setTimeout(function(){
      document.body.style.transition='opacity 0.55s ease';
      document.body.style.opacity='1';
    },40);
  }
})();
