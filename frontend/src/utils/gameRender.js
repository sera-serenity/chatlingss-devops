// Shared rendering and physics utilities for CuteChat Games
const SCALE = 0.55; // Zoomed out default
const VW = 1200;   // Increased from 800
const VH = 650;    // Increased from 450
const CW = 46;     // Character Width
const CH = 50;     // Character Height
const G = 2200;
const JUMP_V = 920;

const LINES = {
  wave: ["Hiii! ✨", "Welcome!", "Hey friend!"],
  dance: ["Boogie! 💃", "Joyful hop!", "Spin spin!"],
  angry: ["Hmph! >.<", "Watch it!", "Grr!"],
  hug: ["Warm hug! ❤️", "Squeee!", "Cuddles!"],
  gift: ["For you! 🎁", "Surprise!", "Tiny gift!"],
  punch: ["Pow! 💥", "Zap!", "Boom!"],
  kick: ["Yeet! 💨", "Kick!", "Wham!"],
  boing: ["Boing! ✨", "Wheeee!", "So bouncy!"],
  swim: ["Splish splash! 🌊", "Bloop!", "Cool water~", "Glub glub!"],
  idle_happy: ["Lala~ 🎶", "Such a nice day!", "Feeling good! ✨", "Hehe!"],
  idle_sad: ["Please don't go...", "Sniff sniff...", "Everything is gray...", "I'm so sad... 🥺"],
  idle_depressed: ["*heavy heart*", "Just a raincloud in my soul...", "Zero energy...", "..."],
  idle_angry: ["RAAAWR!", "I'm SO MAD!", "Stay away! 💢", "Fuming!"],
  idle_cute: ["Sparkle! ✨", "Pika pika~", "Nyaa!", "Love you! ❤️"],
  idle_puppy: ["Pls? 🥺", "Treat? ❤️", "*shimmers*", "You're the best! ✨"],
  idle_flirty: ["Hey there~ 😉", "Looking good!", "*winks*", "Cutie pie! ❤️"],
  idle_disgusted: ["Eww!", "Bleh!", "Gross!", "Urk..."],
  idle_bleh: ["Bleh! 👅", "*sticks tongue out*", "Pfft!", "😝"],
  idle_sleepy: ["Zzz...", "*yawn*", "Five more mins...", "So tired..."]
};

const pickLine = (group) => {
  const arr = LINES[group] || ['...'];
  return arr[Math.floor(Math.random() * arr.length)];
};

