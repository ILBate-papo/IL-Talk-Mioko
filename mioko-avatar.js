/* Photographic avatar: mouth driven only by the audio analyser. */
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
  // Coordinates belong to the approved 1080 × 1456 portrait. The original file is unchanged.
  const patch = document.createElement('canvas');
  patch.width = 220; patch.height = 140;
  const pc = patch.getContext('2d');
  function deform(cx, cy, angle, width, height, scale) {
    pc.clearRect(0, 0, 220, 140);
    pc.save(); pc.translate(110, 70); pc.rotate(-angle);
    pc.drawImage(photo, -cx, -cy); pc.restore();
    pc.globalCompositeOperation = 'destination-in';
    const mask = pc.createRadialGradient(110, 70, 12, 110, 70, width / 2);
    mask.addColorStop(0, '#000'); mask.addColorStop(.65, '#000'); mask.addColorStop(1, 'transparent');
    pc.save(); pc.translate(110, 70); pc.scale(1, height / width);
    pc.fillStyle = mask; pc.translate(-110, -70); pc.fillRect(0, 0, 220, 140); pc.restore();
    pc.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle); ctx.scale(1, scale);
    ctx.drawImage(patch, -110, -70); ctx.restore();
  }
  function draw(now) {
    if (now - lastDraw < 33) { frame = requestAnimationFrame(draw); return; }
    lastDraw = now;
    ctx.clearRect(0, 0, photo.naturalWidth, photo.naturalHeight);
    ctx.drawImage(photo, 0, 0);
    if (mouth > .01) deform(482, 397, -.40, 188, 116, 1 + mouth * .65);
    if (now >= nextBlink && !blinkStart) blinkStart = now;
    if (blinkStart) {
      const t = (now - blinkStart) / 180;
      if (t >= 1) { blinkStart = 0; nextBlink = now + 3500 + Math.random() * 3000; }
      else {
        const scale = 1 - Math.sin(t * Math.PI) * .88;
        deform(380, 306, -.35, 110, 50, scale);
        deform(494, 264, -.35, 110, 50, scale);
      }
    }
    frame = requestAnimationFrame(draw);
  }
  photo.onload = () => {
    canvas.width = Math.min(540, photo.naturalWidth); canvas.height = Math.round(canvas.width * photo.naturalHeight / photo.naturalWidth);
    ctx.setTransform(canvas.width / photo.naturalWidth, 0, 0, canvas.height / photo.naturalHeight, 0, 0);
    portrait.replaceWith(canvas); frame = requestAnimationFrame(draw);
  };
  photo.src = portrait.src;
  window.MiokoAvatar = {
    setMouth(value) { mouth = Math.max(0, Math.min(1, Number(value) || 0)); },
    closeMouth() { mouth = 0; if (photo.complete && canvas.width) drawStill(); }
  };
  function drawStill() { ctx.clearRect(0, 0, photo.naturalWidth, photo.naturalHeight); ctx.drawImage(photo, 0, 0); }
  window.addEventListener('pagehide', () => { mouth = 0; cancelAnimationFrame(frame); });
  window.addEventListener('pageshow', () => { if (photo.complete) { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); } });
})();
