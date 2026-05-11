import React, { useEffect, useRef } from 'react';
import styles from './LoginBackground.module.css';

const CHARS_CONFIG = [
  { id: 0, avatar: 'bunny', color: '#ffd1e8', name: 'Hop' },
  { id: 1, avatar: 'cat',   color: '#e8ddff', name: 'Misty' },
  { id: 2, avatar: 'dog',   color: '#d7fff1', name: 'Buddy' }
];

const MOODS_LIST = ['happy', 'cute', 'puppy', 'flirty', 'chill'];
const FEATURES = [
  'Real-time games! 🎮',
  'Cute avatars! ✨',
  'Join global chat! 🌍',
  'Hand-drawn dreams 🌸',
  'Make new friends! 🐾'
];

const CW = 46; const CH = 50;

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawThemeProp = (ctx, x, y, w, h, theme) => {
  ctx.save();
  if (theme === '🌸') { // Windmill
     ctx.fillStyle = '#ffccf2'; roundRect(ctx, x+w/2-8, y, 16, h, 6); ctx.fill();
     ctx.save(); ctx.translate(x+w/2, y+10); ctx.rotate(performance.now()/400);
     ctx.fillStyle = '#ffb3d9'; for(let i=0;i<4;i++) { ctx.rotate(Math.PI/2); ctx.beginPath(); ctx.ellipse(18, 0, 22, 7, 0, 0, Math.PI*2); ctx.fill(); }
     ctx.restore();
  } else if (theme === '🍄') { // Mushroom
     ctx.fillStyle = '#fbb'; ctx.beginPath(); ctx.arc(x+w/2, y+h-20, 30, Math.PI, 0); ctx.fill();
     ctx.fillStyle = '#fff'; for(let i=0;i<4;i++) { ctx.beginPath(); ctx.arc(x+w/2-15+i*10, y+h-35+Math.sin(i)*4, 4, 0, Math.PI*2); ctx.fill(); }
  }
  ctx.restore();
};

