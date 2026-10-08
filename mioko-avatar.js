/* Anime portrait: drawn mouth and eyelids; no photographic face deformation. */
(() => {
  const portrait = document.querySelector('.miokoVideoPortrait');
  if (!portrait) return;
  const canvas = document.createElement('canvas');
  canvas.className = portrait.className;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', portrait.alt);
  const ctx = canvas.getContext('2d');
  const photo = new Image();
  let mouth = 0, frame = 0, nextBlink = performance.now() + 3500, blinkStart = 0, lastDraw = 0;
  function ellipse(x,y,rx,ry,color) {
    ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
  }
  function draw(now, still = false) {
    if (!photo.naturalWidth) return;
    if (!still && now-lastDraw < 33) { frame=requestAnimationFrame(draw); return; }
    lastDraw=now;
    ctx.clearRect(0,0,1024,1536); ctx.drawImage(photo,0,0,1024,1536);
    if (mouth > .025) {
      // Overlay covers only the illustrated lips, never the nose or cheeks.
      ellipse(510,536,46,16,'#f9c2ac');
      const h=7+mouth*29, w=30+mouth*12;
      ellipse(510,537,w+2,h+2,'#ab5961');
      ellipse(510,537,w,h,'#482029');
      ctx.save(); ctx.beginPath();ctx.ellipse(510,537,w,h,0,0,Math.PI*2);ctx.clip();
      ctx.fillStyle='#fff0e4';ctx.fillRect(510-w,537-h,w*2,Math.min(12,h*.5));
      ellipse(510,537+h*.72,w*.66,h*.32,'#d97989');ctx.restore();
    }
    if (!still && now>=nextBlink && !blinkStart) blinkStart=now;
    if (blinkStart && !still) {
      const t=(now-blinkStart)/180;
      if(t>=1){blinkStart=0;nextBlink=now+3500+Math.random()*3500;}
      else if(t>.18 && t<.82){
        for(const [x,y] of [[428,412],[576,410]]){
          ellipse(x,y,49,27,'#f4bca6');ctx.beginPath();ctx.moveTo(x-43,y);ctx.quadraticCurveTo(x,y+20,x+43,y-1);ctx.strokeStyle='#442628';ctx.lineWidth=5;ctx.stroke();
        }
      }
    }
    if(!still) frame=requestAnimationFrame(draw);
  }
  photo.onload=()=>{canvas.width=512;canvas.height=768;ctx.setTransform(.5,0,0,.5,0,0);portrait.replaceWith(canvas);frame=requestAnimationFrame(draw);};
  photo.src=portrait.src;
  window.MiokoAvatar={
    setMouth(value){mouth=Math.max(0,Math.min(1,Number(value)||0));canvas.dataset.mouth=String(mouth);},
    closeMouth(){mouth=0;canvas.dataset.mouth='0';draw(performance.now(),true);}
  };
  window.addEventListener('pagehide',()=>{mouth=0;cancelAnimationFrame(frame);});
  window.addEventListener('pageshow',()=>{if(photo.complete){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}});
})();