const roundRect = (ctx, x, y, w, h, r) => {
  if (r > w/2) r = w/2;
  if (r > h/2) r = h/2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawCharacter = (ctx, p, dName, options = {}) => {
  const { x, y, avatar, color, mood, action, bubbleText, bubbleTimer } = p;
  
  ctx.save();
  if (options.scale) {
    // Scale around the character's position
    ctx.translate(x + CW/2, y + CH);
    ctx.scale(options.scale, options.scale);
    ctx.translate(-(x + CW/2), -(y + CH));
  }
  
  let vx = x; let vy = y;
  const t = performance.now() / 200;
  
  if (action === 'sit') {
      vy += 12; // Lower the character
  }
  
  if (action === 'angry' || mood === 'angry') vx += Math.sin(performance.now() / 60) * 3.5;
  
  // Tag IT check
  if (options.isIt) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
  }

  // Shadow
  ctx.fillStyle = 'rgba(80,58,90,0.08)'; 
  ctx.beginPath(); 
  ctx.ellipse(vx + CW / 2, vy + CH + 6, CW * 0.4, 6, 0, 0, Math.PI * 2); 
  ctx.fill();
  
  // Body logic
  ctx.fillStyle = color || '#fff';
  
  if (mood === 'sad') {
    ctx.filter = 'saturate(0.5) brightness(1.2)';
    ctx.fillStyle = 'rgba(112, 214, 255, 0.4)'; ctx.beginPath(); ctx.ellipse(vx + CW / 2, vy + CH + 2, 15 + Math.sin(t) * 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
  }
  if (mood === 'angry' || options.isIt) {
    ctx.fillStyle = '#ff3333';
    ctx.translate(vx + CW / 2, vy + CH); ctx.scale(1 + Math.sin(t * 12) * 0.04, 1 - Math.sin(t * 12) * 0.04); ctx.translate(-(vx + CW / 2), -(vy + CH));
    ctx.save(); ctx.translate(vx + CW + 8, vy - 5 + Math.sin(t * 5) * 5);
    ctx.fillStyle = '#fff'; ctx.font = '14px serif'; ctx.fillText('💢', 0, 0); ctx.restore();
  }
  if (mood === 'puppy') {
    ctx.filter = 'brightness(1.1) saturate(1.2)';
    ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(255,179,217,0.8)';
  }
  if (mood === 'depressed') {
     ctx.filter = 'grayscale(1) brightness(0.6)';
     ctx.fillStyle = color;
  }
  if (mood === 'disgusted') {
    ctx.filter = 'hue-rotate(120deg) saturate(2.5) contrast(1.1)';
    ctx.translate(Math.sin(t * 3) * 3, 0);
  }
  
  roundRect(ctx, vx, vy, CW, CH, 14); ctx.fill();
  ctx.filter = 'none'; ctx.shadowBlur = 0; if (options.isIt) ctx.shadowBlur = 20;

  // Tail
  if (avatar === 'dog') {
    ctx.save(); ctx.translate(vx + CW * 0.2, vy + CH * 0.8);
    ctx.rotate(Math.sin(performance.now() / 120) * 0.4);
    roundRect(ctx, -14, -4, 16, 6, 3); ctx.fill();
    ctx.restore();
  }

  // Belly
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; roundRect(ctx, vx + CW * 0.18, vy + CH * 0.36, CW * 0.64, CH * 0.48, 11); ctx.fill();
  
  // Ears
  ctx.fillStyle = (mood === 'angry' || options.isIt) ? '#ff3333' : color;
  if (avatar === 'bunny') {
    ctx.save(); ctx.translate(vx + CW * 0.3, vy + CH * 0.1); ctx.rotate(-0.1); ctx.beginPath(); ctx.ellipse(0, -CH * 0.42, CW * 0.13, CH * 0.36, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(vx + CW * 0.7, vy + CH * 0.1); ctx.rotate(0.1); ctx.beginPath(); ctx.ellipse(0, -CH * 0.42, CW * 0.13, CH * 0.36, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else if (avatar === 'cat') {
    ctx.beginPath(); ctx.moveTo(vx + CW * 0.12, vy + 6); ctx.lineTo(vx + CW * 0.02, vy - 12); ctx.lineTo(vx + CW * 0.32, vy + 6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(vx + CW * 0.88, vy + 6); ctx.lineTo(vx + CW * 0.98, vy - 12); ctx.lineTo(vx + CW * 0.68, vy + 6); ctx.fill();
  } else if (avatar === 'dog') {
    ctx.save(); ctx.translate(vx + 2, vy + 10); ctx.rotate(0.3); roundRect(ctx, -14, 0, 14, 26, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(vx + CW - 2, vy + 10); ctx.rotate(-0.3); roundRect(ctx, 0, 0, 14, 26, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; roundRect(ctx, vx + CW * 0.3, vy + CH * 0.55, CW * 0.4, CH * 0.22, 8); ctx.fill();
    ctx.fillStyle = '#35263d'; ctx.beginPath(); ctx.arc(vx + CW * 0.5, vy + CH * 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // Action Addons (Prop / Bucket)
  if (options.prop === 'bucket') {
      ctx.fillStyle = 'rgba(180,180,180,0.9)';
      roundRect(ctx, vx-8, vy+CH*0.4, CW+16, 20, 6); ctx.fill();
      ctx.strokeStyle = '#35263d'; ctx.lineWidth = 2; ctx.stroke();
  }

  // Eyes
  ctx.fillStyle = '#35263d';
  const drawEye = (ex, ey) => {
    const blink = Math.sin(performance.now() / 250) > 0.96;
    if (blink || mood === 'sleepy') { ctx.fillRect(ex - 4, ey, 8, 2); }
    else if (mood === 'angry') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); if (ex > vx + CW / 2) { ctx.moveTo(ex - 5, ey + 2); ctx.lineTo(ex + 5, ey - 8); } else { ctx.moveTo(ex - 5, ey - 8); ctx.lineTo(ex + 5, ey + 2); } ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fill(); }
  };
  drawEye(vx + CW * 0.33, vy + CH * 0.38);
  drawEye(vx + CW * 0.67, vy + CH * 0.38);

  // Mouth
  ctx.fillStyle = '#ff80bf';
  ctx.beginPath(); ctx.arc(vx + CW / 2, vy + CH * 0.48, 3, 0, Math.PI * 2); ctx.fill();

  // Name Label
  ctx.fillStyle = '#35263d'; ctx.font = 'bold 11px Nunito'; ctx.textAlign = 'center';
  ctx.fillText(dName, vx + CW / 2, vy - 16);
  
  if (bubbleText && bubbleTimer > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.98)'; roundRect(ctx, vx - 35, vy - 52, 116, 24, 10); ctx.fill();
    ctx.fillStyle = '#35263d'; ctx.font = '700 11px Nunito'; ctx.fillText(bubbleText, vx + CW / 2, vy - 35);
  }
  
  ctx.restore();
};

const drawSceneBase = (ctx, theme, VW_VAL, VH_VAL, FLOOR_Y) => {
    const tc = {
        'pink': { skyT: '#85ffcc', skyB: '#c9a0ff', fl: '#99ffbb', hi: '#ffe0f5' },
        'blue': { skyT: '#70d6ff', skyB: '#40c4ff', fl: '#eefaff', hi: '#d0f2ff' },
        'night': { skyT: '#1c203a', skyB: '#3c4076', fl: '#20254b', hi: '#1c203a' },
        'green': { skyT: '#b2eabb', skyB: '#a8da9a', fl: '#87bd76', hi: '#b8e5b9' }
    }[theme] || { skyT: '#85ffcc', skyB: '#c9a0ff', fl: '#99ffbb', hi: '#ffe0f5' };

    const gr = ctx.createLinearGradient(0, 0, 0, VH_VAL); gr.addColorStop(0, tc.skyT); gr.addColorStop(1, tc.skyB);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, VW_VAL, VH_VAL);

    // Sun/Moon
    ctx.fillStyle = '#ffea00';
    if (theme === 'night') {
        ctx.beginPath(); ctx.arc(VW_VAL - 120, 100, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = tc.skyT; ctx.beginPath(); ctx.arc(VW_VAL - 110, 92, 30, 0, Math.PI * 2); ctx.fill();
    } else {
        ctx.beginPath(); ctx.arc(VW_VAL - 130, 110, 45, 0, Math.PI * 2); ctx.fill();
    }

    // Clouds
    ctx.fillStyle = theme === 'night' ? 'rgba(200,200,255,0.1)' : 'rgba(255,255,255,0.8)';
    [0.15, 0.35, 0.6, 0.85].forEach(xf => {
        const cx = VW_VAL * xf; const cy = 80;
        ctx.beginPath(); ctx.arc(cx, cy, 45, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 35, cy + 10, 35, 0, Math.PI * 2); ctx.fill();
    });

    // Hills
    ctx.fillStyle = tc.hi;
    [0.2, 0.5, 0.85].forEach(xf => {
        ctx.beginPath(); ctx.arc(VW_VAL * xf, FLOOR_Y + 15, 200, Math.PI, 0); ctx.fill();
    });

    // Floor
    ctx.fillStyle = tc.fl;
    ctx.fillRect(0, FLOOR_Y, VW_VAL, VH_VAL - FLOOR_Y);
};

const applyPhysics = (p, dt, VW_VAL, VH_VAL, FLOOR_Y, platforms = []) => {
    const prevY = p.y;
    // Faster, smoother gravity and vertical movement
    p.vy += G * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    let onPlatform = false;

    // Floor collision
    if (p.y + CH > FLOOR_Y) {
        p.y = FLOOR_Y - CH;
        p.vy = 0;
        onPlatform = true;
    }

    // Platform collisions (one-way, jump from below)
    if (!onPlatform) {
        for (const plat of platforms) {
            // Check if player is within horizontal bounds of platform (with small margin)
            const margin = 8;
            if (p.x + CW > plat.x + margin && p.x < plat.x + plat.w - margin) {
                // If we were above it and now we are below/at its surface
                if (prevY + CH <= plat.y && p.y + CH >= plat.y && p.vy >= 0) {
                    p.y = plat.y - CH;
                    p.vy = 0;
                    onPlatform = true;
                    break;
                }
            }
        }
    }

    p.onGround = onPlatform;

    // Smooth wall bounce/limit
    if (p.x < 0) { 
        p.x = 0; 
        p.vx = Math.max(0, p.vx); // Prevent sticking to left wall
    }
    if (p.x > VW_VAL - CW) { 
        p.x = VW_VAL - CW; 
        p.vx = Math.min(0, p.vx); // Prevent sticking to right wall
    }
};

const drawPlatform = (ctx, p) => {
    ctx.save();
    // Hand-drawn pastel platform
    ctx.fillStyle = p.color || '#fff0fb';
    roundRect(ctx, p.x, p.y, p.w, p.h || 12, 10);
    ctx.fill();
    
    // Top highlight for a "3D" surface feel
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + (p.h || 12));
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    roundRect(ctx, p.x, p.y, p.w, 6, 6);
    ctx.fill();

    // Subtle edge
    ctx.strokeStyle = 'rgba(80,58,90,0.12)';
    ctx.lineWidth = 1.8;
    roundRect(ctx, p.x, p.y, p.w, p.h || 12, 10);
    ctx.stroke();
    ctx.restore();
};

export {
  SCALE,
  VW,
  VH,
  CW,
  CH,
  G,
  JUMP_V,
  pickLine,
  roundRect,
  drawCharacter,
  drawSceneBase,
  applyPhysics,
  drawPlatform
};
