import React, { useEffect, useRef } from 'react';
import { getSocket } from '../services/socketService';

const AVATAR_EMOJI = { bunny: '🐰', cat: '🐱', dog: '🐶' };

const MOODS = [
  { id: 'happy',    emoji: '😊', label: 'Happy' },
  { id: 'sad',      emoji: '😢', label: 'Sad'   },
  { id: 'depressed',emoji: '☁️', label: 'Gloomy'},
  { id: 'angry',    emoji: '💢', label: 'Angry' },
  { id: 'cute',     emoji: '✨', label: 'Cute'  },
  { id: 'puppy',    emoji: '🥺', label: 'Puppy' },
  { id: 'flirty',   emoji: '💖', label: 'Flirty'},
  { id: 'disgusted',emoji: '🤢', label: 'Gross' },
  { id: 'bleh',     emoji: '👅', label: 'Bleh'  },
  { id: 'sleepy',   emoji: '💤', label: 'Sleepy'},
];

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

const GameCanvas = ({ user, roomId, roomTheme, socket }) => {
  const canvasRef = useRef(null);
  const effectsRef = useRef([]);
  const lastTimeRef = useRef(performance.now());
  const swimCooldownRef = useRef(0);
  const decorRef = useRef([]); 
  const remotePlayersRef = useRef({}); // socketId -> player object
  const notificationsRef = useRef([]); // { text, timer }
  const moodTimerRef = useRef(0);
  const passiveTimerRef = useRef(0);
  const localStateRef = useRef(null); // Persist local player position across effect re-runs

  const addNotification = (text) => {
    notificationsRef.current.push({ text, timer: 3000 });
    if (notificationsRef.current.length > 5) notificationsRef.current.shift();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!socket) return;

    // ---- SCALE SYSTEM ----
    const SCALE = 0.65; 
    const VW = canvas.width / SCALE;
    const VH = canvas.height / SCALE;
    const FLOOR_Y = VH * 0.88; 
    const G = 2200;
    const JUMP_V = 880;
    const CW = 46; const CH = 50; 

    const WORLD_W = 2400; // Double the viewport width
    
    let local = localStateRef.current || {
      x: VW * 0.2, y: FLOOR_Y - CH, w: CW, h: CH, vx: 0, vy: 0, onGround: false,
      avatar: user?.avatar || 'bunny', color: user?.color || '#ffb3d9', prop: user?.prop || 'none', mood: 'happy',
      action: 'idle', actionTimer: 0, bubbleText: '', bubbleTimer: 0, inPool: false, name: user?.username || 'You'
    };
    localStateRef.current = local;
    
    const cameraXRef = { current: 0 };

    const INTERACTIVE_AREA = { x: WORLD_W - 400, y: FLOOR_Y - 60, w: 260, h: 60 };
    const CLOUDS = [{x:WORLD_W*0.15,y:80}, {x:WORLD_W*0.35,y:50}, {x:WORLD_W*0.6,y:90}, {x:WORLD_W*0.85,y:60}];
    const HILLS  = [{x:WORLD_W*0.2, y:FLOOR_Y+10, r:180}, {x:WORLD_W*0.5, y:FLOOR_Y+20, r:220}, {x:WORLD_W*0.85, y:FLOOR_Y+15, r:200}];

    const platforms = [
      {x:0,y:FLOOR_Y,w:WORLD_W,h:40,type:'ground'},
      {x: WORLD_W*0.2, y: FLOOR_Y - 140, w: 360, h: 20},
      {x: WORLD_W*0.4, y: FLOOR_Y - 240, w: 240, h: 20},
      {x: WORLD_W*0.6, y: FLOOR_Y - 320, w: 220, h: 20},
      {x: WORLD_W*0.8, y: FLOOR_Y - 180, w: 300, h: 20}
    ];
    
    const springs = [];
    if (roomTheme?.includes('🌸')) {
       springs.push({x: WORLD_W*0.3, y: FLOOR_Y - 20, w: 80, h: 20, power: 2.8, type: 'mushroom'});
    } else if (roomTheme?.includes('🍀')) {
       springs.push({x: WORLD_W*0.8, y: FLOOR_Y - 20, w: 100, h: 20, power: 2.5, type: 'leaf'});
    } else {
       springs.push({x: Math.round(WORLD_W*0.1 - 40), y: FLOOR_Y - 28, w: 80, h: 14, power: 2.3, type: 'jack'});
    }

    // ---- REAL-TIME SOCKET HANDLERS INSIDE GAME LOOP SYSTEM ----
    const handleInit = (data) => {
      console.log('Game initialized', data.id);
      const others = {};
      Object.entries(data.players || {}).forEach(([id, p]) => {
        if (id !== socket.id) {
          others[id] = { ...p, lerpX: p.x, lerpY: p.y };
        } else {
          // Sync local position if server provides it
          local.x = p.x; local.y = p.y;
        }
      });
      remotePlayersRef.current = others;
    };

    const handlePlayerJoined = (p) => {
      if (p.id !== socket.id) {
        remotePlayersRef.current[p.id] = { ...p, lerpX: p.x, lerpY: p.y };
        addNotification(`${p.name || 'Someone'} joined ✨`);
      }
    };

    const handlePlayerLeft = (id) => {
      const p = remotePlayersRef.current[id];
      if (p) addNotification(`${p.name || 'Someone'} left 👋`);
      delete remotePlayersRef.current[id];
    };

    const handlePlayerUpdated = (p) => {
      if (p.id !== socket.id) {
        const existing = remotePlayersRef.current[p.id];
        if (existing) {
          // Keep the current lerp handles but update targets
          remotePlayersRef.current[p.id] = { 
            ...p, 
            lerpX: existing.lerpX, 
            lerpY: existing.lerpY 
          };
        } else {
          remotePlayersRef.current[p.id] = { ...p, lerpX: p.x, lerpY: p.y };
        }
      }
    };

    const handlePlayerAction = (adata) => {
      const p = remotePlayersRef.current[adata.id];
      if (p) {
        p.action = adata.type; p.actionTimer = 1000;
        p.bubbleText = pickLine(adata.type); p.bubbleTimer = 2500;
        spawnActionEffects(p, adata.type, adata.target);
      }
    };

    const handleChat = (entry) => {
      // Local player
      if (entry.id === socket.id || (entry.userId && entry.userId === user.id)) {
         local.bubbleText = entry.text;
         local.bubbleTimer = 4500;
      } else {
         // Remote players are keyed by socket.id (entry.id)
         const p = remotePlayersRef.current[entry.id];
         if (p) {
            p.bubbleText = entry.text;
            p.bubbleTimer = 4500;
         }
      }
    };

    socket.on('init', handleInit);
    socket.on('playerJoined', handlePlayerJoined);
    socket.on('playerLeft', handlePlayerLeft);
    socket.on('playerUpdated', handlePlayerUpdated);
    socket.on('playerAction', handlePlayerAction);
    socket.on('chat', handleChat);

    const keys = {};
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;
      keys[e.key.toLowerCase()] = true;
      if (e.key === ' ') e.preventDefault();
      if (e.key >= '1' && e.key <= '7') {
        const actMap = { '1':'wave', '2':'dance', '3':'angry', '4':'hug', '5':'gift', '6':'punch', '7':'kick' };
        if (actMap[e.key]) triggerAction(actMap[e.key]);
      }
    };
    const handleKeyUp = (e) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const triggerAction = (name) => {
      local.action = name; local.actionTimer = 1000;
      local.bubbleText = pickLine(name); local.bubbleTimer = 2500;
      const payload = { type: name };
      if (['hug','gift','punch','kick'].includes(name)) {
        let nearest = null; let nd = 9999;
        Object.values(remotePlayersRef.current).forEach(p => {
          const d = Math.hypot((p.x+CW/2)-(local.x+CW/2), (p.y+CH/2)-(local.y+CH/2));
          if (d < 180 && d < nd) { nd = d; nearest = p; }
        });
        if (nearest) payload.target = nearest.id;
      }
      if (socket) socket.emit('action', payload);
      spawnActionEffects(local, name, payload.target);
    };

    const spawnActionEffects = (actor, type, targetId) => {
      if (type === 'wave') spawnEffect('spark', actor.x + CW, actor.y + CH*0.3, {vy:-40});
      if (type === 'dance') for(let i=0;i<8;i++) spawnEffect('spark', actor.x + CW*0.5 + (Math.random()-0.5)*CW, actor.y + CH*0.2, {vx:(Math.random()-0.5)*50, vy:-50 - Math.random()*30});
      if (type === 'hug' && targetId) { 
        const t = remotePlayersRef.current[targetId] || (targetId === socket.id ? local : null);
        if (t) spawnEffect('hearts_line', (actor.x+CW/2), actor.y, {meta:{from:actor, to:t}}); 
      }
      if (type === 'punch' || type === 'kick') { 
        const t = remotePlayersRef.current[targetId] || (targetId === socket.id ? local : null);
        const tx = t ? t.x+CW/2 : actor.x+(actor.vx>0?70:-70); 
        const ty = t ? t.y+CH/2 : actor.y+20; 
        spawnEffect('pow', tx, ty, { text: type==='punch'?'POW!':'YEET!' }); 
      }
    };

    const spawnEffect = (type, x, y, opts={}) => { 
      // If anchor exists, x and y are considered RELATIVE to the anchor
      effectsRef.current.push({ type, x, y, t:0, life:1100, ...opts }); 
    };
    const roundRect = (ctx,x,y,w,h,r) => { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); };

    const handleMoodChange = (e) => {
      local.mood = e.detail;
      local.bubbleText = pickLine('idle_'+e.detail);
      local.bubbleTimer = 2500;
      socket.emit('update', { ...local, mood: e.detail });
      moodTimerRef.current = 10 + Math.random()*5; // 10-15 seconds
    };
    window.addEventListener('changeMood', handleMoodChange);

    const drawProp = (vx, vy, prop, color) => {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (prop === 'flower') {
        // Simple cute hand-drawn flower
        const fx = vx + CW * 0.8;
        const fy = vy + 4;
        ctx.fillStyle = '#ffde59'; // center
        ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#35263d'; ctx.stroke();
        
        ctx.fillStyle = '#ff914d'; // petals
        for (let i = 0; i < 5; i++) {
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate((i * Math.PI * 2) / 5);
          ctx.beginPath(); ctx.ellipse(7, 0, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#35263d'; ctx.stroke();
          ctx.restore();
        }
      } else if (prop === 'glasses') {
        ctx.strokeStyle = '#35263d';
        ctx.lineWidth = 2.5;
        // Left lens
        ctx.beginPath(); ctx.arc(vx + CW * 0.33, vy + CH * 0.38, 7, 0, Math.PI * 2); ctx.stroke();
        // Right lens
        ctx.beginPath(); ctx.arc(vx + CW * 0.67, vy + CH * 0.38, 7, 0, Math.PI * 2); ctx.stroke();
        // Bridge
        ctx.beginPath(); ctx.moveTo(vx + CW * 0.33 + 7, vy + CH * 0.38); ctx.quadraticCurveTo(vx + CW/2, vy + CH * 0.38 - 2, vx + CW * 0.67 - 7, vy + CH * 0.38); ctx.stroke();
      } else if (prop === 'cap') {
        ctx.fillStyle = '#5271ff';
        ctx.beginPath();
        ctx.moveTo(vx + 4, vy + 8);
        ctx.quadraticCurveTo(vx + CW/2, vy - 10, vx + CW - 4, vy + 8);
        ctx.fill();
        ctx.strokeStyle = '#35263d'; ctx.stroke();
        // bill
        ctx.beginPath(); ctx.moveTo(vx + CW - 8, vy + 4); ctx.lineTo(vx + CW + 10, vy + 8); ctx.stroke();
      } else if (prop === 'crown') {
        const cx = vx + CW/2; const cy = vy - 8;
        ctx.fillStyle = '#ffde59';
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy + 5);
        ctx.lineTo(cx - 18, cy - 10);
        ctx.lineTo(cx - 8, cy - 2);
        ctx.lineTo(cx, cy - 12);
        ctx.lineTo(cx + 8, cy - 2);
        ctx.lineTo(cx + 18, cy - 10);
        ctx.lineTo(cx + 15, cy + 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#35263d'; ctx.stroke();
      } else if (prop === 'bow') {
        ctx.fillStyle = '#ff5757';
        const bx = vx + CW * 0.2; const by = vy + 2;
        // Left loop
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(bx - 12, by - 12, bx - 12, by + 12, bx, by); ctx.fill(); ctx.stroke();
        // Right loop
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(bx + 12, by - 12, bx + 12, by + 12, bx, by); ctx.fill(); ctx.stroke();
        // center
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
      
      ctx.restore();
    };

    const drawCharacter = (p, dName) => {
      const { x, y, avatar, color, mood, action, bubbleText, bubbleTimer, prop } = p;
      let vx = x; let vy = y;
      if (action === 'angry' || mood === 'angry') vx += Math.sin(performance.now()/60) * 3.5;
      ctx.save();
      
      // Shadow
      ctx.fillStyle = 'rgba(80,58,90,0.08)'; ctx.beginPath(); ctx.ellipse(vx+CW/2, vy+CH+6, CW*0.4, 6, 0, 0, Math.PI*2); ctx.fill();
      
      // Main Body
      ctx.fillStyle = color || '#fff';
      const t = performance.now()/200;
      
      // Mood-specific Body Filters & Creative Layering
      if (mood === 'sad') {
        ctx.filter = 'saturate(0.5) brightness(1.2)';
        ctx.fillStyle = 'rgba(112, 214, 255, 0.4)'; ctx.beginPath(); ctx.ellipse(vx+CW/2, vy+CH+2, 15+Math.sin(t)*3, 4, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = color;
      }
      if (mood === 'angry') {
        ctx.fillStyle = '#ff3333'; // Direct bright red
        ctx.translate(vx+CW/2, vy+CH); ctx.scale(1+Math.sin(t*12)*0.04, 1-Math.sin(t*12)*0.04); ctx.translate(-(vx+CW/2), -(vy+CH));
        // Draw fuming 💢 offset
        ctx.save(); ctx.translate(vx+CW+8, vy-5 + Math.sin(t*5)*5);
        ctx.fillStyle = '#fff'; ctx.font = '14px serif'; ctx.fillText('💢', 0, 0); ctx.restore();
      }
      if (mood === 'puppy') {
        ctx.filter = 'brightness(1.1) saturate(1.2)';
        ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(255,179,217,0.8)';
      }
      if (mood === 'depressed') {
        ctx.filter = 'grayscale(1) brightness(0.6)';
        // Abstract black layers (Vignette Darkness)
        ctx.save(); ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'rgba(0,0,20,0.85)';
        // Draw abstract layers around
        for(let i=0; i<8; i++) {
          ctx.beginPath();
          ctx.arc(vx+CW/2 + Math.cos(i)*100, vy+CH/2 + Math.sin(i)*100, 150, 0, Math.PI*2);
          ctx.fill();
        }
        const g = ctx.createRadialGradient(vx+CW/2, vy+CH/2, 20, vx+CW/2, vy+CH/2, 100);
        g.addColorStop(0, 'transparent'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(vx+CW/2, vy+CH/2, 140, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = color;
      }
      if (mood === 'disgusted') {
        ctx.filter = 'hue-rotate(120deg) saturate(2.5) contrast(1.1)';
        ctx.fillStyle = '#7fff00';
        // Wavy distortion
        ctx.translate(Math.sin(t*3)*3, 0);
        // Drawing Drips
        ctx.fillStyle = 'rgba(0, 100, 0, 0.5)';
        for(let i=0; i<3; i++) {
           const dh = 15+Math.sin(t+i)*8;
           ctx.beginPath(); ctx.ellipse(vx+5+i*15, vy+dh, 4, dh/2, 0, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = color;
      }
      
      roundRect(ctx, vx, vy, CW, CH, 14); ctx.fill();
      ctx.filter = 'none'; ctx.shadowBlur = 0;

      // Props placement
      if (prop && prop !== 'none') {
        drawProp(vx, vy, prop, color);
      }

      // Tail
      if (avatar === 'dog') {
        ctx.save(); ctx.translate(vx+CW*0.2, vy+CH*0.8);
        ctx.rotate(Math.sin(performance.now()/120)*0.4);
        roundRect(ctx, -14, -4, 16, 6, 3); ctx.fill();
        ctx.restore();
      }

      // Belly
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; roundRect(ctx, vx+CW*0.18, vy+CH*0.36, CW*0.64, CH*0.48, 11); ctx.fill();
      
      // Ears
      if (mood === 'angry') ctx.fillStyle = '#ff3333'; else ctx.fillStyle = color;
      if (avatar === 'bunny') {
        ctx.save(); ctx.translate(vx+CW*0.3, vy+CH*0.1); ctx.rotate(-0.1); ctx.beginPath(); ctx.ellipse(0,-CH*0.42, CW*0.13, CH*0.36, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(vx+CW*0.7, vy+CH*0.1); ctx.rotate(0.1);  ctx.beginPath(); ctx.ellipse(0,-CH*0.42, CW*0.13, CH*0.36, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
      } else if (avatar === 'cat') {
        ctx.beginPath(); ctx.moveTo(vx+CW*0.12, vy+6); ctx.lineTo(vx+CW*0.02, vy-12); ctx.lineTo(vx+CW*0.32, vy+6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(vx+CW*0.88, vy+6); ctx.lineTo(vx+CW*0.98, vy-12); ctx.lineTo(vx+CW*0.68, vy+6); ctx.fill();
      } else if (avatar === 'dog') {
        const earW = 14; const earH = 26;
        // Left Ear
        ctx.save(); ctx.translate(vx+2, vy+10); ctx.rotate(0.3); roundRect(ctx, -earW, 0, earW, earH, 7); ctx.fill(); ctx.restore();
        // Right Ear
        ctx.save(); ctx.translate(vx+CW-2, vy+10); ctx.rotate(-0.3); roundRect(ctx, 0, 0, earW, earH, 7); ctx.fill(); ctx.restore();
        
        // Snout
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        roundRect(ctx, vx+CW*0.3, vy+CH*0.55, CW*0.4, CH*0.22, 8); ctx.fill();
        // Nose
        ctx.fillStyle = '#35263d';
        ctx.beginPath(); ctx.arc(vx+CW*0.5, vy+CH*0.6, 2.5, 0, Math.PI*2); ctx.fill();
      }

      // Face/Eyes logic based on mood
      ctx.fillStyle = '#35263d';
      const drawEye = (ex, ey) => {
        const blink = Math.sin(performance.now()/250) > 0.96;
        if (blink || mood === 'sleepy') { ctx.fillRect(ex-4, ey, 8, 2); }
        else if (mood === 'angry') { 
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
          const sw = 5; // shorter
          const oy = -3; // higher
          ctx.beginPath();
          if (ex > vx+CW/2) {
            ctx.moveTo(ex-sw, ey+sw+oy); ctx.lineTo(ex+sw, ey-sw+oy); // /
          } else {
            ctx.moveTo(ex-sw, ey-sw+oy); ctx.lineTo(ex+sw, ey+sw+oy); // \
          }
          ctx.stroke();
        }
        else if (mood === 'sad') {
          ctx.beginPath(); ctx.arc(ex, ey, 5.5, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'rgba(112, 214, 255, 0.6)'; ctx.beginPath(); ctx.arc(ex, ey+2, 4, 0, Math.PI); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex-1.5, ey-1.5, 2, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#35263d';
        }
        else if (mood === 'depressed') {
          // Half-mast tired eyes
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, Math.PI); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(ex, ey, 4.5, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#35263d';
        }
        else if (mood === 'disgusted') {
          // Unique Swirly/Dizzy expression
          ctx.strokeStyle = '#35263d'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          for(let i=0; i<10; i++) {
            const r = i*0.6;
            ctx.lineTo(ex + Math.cos(t*10+i)*r, ey + Math.sin(t*10+i)*r);
          }
          ctx.stroke();
        }
        else if (mood === 'puppy') {
          // Radiating hypnotic rings (Cute)
          ctx.save();
          ctx.strokeStyle = 'rgba(255,128,191,0.4)'; ctx.lineWidth = 1.5;
          for(let i=0;i<2;i++) {
            ctx.beginPath(); ctx.arc(ex, ey, 8+((performance.now()/400+i*0.5)%1)*12, 0, Math.PI*2); ctx.stroke();
          }
          ctx.restore();
          ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex-2.5, ey-2.5, 3, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#35263d';
        }
        else if (mood === 'cute' || action === 'dance') {
          ctx.save(); ctx.translate(ex, ey);
          const s = 8;
          ctx.fillStyle = '#ff80bf';
          for(let i=0;i<4;i++) { ctx.rotate(Math.PI/2); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(s,0); ctx.lineTo(0,s/3); ctx.fill(); }
          ctx.restore();
        }
        else if (mood === 'flirty') { if (ex > vx+CW/2) { ctx.fillRect(ex-4, ey, 8, 2); } else { ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI*2); ctx.fill(); } }
        else { ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI*2); ctx.fill(); }
      };
      drawEye(vx+CW*0.33, vy+CH*0.38);
      drawEye(vx+CW*0.67, vy+CH*0.38);

      // Mouth
      ctx.fillStyle = '#ff80bf'; 
      if (mood === 'angry') {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath();
        ctx.moveTo(vx+CW/2-5, vy+CH*0.56); ctx.lineTo(vx+CW/2, vy+CH*0.51); ctx.lineTo(vx+CW/2+5, vy+CH*0.56); ctx.stroke();
      }
      else if (mood === 'sad' || mood === 'puppy' || mood === 'depressed') { 
        ctx.beginPath(); ctx.arc(vx+CW/2, vy+CH*0.53, 4, Math.PI, 0); ctx.fill(); 
      }
      else if (mood === 'bleh' || mood === 'disgusted') {
        ctx.fillStyle = '#ff80bf'; ctx.beginPath(); ctx.arc(vx+CW/2, vy+CH*0.48, 4, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#ff4d88'; roundRect(ctx, vx+CW/2-3, vy+CH*0.48, 6, 8, 3); ctx.fill();
      }
      else if (mood === 'cute') { ctx.font = '12px serif'; ctx.fillText('✨', vx+CW/2, vy+CH*0.58); }
      else { ctx.beginPath(); ctx.arc(vx+CW/2, vy+CH*0.46, 3, 0, Math.PI*2); ctx.fill(); }
      
      // Name & Bubble
      ctx.fillStyle = '#35263d'; ctx.font = 'bold 12px Nunito'; ctx.textAlign = 'center';
      ctx.fillText(dName, vx+CW/2, vy-32);
      
      // Mood tag (Enhanced Visibility)
      const moodColors = {
        happy: '#ffb3d9', sad: '#70d6ff', angry: '#ff5757', cute: '#ff80bf', 
        puppy: '#ff914d', flirty: '#ff4d88', sleepy: '#c9a0ff', depressed: '#35263d',
        disgusted: '#7fff00', bleh: '#ff80bf', chill: '#85ffcc', silly: '#ffde59'
      };
      const moodColor = moodColors[mood] || '#ffb3d9';
      
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; 
      ctx.strokeStyle = moodColor;
      ctx.lineWidth = 1.5;
      roundRect(ctx, vx+CW/2-38, vy-26, 76, 18, 9); 
      ctx.fill(); ctx.stroke();
      
      ctx.fillStyle = '#35263d'; ctx.font = 'bold 10px Nunito'; 
      ctx.fillText(`mood: ${mood}`, vx+CW/2, vy-13);

      // Chat Bubble (Positioned higher, with a tail)
      if (bubbleText && bubbleTimer > 0) {
        const bw = 120; const bh = 30; // Bubble W/H
        const bx = vx + CW/2 - bw/2;
        const by = vy - 85;
        
        ctx.fillStyle = 'rgba(255,255,255,0.98)'; 
        ctx.strokeStyle = '#ffb3d9';
        ctx.lineWidth = 2;
        
        // Draw bubble
        roundRect(ctx, bx, by, bw, bh, 12); ctx.fill(); ctx.stroke();
        
        // Draw tail
        ctx.beginPath();
        ctx.moveTo(vx + CW/2 - 6, by + bh);
        ctx.lineTo(vx + CW/2, by + bh + 8);
        ctx.lineTo(vx + CW/2 + 6, by + bh);
        ctx.fill(); ctx.stroke();
        
        // Bubble text
        ctx.fillStyle = '#35263d'; ctx.font = '700 11px Nunito'; 
        ctx.fillText(bubbleText, vx+CW/2, by + 19);
      }
      ctx.restore();
    };

    const drawThemeProp = (x, y, w, h, theme) => {
      ctx.save();
      if (theme === '🌸') { // Detail: WINDMILL
         ctx.fillStyle = '#ffccf2'; roundRect(ctx, x+w/2-10, y, 20, h, 6); ctx.fill();
         ctx.save(); ctx.translate(x+w/2, y+10); ctx.rotate(performance.now()/300);
         ctx.fillStyle = '#ffb3d9'; for(let i=0;i<4;i++) { ctx.rotate(Math.PI/2); ctx.beginPath(); ctx.ellipse(20, 0, 25, 8, 0, 0, Math.PI*2); ctx.fill(); }
         ctx.restore();
      } else if (theme === '🌊') { // Detail: CORAL REEF CAVE
         ctx.fillStyle = '#9fdcff'; ctx.beginPath(); ctx.ellipse(x+w/2, y+h, w/2, h, 0, Math.PI, 0); ctx.fill();
         ctx.strokeStyle = '#fff'; ctx.lineWidth=3; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(x+40+i*60, y+h-10-Math.sin(performance.now()/600+i)*20, 6, 0, Math.PI*2); ctx.stroke(); }
      } else if (theme === '🌙') { // Detail: COZY CAMPFIRE
         ctx.fillStyle = '#35263d'; roundRect(ctx, x+w/2-30, y+h-10, 60, 10, 4); ctx.fill();
         const f = Math.sin(performance.now()/100);
         ctx.fillStyle = '#ff80bf'; ctx.beginPath(); ctx.moveTo(x+w/2-15, y+h-5); ctx.quadraticCurveTo(x+w/2, y+h-40-f*10, x+w/2+15, y+h-5); ctx.fill();
         ctx.fillStyle = '#ffb3d9'; ctx.beginPath(); ctx.moveTo(x+w/2-8, y+h-5); ctx.quadraticCurveTo(x+w/2, y+h-25, x+w/2+8, y+h-5); ctx.fill();
      } else if (theme === '🍀') { // Detail: MAGIC MUSHROOM PORTAL
         ctx.fillStyle = '#aed581'; roundRect(ctx, x+w/2-40, y+h-10, 80, 10, 5); ctx.fill();
         ctx.fillStyle = '#fbb'; ctx.beginPath(); ctx.arc(x+w/2, y+h-30, 35, Math.PI, 0); ctx.fill();
         ctx.fillStyle = '#fff'; for(let i=0;i<5;i++) { ctx.beginPath(); ctx.arc(x+w/2-20+i*10, y+h-45+Math.sin(i)*5, 4, 0, Math.PI*2); ctx.fill(); }
      }
      ctx.restore();
    };

    const drawScene = () => {
      const theme = roomTheme || '🌸';
      const tc = {
        '🌸': { skyT: '#85ffcc', skyB: '#c9a0ff', fl: '#99ffbb', hi: '#ffe0f5' },
        '🌊': { skyT: '#70d6ff', skyB: '#40c4ff', fl: '#eefaff', hi: '#d0f2ff' },
        '🌙': { skyT: '#1c203a', skyB: '#3c4076', fl: '#20254b', hi: '#1c203a' },
        '🍀': { skyT: '#b2eabb', skyB: '#a8da9a', fl: '#87bd76', hi: '#b8e5b9' }
      }[theme] || { skyT: '#85ffcc', skyB: '#c9a0ff', fl: '#99ffbb', hi: '#ffe0f5' };

      // Screen space sky
      ctx.save();
      const gr = ctx.createLinearGradient(0,0,0,VH); gr.addColorStop(0, tc.skyT); gr.addColorStop(1, tc.skyB);
      ctx.fillStyle = gr; ctx.fillRect(0,0,VW,VH);
      ctx.restore();

      ctx.translate(-cameraXRef.current, 0);

      if (theme === '🌙') {
         ctx.fillStyle = '#ffea00'; ctx.beginPath(); ctx.arc(WORLD_W-120, 100, 30, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = tc.skyT; ctx.beginPath(); ctx.arc(WORLD_W-110, 92, 30, 0, Math.PI*2); ctx.fill();
         if (decorRef.current.length < 80) decorRef.current.push({ x:Math.random()*WORLD_W, y:Math.random()*300, s:Math.random()*2, t:Math.random()*100 });
         ctx.fillStyle = '#fff'; decorRef.current.forEach(s => { ctx.globalAlpha = 0.4+0.6*Math.abs(Math.sin(performance.now()/700+s.t)); ctx.fillRect(s.x, s.y, s.s, s.s); });
         ctx.globalAlpha = 1;
      } else { ctx.fillStyle = '#ffea00'; ctx.beginPath(); ctx.arc(WORLD_W-130, 110, 45, 0, Math.PI*2); ctx.fill(); }

      ctx.fillStyle = theme==='🌙'?'rgba(200,200,255,0.1)':'rgba(255,255,255,0.8)';
      CLOUDS.forEach(c => { ctx.beginPath(); ctx.arc(c.x, c.y, 45, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(c.x+35, c.y+10, 35, 0, Math.PI*2); ctx.fill(); });
      ctx.fillStyle = tc.hi; HILLS.forEach(h => { ctx.beginPath(); ctx.arc(h.x, h.y, h.r, Math.PI, 0); ctx.fill(); });
      ctx.fillStyle = tc.fl; ctx.fillRect(0, FLOOR_Y, WORLD_W, VH-FLOOR_Y);

      const t = performance.now()/1000;
      if (theme === '🌸') { 
        ctx.font = '20px serif'; ctx.fillText('🐝', 140+Math.sin(t*2)*60, 120+Math.cos(t)*40); ctx.fillText('🦋', WORLD_W-200+Math.sin(t)*70, 180+Math.sin(t*2)*50); 
        // Bouncy Mushroom body
        ctx.fillStyle = '#fff'; roundRect(ctx, WORLD_W*0.3+20, FLOOR_Y-10, 40, 10, 4); ctx.fill();
        ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(WORLD_W*0.3+40, FLOOR_Y-10, 40, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#fff'; [0.3, 0.5, 0.7].forEach(p => { ctx.beginPath(); ctx.arc(WORLD_W*0.3+40+Math.cos(Math.PI*p)*25, FLOOR_Y-10-Math.sin(Math.PI*p)*25, 6, 0, Math.PI*2); ctx.fill(); });
        // Picnic Blanket
        ctx.fillStyle = '#ffb3d9'; roundRect(ctx, WORLD_W*0.7, FLOOR_Y-5, 120, 10, 4); ctx.fill();
        ctx.fillStyle = '#fff'; for(let i=0; i<120; i+=20) { ctx.fillRect(WORLD_W*0.7+i, FLOOR_Y-5, 10, 10); }
      } else if (theme === '🌊') {
         ctx.font = '24px serif'; ctx.fillText('🪼', 200+Math.sin(t)*30, FLOOR_Y-100+Math.sin(t*2)*20);
         // Sandcastle
         ctx.fillStyle = '#f0e68c'; roundRect(ctx, WORLD_W*0.4, FLOOR_Y-60, 80, 60, 4); ctx.fill();
         ctx.fillStyle = '#deb887'; ctx.fillRect(WORLD_W*0.4+20, FLOOR_Y-20, 40, 20);
         // Beach Umbrella
         ctx.fillStyle = '#deb887'; ctx.fillRect(WORLD_W*0.7-3, FLOOR_Y-100, 6, 100);
         ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(WORLD_W*0.7, FLOOR_Y-100, 80, Math.PI, 0); ctx.fill();
         ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(WORLD_W*0.7, FLOOR_Y-100, 40, Math.PI, 0); ctx.fill();
      } else if (theme === '🌙') {
         // Telescope
         ctx.fillStyle = '#35263d'; ctx.fillRect(WORLD_W*0.6-2, FLOOR_Y-50, 4, 50);
         ctx.fillStyle = '#85ffcc'; ctx.save(); ctx.translate(WORLD_W*0.6, FLOOR_Y-50); ctx.rotate(-Math.PI/6); roundRect(ctx, -20, -10, 60, 20, 4); ctx.fill(); ctx.restore();
      } else if (theme === '🍀') {
         for(let i=0;i<12;i++) { ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc((t*60+i*120)%WORLD_W, VH*0.5+Math.sin(t+i)*60, 4, 0, Math.PI*2); ctx.fill(); }
         // Giant Windmill
         ctx.fillStyle = '#deb887'; ctx.beginPath(); ctx.moveTo(WORLD_W*0.5-30, FLOOR_Y); ctx.lineTo(WORLD_W*0.5-20, FLOOR_Y-150); ctx.lineTo(WORLD_W*0.5+20, FLOOR_Y-150); ctx.lineTo(WORLD_W*0.5+30, FLOOR_Y); ctx.fill();
         ctx.save(); ctx.translate(WORLD_W*0.5, FLOOR_Y-120); ctx.rotate(performance.now()/800);
         ctx.fillStyle = '#fff'; for(let i=0;i<4;i++) { ctx.rotate(Math.PI/2); roundRect(ctx, 10, -5, 80, 10, 4); ctx.fill(); }
         ctx.restore();
         // Leaf Pile body
         ctx.fillStyle = '#87bd76'; ctx.beginPath(); ctx.arc(WORLD_W*0.8+50, FLOOR_Y-10, 50, Math.PI, 0); ctx.fill();
      }
      drawThemeProp(INTERACTIVE_AREA.x, INTERACTIVE_AREA.y, INTERACTIVE_AREA.w, INTERACTIVE_AREA.h, theme);
    };

    const loop = (now) => {
      const dt = Math.min(0.04, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      const speed = 300;
      const moveSpeed = local.inPool ? speed * 0.75 : speed;
      local.vx = 0;
      if (keys['arrowleft'] || keys['a']) local.vx = -moveSpeed; else if (keys['arrowright'] || keys['d']) local.vx = moveSpeed;
      if ((keys[' '] || keys['w']) && (local.onGround || local.inPool)) { if (local.inPool) { local.vy = -480; } else { local.vy = -JUMP_V; local.onGround = false; } }
      local.vy += G * dt;
      if (local.inPool) { if (local.y + CH > INTERACTIVE_AREA.y + 10) local.vy -= (G + 1800) * dt; local.vx *= 0.85; local.vy *= 0.94; if (local.action === 'idle') local.action = 'swim'; swimCooldownRef.current -= dt; if (swimCooldownRef.current <= 0) { local.bubbleText = pickLine('swim'); local.bubbleTimer = 1500; swimCooldownRef.current = 4 + Math.random()*3; } }
      local.x += local.vx * dt; local.y += local.vy * dt; local.onGround = false;

      // Passive and mood systems
      moodTimerRef.current -= dt;
      if (moodTimerRef.current <= 0) {
        local.bubbleText = pickLine('idle_'+local.mood); local.bubbleTimer = 2500;
        moodTimerRef.current = 10 + Math.random()*5; // 10-15 seconds
      }
      
      
      // Throttled sync - only if moved or state changed
      const hasMoved = Math.abs(local.x - (local.lastSentX || 0)) > 1 || Math.abs(local.y - (local.lastSentY || 0)) > 1;
      const stateChanged = local.mood !== local.lastSentMood || local.action !== local.lastSentAction;
      
      if (!local.lastSyncTime) local.lastSyncTime = 0;
      if (socket && socket.connected && (hasMoved || stateChanged || now - local.lastSyncTime > 1000)) {
        if (now - local.lastSyncTime > 30) { // Slightly faster sync (~33Hz)
          socket.emit('update', { ...local, username: local.name });
          local.lastSentX = local.x; local.lastSentY = local.y;
          local.lastSentMood = local.mood; local.lastSentAction = local.action;
          local.lastSyncTime = now;
        }
      }

      passiveTimerRef.current += dt;
      const allP = [local, ...Object.values(remotePlayersRef.current)];
      allP.forEach(p => {
        if (passiveTimerRef.current > 0.6) {
          const spawnPassive = (text, opts={}) => spawnEffect('spark', CW*Math.random(), -10, { text, anchor: p, ...opts });
          if (p.mood === 'sad') spawnPassive('💧', { color:'#70d6ff', vy:50 });
          if (p.mood === 'depressed') spawnPassive('💧', { color:'#555', vy:40 });
          if (p.mood === 'flirty' || p.mood === 'puppy') spawnPassive('❤️');
          if (p.mood === 'sleepy') spawnPassive('💤', { vx:10, vy:-20 });
          if (p.mood === 'cute') spawnPassive('✨');
          if (p.mood === 'angry') {
             spawnPassive('💨', { vy:-40 });
             spawnPassive('♨️', { vy:-30 });
          }
        }
      });
      if (passiveTimerRef.current > 0.6) passiveTimerRef.current = 0;

      local.inPool = local.x < INTERACTIVE_AREA.x+INTERACTIVE_AREA.w && local.x+CW > INTERACTIVE_AREA.x && local.y+CH > INTERACTIVE_AREA.y && local.y < INTERACTIVE_AREA.y+INTERACTIVE_AREA.h;
      platforms.forEach(p => { if (local.x+CW>p.x && local.x<p.x+p.w && local.y+CH>=p.y && (local.y+CH - (local.vy*dt + 2))<=p.y && local.vy>=0) { local.y = p.y-CH; local.vy=0; local.onGround=true; } });
      springs.forEach(s => { if (local.x+CW>s.x && local.x<s.x+s.w && local.y+CH>=s.y && local.y+CH<=s.y+18 && local.vy>0) { local.vy = -JUMP_V * s.power; local.onGround=false; local.bubbleText=pickLine('boing'); local.bubbleTimer=1500; for(let i=0;i<10;i++) spawnEffect('spark', local.x+CW/2, local.y+CH, {vx:(Math.random()-0.5)*140, vy:-120}); } });
      if (local.x < -CW) local.x = WORLD_W; if (local.x > WORLD_W) local.x = -CW/2; if (local.y > VH + 150) { local.x = WORLD_W*0.2; local.y = FLOOR_Y-CH; }

      cameraXRef.current = local.x - VW/2;
      if (cameraXRef.current < 0) cameraXRef.current = 0;
      if (cameraXRef.current > WORLD_W - VW) cameraXRef.current = WORLD_W - VW;

      ctx.save(); ctx.scale(SCALE, SCALE); ctx.clearRect(0,0,VW,VH); drawScene();
      platforms.forEach(p => { if (p.type!=='ground') { ctx.fillStyle='rgba(255,255,255,0.5)'; roundRect(ctx, p.x,p.y,p.w,p.h,10); ctx.fill(); } });
      springs.forEach(s => { ctx.fillStyle='#ffd9ef'; roundRect(ctx, s.x,s.y,s.w,s.h,8); ctx.fill(); });

      // ---- RENDER REMOTE PLAYERS ----
      const curPlayers = remotePlayersRef.current || {};
      const remotePlayers = Object.values(curPlayers);
      [local, ...remotePlayers].sort((a,b) => (a.y+CH) - (b.y+CH)).forEach(p => {
        if (p === local) {
          drawCharacter(local, local.name);
        } else {
          // Smoothly interpolate positions
          p.lerpX = p.lerpX || p.x; p.lerpY = p.lerpY || p.y;
          p.lerpX += (p.x - p.lerpX) * 0.15;
          p.lerpY += (p.y - p.lerpY) * 0.15;
          drawCharacter({...p, x: p.lerpX, y: p.lerpY}, p.username || p.name || 'Friend');
        }
      });

      for(let i=effectsRef.current.length-1; i>=0; i--) {
        const e = effectsRef.current[i]; e.t += dt*1000; const p = e.t/e.life; e.x += (e.vx||0)*dt; e.y += (e.vy||0)*dt;
        
        let dx = e.x, dy = e.y;
        if (e.anchor) {
          // If anchored, e.x/e.y are offsets from anchor's lerp position
          dx = (e.anchor.lerpX || e.anchor.x) + e.x;
          dy = (e.anchor.lerpY || e.anchor.y) + e.y;
        }

        if (e.type==='spark') { ctx.globalAlpha = 1-p; ctx.fillStyle=e.color||'#fff'; ctx.font='12px serif'; ctx.fillText(e.text||'', dx, dy); ctx.globalAlpha=1; }
        if (e.type==='pow') { ctx.globalAlpha = 1-p; ctx.fillStyle='#ff80bf'; ctx.font='bold 16px Nunito'; ctx.fillText(e.text, dx, dy); ctx.globalAlpha=1; }
        if (e.type==='hearts_line' && e.meta.from && e.meta.to) {
          const sx = (e.meta.from.lerpX || e.meta.from.x)+CW/2, sy = (e.meta.from.lerpY || e.meta.from.y); 
          const tx = (e.meta.to.lerpX || e.meta.to.x)+CW/2, ty = (e.meta.to.lerpY || e.meta.to.y);
          const ex = sx + (tx-sx)*p, ey = sy + (ty-sy)*p-Math.sin(p*Math.PI)*50; 
          ctx.save(); ctx.translate(ex,ey); ctx.rotate(-0.2); ctx.globalAlpha=1-p; ctx.fillStyle='rgba(255,128,191,0.95)'; ctx.beginPath(); ctx.moveTo(0,4); ctx.bezierCurveTo(4,4,4,-2,0,-10); ctx.bezierCurveTo(-4,-2,-4,4,0,4); ctx.fill(); ctx.restore();
        }
        if (e.t >= e.life) effectsRef.current.splice(i,1);
      }
      ctx.restore();

      // Notifications Overlay (drawn in SCREEN SPACE)
      notificationsRef.current.forEach((n, i) => {
        n.timer -= dt * 1000;
        if (n.timer > 0) {
          const alpha = Math.min(1, n.timer/500);
          ctx.save();
          ctx.fillStyle = `rgba(53,38,61, ${alpha * 0.75})`;
          roundRect(ctx, 20, 20 + i*38, 180, 28, 10); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255, ${alpha})`;
          ctx.font = 'bold 12px Nunito'; ctx.textAlign = 'left';
          ctx.fillText(n.text, 35, 38 + i*38);
          ctx.restore();
        }
      });
      notificationsRef.current = notificationsRef.current.filter(n => n.timer > 0);

      // Timers for actions
      if (local.bubbleTimer > 0) local.bubbleTimer -= dt*1000;
      if (local.actionTimer > 0) local.actionTimer -= dt*1000; else if (!local.inPool) local.action = 'idle';

      Object.values(remotePlayersRef.current).forEach(p => {
        if (p.bubbleTimer > 0) p.bubbleTimer -= dt*1000;
        if (p.actionTimer > 0) p.actionTimer -= dt*1000; else if (!p.inPool) p.action = 'idle';
      });

      requestAnimationFrame(loop);
    };
    const animId = requestAnimationFrame(loop);
      const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = ((e.clientX - rect.left) * scaleX / 0.65) + cameraXRef.current; // SCALE + Camera Offset
      const clickY = (e.clientY - rect.top) * scaleY / 0.65;
      Object.values(remotePlayersRef.current).forEach(p => {
        const dx = clickX - p.x; const dy = clickY - p.y;
        if (dx >= 0 && dx <= 46 && dy >= 0 && dy <= 50) { // CW/CH
           window.dispatchEvent(new CustomEvent('playerClicked', { detail: p }));
        }
      });
    };
    canvas.addEventListener('mousedown', handleCanvasClick);

    return () => { 
      canvas.removeEventListener('mousedown', handleCanvasClick);
      window.removeEventListener('keydown', handleKeyDown); 
      window.removeEventListener('keyup', handleKeyUp); 
      window.removeEventListener('changeMood', handleMoodChange);
      cancelAnimationFrame(animId);
      socket.off('init', handleInit);
      socket.off('playerJoined', handlePlayerJoined);
      socket.off('playerLeft', handlePlayerLeft);
      socket.off('playerUpdated', handlePlayerUpdated);
      socket.off('playerAction', handlePlayerAction);
      socket.off('chat', handleChat);
    };
  }, [user, roomId, roomTheme, socket]);

  const changeMood = (m) => {
    window.dispatchEvent(new CustomEvent('changeMood', { detail: m }));
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} width={800} height={450} style={{ width:'100%', borderRadius:'28px', boxShadow:'0 25px 70px rgba(80,58,90,0.2)', border:'4px solid #fff' }} />
      <div style={{
        position: 'absolute', bottom: '80px', right: '12px',
        display: 'flex', flexDirection: 'column', gap: '6px',
        background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(10px)',
        padding: '10px', borderRadius: '16px', border: '1.5px solid rgba(255,179,217,0.6)',
        boxShadow: '0 4px 20px rgba(80,58,90,0.12)', zIndex: 10
      }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#8a7a9a', textTransform: 'uppercase', textAlign: 'center', marginBottom: '2px' }}>Mood</div>
        {MOODS.map(m => (
          <button
            key={m.id}
            onClick={() => changeMood(m.id)}
            style={{
              background: 'white', border: '1.5px solid #ffb3d9', borderRadius: '10px',
              width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', cursor: 'pointer', transition: 'all 0.15s'
            }}
            title={m.label}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.15)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {m.emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GameCanvas;