const drawCharacter = (ctx, p) => {
  const { x, y, avatar, color, mood, name, bubbleText, bubbleTimer, facingRight } = p;
  const t = performance.now();
  ctx.save();
  
  if (!facingRight) {
    ctx.translate(x + CW / 2, y + CH / 2);
    ctx.scale(-1, 1);
    ctx.translate(-(x + CW / 2), -(y + CH / 2));
  }

  // Shadow
  ctx.fillStyle = 'rgba(80,58,90,0.06)';
  ctx.beginPath();
  ctx.ellipse(x + CW / 2, y + CH + 6, CW * 0.45, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mood effects
  if (mood === 'puppy') {
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(255,179,217,0.7)';
  } else if (mood === 'flirty') {
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255,100,130,0.4)';
  }

  // Body
  ctx.fillStyle = color || '#fff';
  roundRect(ctx, x, y, CW, CH, 14);
  ctx.fill();
  ctx.shadowBlur = 0; // Reset shadow immediately

  // Tail (dog)
  if (avatar === 'dog') {
    ctx.save();
    ctx.translate(x + CW * 0.2, y + CH * 0.8);
    ctx.rotate(Math.sin(t / 120) * 0.5);
    roundRect(ctx, -14, -4, 16, 6, 3);
    ctx.fill();
    ctx.restore();
  }

  // Ears
  ctx.fillStyle = color;
  if (avatar === 'bunny') {
    ctx.save(); ctx.translate(x + CW * 0.3, y + CH * 0.1); ctx.rotate(-0.1); ctx.beginPath(); ctx.ellipse(0, -CH * 0.45, CW * 0.13, CH * 0.36, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(x + CW * 0.7, y + CH * 0.1); ctx.rotate(0.1); ctx.beginPath(); ctx.ellipse(0, -CH * 0.45, CW * 0.13, CH * 0.36, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else if (avatar === 'cat') {
    ctx.beginPath(); ctx.moveTo(x + CW * 0.12, y + 6); ctx.lineTo(x + CW * 0.02, y - 14); ctx.lineTo(x + CW * 0.35, y + 6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + CW * 0.88, y + 6); ctx.lineTo(x + CW * 0.98, y - 14); ctx.lineTo(x + CW * 0.65, y + 6); ctx.fill();
  } else if (avatar === 'dog') {
    const earW = 14; const earH = 26;
    ctx.save(); ctx.translate(x + 2, y + 10); ctx.rotate(0.3); roundRect(ctx, -earW, 0, earW, earH, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(x + CW - 2, y + 10); ctx.rotate(-0.3); roundRect(ctx, 0, 0, earW, earH, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; roundRect(ctx, x + CW * 0.3, y + CH * 0.55, CW * 0.4, CH * 0.22, 8); ctx.fill();
    ctx.fillStyle = '#35263d'; ctx.beginPath(); ctx.arc(x + CW * 0.5, y + CH * 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // Eyes
  const blink = Math.sin(t / 250) > 0.97;
  ctx.fillStyle = '#35263d';
  const de = (ex, ey) => {
    if (blink) { ctx.fillRect(ex - 4, ey, 8, 2); }
    else if (mood === 'puppy') { ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - 2.5, ey - 1.5, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#35263d'; }
    else { ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fill(); }
  };
  de(x + CW * 0.33, y + CH * 0.38);
  de(x + CW * 0.67, y + CH * 0.38);

  ctx.restore(); // Undo flip

  // Name & Bubble
  ctx.fillStyle = '#35263d'; ctx.font = 'bold 11px Nunito'; ctx.textAlign = 'center';
  ctx.fillText(name, x + CW / 2, y - 12);
  if (bubbleTimer > 0 && bubbleText) {
    ctx.save(); const bx = x - 45, by = y - 65, bw = 136, bh = 30;
    ctx.fillStyle = '#fff'; roundRect(ctx, bx, by, bw, bh, 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + CW / 2 - 8, by + bh); ctx.lineTo(x + CW / 2, by + bh + 10); ctx.lineTo(x + CW / 2 + 8, by + bh); ctx.fill();
    ctx.fillStyle = '#35263d'; ctx.font = 'bold 11px Nunito'; ctx.fillText(bubbleText, bx + bw / 2, by + bh / 2 + 5);
    ctx.restore();
  }
};

const LoginBackground = () => {
  const canvasRef = useRef(null);
  const lastTimeRef = useRef(performance.now());
  const playersRef = useRef(CHARS_CONFIG.map(c => ({
    ...c, x: Math.random() * 800, y: 0,
    state: 'ROAM', stateTimer: 3,
    targetX: Math.random() * 800,
    mood: 'happy', bubbleText: '', bubbleTimer: 0,
    facingRight: true, y_off: 0
  })));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const clouds = [{ x: 200, y: 120, s: 0.4 }, { x: 700, y: 80, s: 0.6 }, { x: 1200, y: 160, s: 0.3 }];
    const props = [{ x: 400 }, { x: 900 }, { x: 1400 }];

    const loop = (now) => {
      const dt = Math.min(0.04, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const VW = canvas.width;
      const VH = canvas.height;
      if (VW < 1 || VH < 1) { frameId = requestAnimationFrame(loop); return; }

      const FLOOR_Y = VH * 0.88;

      // Sky
      const skyGr = ctx.createLinearGradient(0, 0, 0, VH);
      skyGr.addColorStop(0, '#ffb3d9');
      skyGr.addColorStop(1, '#ffeff9');
      ctx.fillStyle = skyGr;
      ctx.fillRect(0, 0, VW, VH);

      // Sun
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath(); ctx.arc(VW * 0.8, VH * 0.2, 80, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath(); ctx.arc(VW * 0.8, VH * 0.2, 55, 0, 2 * Math.PI); ctx.fill();

      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      clouds.forEach(c => {
        c.x += c.s;
        if (c.x > VW + 100) c.x = -100;
        ctx.beginPath(); ctx.arc(c.x, c.y, 45, 0, 2 * Math.PI); ctx.fill();
        ctx.beginPath(); ctx.arc(c.x + 35, c.y + 10, 35, 0, 2 * Math.PI); ctx.fill();
      });

      // Hills
      ctx.fillStyle = '#ffe0f5';
      [0.2, 0.5, 0.85].forEach(x => {
        ctx.beginPath(); ctx.arc(VW * x, FLOOR_Y + 25, 300, Math.PI, 0); ctx.fill();
      });

      // Ground
      ctx.fillStyle = '#99ffbb';
      ctx.fillRect(0, FLOOR_Y, VW, VH - FLOOR_Y);
      ctx.strokeStyle = '#a8e6a5'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(0, FLOOR_Y); ctx.lineTo(VW, FLOOR_Y); ctx.stroke();

      // Props
      props.forEach((p, idx) => {
        const type = idx % 2 === 0 ? '🌸' : '🍄';
        drawThemeProp(ctx, p.x % VW, FLOOR_Y - 45, 60, 50, type);
      });

      // Characters Logic
      const players = playersRef.current;
      players.forEach((p, idx) => {
        p.stateTimer -= dt;
        const other = players[(idx + 1) % players.length];

        if (p.state === 'ROAM') {
          const dx = p.targetX - p.x;
          if (Math.abs(dx) > 10) {
            p.x += Math.sign(dx) * 70 * dt;
            p.facingRight = dx > 0;
            p.mood = 'happy';
          } else if (p.stateTimer <= 0) {
            if (Math.random() > 0.5 && other.state === 'ROAM') {
              p.state = 'SEEK'; p.targetId = other.id;
            } else {
              p.targetX = Math.random() * VW; p.stateTimer = 2 + Math.random() * 3;
            }
          }
        } else if (p.state === 'SEEK') {
          const target = players.find(o => o.id === p.targetId);
          const stopDist = 65;
          const dx = (target.x + (p.id < target.id ? -stopDist : stopDist)) - p.x;
          if (Math.abs(dx) > 10) {
            p.x += Math.sign(dx) * 100 * dt;
            p.facingRight = dx > 0;
          } else {
            p.state = 'CHAT'; p.stateTimer = 4;
            p.facingRight = (target.x > p.x);
            p.bubbleText = FEATURES[Math.floor(Math.random() * FEATURES.length)];
            p.bubbleTimer = 3;
            p.mood = 'cute';
            target.state = 'CHAT'; target.stateTimer = 4;
            target.facingRight = (p.x > target.x);
            target.bubbleText = 'Ooh! ✨'; target.bubbleTimer = 2;
          }
        } else if (p.state === 'CHAT') {
          if (p.stateTimer <= 0) {
            p.state = 'GAME'; p.stateTimer = 6;
            p.isIt = Math.random() > 0.5;
            p.bubbleText = p.isIt ? 'Catch me!' : 'Hehe! 🐾';
            p.bubbleTimer = 2;
          }
        } else if (p.state === 'GAME') {
          const target = other;
          const dist = target.x - p.x;
          if (p.isIt) {
            p.x += Math.sign(dist) * 120 * dt;
            p.facingRight = dist > 0;
            p.y_off = Math.abs(Math.sin(now / 120) * 15);
          } else {
            p.x -= Math.sign(dist) * 130 * dt;
            p.facingRight = dist < 0;
            p.y_off = Math.abs(Math.sin(now / 100) * 25);
          }
          if (p.x < -CW) p.x = VW; if (p.x > VW) p.x = -CW;
          if (p.stateTimer <= 0) {
            p.state = 'ROAM'; p.targetX = Math.random() * VW; p.stateTimer = 4;
            p.y_off = 0; p.bubbleText = 'GG! ✨'; p.bubbleTimer = 2;
          }
        }

        p.y = FLOOR_Y - CH - 8 - (p.y_off || 0);
        if (p.bubbleTimer > 0) p.bubbleTimer -= dt;
        drawCharacter(ctx, p);
      });

      // Sparkles (Last always on top)
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 8; i++) {
        const tx = (now / 60 + i * 400) % VW;
        const ty = (Math.sin(now / 1200 + i) * 120) + VH * 0.35;
        ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(now / 1500 + i));
        ctx.fillText('✨', tx, ty);
      }
      ctx.globalAlpha = 1;

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvasBg} />;
};

export default LoginBackground;
