import React, { useEffect, useRef } from 'react';

const pickLine = (group) => {
  const lines = {
    wave: ["Hiii! ✨", "Welcome!"],
    dance: ["Boogie! 💃", "Spin!"],
    swim: ["Splish splash!", "Glub glub!"],
    idle_happy: ["Lala~ 🎶", "Such a nice day!"]
  };
  const arr = lines[group] || ['...'];
  return arr[Math.floor(Math.random() * arr.length)];
};

const StudyCanvas = ({ user, players, socket, zones, onZoneEnter, onZoneLeave }) => {
  const canvasRef = useRef(null);
  const effectsRef = useRef([]);
  const lastTimeRef = useRef(performance.now());
  const localStateRef = useRef(null);
  const activeZoneRef = useRef(null);
  
  const playersRef = useRef(players);
  const drawingsRef = useRef([]);
  const keysRef = useRef({});

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const SCENE_W = 2800; // Increased width to fit all rooms nicely
    const VH = canvas.height;
    const VW = canvas.width; // Viewport width
    const FLOOR_Y = VH * 0.88;
    const G = 2200;
    const JUMP_V = 880;
    const CW = 46; const CH = 50;

    let local = localStateRef.current || {
      x: 600, y: FLOOR_Y - CH, vx: 0, vy: 0, onGround: false,
      avatar: user?.avatar || 'bunny', color: user?.color || '#ffb3d9',
      action: 'idle', name: user?.username || 'You', zone: null,
      focusStart: Date.now()
    };
    localStateRef.current = local;

    let cameraX = 0;

    const roundRect = (ctx,x,y,w,h,r) => { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); };

    // Draw the Cute Study Room!
    const drawRoom = (time) => {
      // Wallpaper
      ctx.fillStyle = '#fdfaf6'; ctx.fillRect(0, 0, SCENE_W, VH);
      
      // Skirting board and floor
      ctx.fillStyle = '#f0e6ff'; ctx.fillRect(0, FLOOR_Y-20, SCENE_W, 20);
      ctx.fillStyle = '#e8dbdf'; ctx.fillRect(0, FLOOR_Y, SCENE_W, VH-FLOOR_Y);

      // --- ZONE: WHITEBOARD ---
      const zw = zones.whiteboard;
      ctx.fillStyle = '#fff'; roundRect(ctx, zw.x, 60, zw.w, 200, 10); ctx.fill();
      ctx.strokeStyle = '#c9a0ff'; ctx.lineWidth = 10; ctx.stroke();
      
      if (drawingsRef.current.length === 0) {
        ctx.fillStyle = '#ff80bf'; ctx.font = '24px Nunito'; ctx.textAlign = 'center'; 
        ctx.fillText('Drawn By Everyone ✨', zw.x + zw.w/2, 160);
      } else {
        // Render scaled drawings on the wall
        ctx.save();
        
        ctx.beginPath();
        roundRect(ctx, zw.x, 60, zw.w, 200, 10);
        ctx.clip(); // Ensure strokes perfectly stay inside the whiteboard!

        // Drawing board is strictly 1200x800 logically, fit to 300x200
        const scaleX = zw.w / 1200;
        const scaleY = 200 / 800;
        const scale = Math.min(scaleX, scaleY);
        
        ctx.translate(zw.x + (zw.w - 1200*scale)/2, 60 + (200 - 800*scale)/2);
        ctx.scale(scale, scale);
        
        drawingsRef.current.forEach(stroke => {
          const { points, color, size, eraser } = stroke;
          if (points.length < 2) return;
          ctx.beginPath();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = eraser ? '#ffffff' : color;
          ctx.lineWidth = size * 2; // slightly thicker for visibility at scale
          
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        });
        ctx.restore();
      }

      // --- ZONE: STICKY BOARD ---
      const zs2 = zones.stickies;
      if (zs2) {
        ctx.fillStyle = '#b78460'; roundRect(ctx, zs2.x, 60, zs2.w, 200, 5); ctx.fill(); // Board Frame
        ctx.fillStyle = '#dcb37c'; roundRect(ctx, zs2.x+5, 65, zs2.w-10, 190, 2); ctx.fill(); // Cork
        
        ctx.fillStyle = '#ffb3d9'; ctx.fillRect(zs2.x+20, 80, 40, 40);
        ctx.fillStyle = '#ffffb3'; ctx.fillRect(zs2.x+80, 100, 40, 40);
        ctx.fillStyle = '#b3e5fc'; ctx.fillRect(zs2.x+140, 120, 40, 40);
        
        ctx.fillStyle = '#6d4c41'; ctx.font = 'bold 16px Nunito'; ctx.textAlign = 'center';
        ctx.fillText('Notes & Ideas 📝', zs2.x + zs2.w/2, 160);
      }

      // --- ZONE: DESK ---
      const zd = zones.desk;
      ctx.fillStyle = '#d7ccc8'; roundRect(ctx, zd.x, FLOOR_Y-100, zd.w, 100, 10); ctx.fill(); // Desk
      ctx.fillStyle = '#8d6e63'; roundRect(ctx, zd.x+20, FLOOR_Y-120, zd.w-40, 20, 5); ctx.fill(); // shelf
      ctx.fillStyle = '#ffb3d9'; roundRect(ctx, zd.x+50, FLOOR_Y-140, 30, 40, 3); ctx.fill(); // Book
      ctx.fillStyle = '#c9a0ff'; roundRect(ctx, zd.x+90, FLOOR_Y-150, 20, 50, 3); ctx.fill(); // Book
      // Chairs
      for(let i=0; i<3; i++) {
        ctx.fillStyle = '#fff'; roundRect(ctx, zd.x + 30 + i*90, FLOOR_Y-60, 40, 60, 8); ctx.fill();
      }

      // --- ZONE: SHELF ---
      const zs = zones.shelf;
      ctx.fillStyle = '#a1887f'; roundRect(ctx, zs.x, FLOOR_Y-250, zs.w, 250, 5); ctx.fill();
      for(let i=1; i<4; i++) {
        ctx.fillStyle = '#6d4c41'; ctx.fillRect(zs.x, FLOOR_Y-250 + i*60, zs.w, 10);
      }
      // Draw random folders
      ctx.fillStyle = '#ffb3d9'; ctx.fillRect(zs.x+10, FLOOR_Y-240, 20, 45);
      ctx.fillStyle = '#85ffcc'; ctx.fillRect(zs.x+35, FLOOR_Y-235, 15, 50);

      // --- ZONE: BREAK AREA ---
      const zb = zones.break;
      ctx.fillStyle = '#aed581'; roundRect(ctx, zb.x+40, FLOOR_Y-140, 100, 140, 20); ctx.fill(); // Potted plant!
      ctx.fillStyle = '#e8f5e9'; ctx.beginPath(); ctx.arc(zb.x+90, FLOOR_Y-160, 50, 0, Math.PI*2); ctx.fill();
      // Coffee table
      ctx.fillStyle = '#ffe0b2'; roundRect(ctx, zb.x+160, FLOOR_Y-50, 80, 50, 10); ctx.fill();
      ctx.font = '30px Arial'; ctx.fillText('☕', zb.x+185, FLOOR_Y-55);

      // --- ZONE: HELP DESK ---
      const zh = zones.help;
      ctx.fillStyle = '#ffcc80'; roundRect(ctx, zh.x, FLOOR_Y-120, zh.w, 120, 10); ctx.fill();
      ctx.fillStyle = '#fff'; roundRect(ctx, zh.x+20, FLOOR_Y-160, 160, 40, 8); ctx.fill();
      ctx.fillStyle = '#ef6c00'; ctx.font = '20px Nunito'; ctx.fillText('Help Desk ✋', zh.x+40, FLOOR_Y-135);

      // Sticky notes on wallpaper
      ctx.fillStyle = '#fffb00'; ctx.fillRect(250, 80, 40, 40); // Shifted far left
      ctx.fillStyle = '#85ffcc'; ctx.fillRect(1150, 120, 40, 40); // Shifted right near shelf
    };

    // Simplified Character Drawer
    const drawCharacter = (p) => {
      const { x, y, avatar, color, name, zone } = p;
      const isFocus = zone === 'desk';
      ctx.save();
      // Shadow
      ctx.fillStyle = 'rgba(80,58,90,0.08)'; ctx.beginPath(); ctx.ellipse(x+CW/2, y+CH+6, CW*0.4, 6, 0, 0, Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle = color || '#fff';
      roundRect(ctx, x, y, CW, CH, 14); ctx.fill();
      // Belly
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; roundRect(ctx, x+CW*0.18, y+CH*0.36, CW*0.64, CH*0.48, 11); ctx.fill();
      
      if (isFocus) {
         // Focus Glasses 👓 (cute and round)
         ctx.strokeStyle = '#ffb3d9'; ctx.lineWidth = 2.5; 
         ctx.beginPath(); ctx.arc(x+CW*0.3, y+CH*0.35, 8, 0, Math.PI*2); ctx.stroke();
         ctx.beginPath(); ctx.arc(x+CW*0.7, y+CH*0.35, 8, 0, Math.PI*2); ctx.stroke();
         ctx.beginPath(); ctx.moveTo(x+CW*0.3+8, y+CH*0.35); ctx.lineTo(x+CW*0.7-8, y+CH*0.35); ctx.stroke();
         
         // Huge Sparkly Eyes ✨
         ctx.fillStyle = '#35263d';
         ctx.beginPath(); ctx.arc(x+CW*0.3, y+CH*0.35, 5, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.arc(x+CW*0.7, y+CH*0.35, 5, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#fff';
         ctx.beginPath(); ctx.arc(x+CW*0.3-2, y+CH*0.35-2, 2, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.arc(x+CW*0.7-2, y+CH*0.35-2, 2, 0, Math.PI*2); ctx.fill();

         // Cute blush
         ctx.fillStyle = 'rgba(255, 100, 150, 0.4)';
         ctx.beginPath(); ctx.ellipse(x+CW*0.15, y+CH*0.48, 6, 3, 0, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.ellipse(x+CW*0.85, y+CH*0.48, 6, 3, 0, 0, Math.PI*2); ctx.fill();
         
         // Happy focused mouth (little 'w' shape)
         ctx.strokeStyle = '#ff80bf'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
         ctx.beginPath(); ctx.moveTo(x+CW/2-4, y+CH*0.5); ctx.quadraticCurveTo(x+CW/2-2, y+CH*0.5+4, x+CW/2, y+CH*0.5); 
         ctx.quadraticCurveTo(x+CW/2+2, y+CH*0.5+4, x+CW/2+4, y+CH*0.5); ctx.stroke();
         
         // Bobbing Book in Hand 📖
         const bob = Math.sin(performance.now() / 300) * 3;
         ctx.fillStyle = '#ff80bf'; roundRect(ctx, x-8, y+CH*0.4 + bob, 16, 20, 2); ctx.fill();
         ctx.fillStyle = '#fff'; roundRect(ctx, x-6, y+CH*0.4+2 + bob, 12, 16, 0); ctx.fill();
         ctx.fillStyle = '#ffb3d9'; ctx.fillRect(x-4, y+CH*0.4+6 + bob, 8, 1.5); ctx.fillRect(x-4, y+CH*0.4+10 + bob, 8, 1.5);
         
         // Timer over head - gentle hover animation
         const hover = Math.sin(performance.now() / 500) * 4;
         ctx.fillStyle = 'rgba(255,255,255,0.95)'; roundRect(ctx, x+CW/2-30, y-38 + hover, 60, 20, 10); ctx.fill();
         ctx.fillStyle = '#a8da9a'; ctx.beginPath(); ctx.arc(x+CW/2-18, y-28 + hover, 4, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#ff4d88'; ctx.font = 'bold 11px Nunito'; ctx.textAlign = 'center';
         const elapsed = Math.floor((Date.now() - (p.focusStart || Date.now())) / 1000);
         const m = Math.floor(elapsed/60).toString().padStart(2,'0');
         const s = (elapsed%60).toString().padStart(2,'0');
         ctx.fillText(`${m}:${s}`, x+CW/2+4, y-25 + hover);
      } else {
        // Normal Eyes
        ctx.fillStyle = '#35263d';
        ctx.fillRect(x+CW*0.3, y+CH*0.38, 4, 4);
        ctx.fillRect(x+CW*0.6, y+CH*0.38, 4, 4);
        // Mouth
        ctx.fillStyle = '#ff80bf'; ctx.beginPath(); ctx.arc(x+CW/2, y+CH*0.46, 3, 0, Math.PI*2); ctx.fill();
      }
      
      // Ears (Bunny specific for simplicity in generic file)
      ctx.fillStyle = color || '#fff';
      if (avatar === 'bunny') {
        ctx.save(); ctx.translate(x+CW*0.3, y+CH*0.1); ctx.rotate(-0.1); ctx.beginPath(); ctx.ellipse(0,-CH*0.42, CW*0.13, CH*0.36, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(x+CW*0.7, y+CH*0.1); ctx.rotate(0.1);  ctx.beginPath(); ctx.ellipse(0,-CH*0.42, CW*0.13, CH*0.36, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
      } else if (avatar === 'dog') { // Dog
        ctx.save(); ctx.translate(x+2, y+10); ctx.rotate(0.3); roundRect(ctx, -14, 0, 14, 26, 7); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(x+CW-2, y+10); ctx.rotate(-0.3); roundRect(ctx, 0, 0, 14, 26, 7); ctx.fill(); ctx.restore();
      } else { // Cat
        ctx.beginPath(); ctx.moveTo(x+CW*0.12, y+6); ctx.lineTo(x+CW*0.02, y-12); ctx.lineTo(x+CW*0.32, y+6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+CW*0.88, y+6); ctx.lineTo(x+CW*0.98, y-12); ctx.lineTo(x+CW*0.68, y+6); ctx.fill();
      }

      ctx.fillStyle = '#35263d'; ctx.font = 'bold 12px Nunito'; ctx.textAlign = 'center';
      if (!isFocus) ctx.fillText(name, x+CW/2, y-15);
      
      ctx.restore();
    };

    const handleKeyDown = (e) => { 
      if(document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        keysRef.current[e.key.toLowerCase()] = true; 
      }
      if(e.key===' ') e.preventDefault(); 
    };
    const handleKeyUp   = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown); 
    window.addEventListener('keyup', handleKeyUp);

    // Track Socket drawing events
    const handleInit = (data) => {
      if (data.drawings) drawingsRef.current = data.drawings;
    };
    const handleDraw = (stroke) => {
      drawingsRef.current.push(stroke);
      if (drawingsRef.current.length > 2000) drawingsRef.current.shift();
    };
    const handleClear = () => { drawingsRef.current = []; };

    socket.on('syncDrawings', (drawings) => {
      if (drawings && drawings.length > 0) drawingsRef.current = drawings;
    });

    if (socket) {
      socket.on('init', handleInit);
      socket.on('draw', handleDraw);
      socket.on('clearCanvas', handleClear);
      
      // Force request drawings if we mounted late
      socket.emit('requestDrawings');
    }

    const loop = (now) => {
      const dt = Math.min(0.04, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Local Physics
      local.vx = 0;
      if (keysRef.current['arrowleft'] || keysRef.current['a']) local.vx = -300; 
      else if (keysRef.current['arrowright'] || keysRef.current['d']) local.vx = 300;
      if ((keysRef.current[' '] || keysRef.current['w']) && local.onGround) { local.vy = -JUMP_V; local.onGround = false; }
      
      local.vy += G * dt;
      local.x += local.vx * dt; local.y += local.vy * dt;
      local.onGround = false;

      // Floor collision
      if (local.y + CH >= FLOOR_Y) { local.y = FLOOR_Y - CH; local.vy = 0; local.onGround = true; }
      if (local.x < 0) local.x = 0; if (local.x > SCENE_W - CW) local.x = SCENE_W - CW;

      // --- ZONE DETECTION ---
      let currentZone = null;
      Object.entries(zones).forEach(([zId, z]) => {
         // simple bounding box
         if (local.x + CW/2 > z.x && local.x + CW/2 < z.x + z.w) {
           currentZone = zId;
         }
      });
      if (currentZone !== activeZoneRef.current) {
         if (currentZone) onZoneEnter(currentZone);
         else onZoneLeave();
         
         if (currentZone === 'desk' && activeZoneRef.current !== 'desk') local.focusStart = Date.now();
         activeZoneRef.current = currentZone;
         local.zone = currentZone; // Update local state for socket emission
      }

      // Camera Follows Local Player (clamps to edge)
      cameraX = local.x - VW/2;
      if (cameraX < 0) cameraX = 0;
      if (cameraX > SCENE_W - VW) cameraX = SCENE_W - VW;

      // Sync to Server (Emit more frequently when zone changes or every 200ms)
      if (!local.lastSyncTime) local.lastSyncTime = 0;
      const hasMoved = Math.abs(local.x - (local.lastSentX||0)) > 1;
      const zoneChanged = local.zone !== local.lastSentZone;
      if (socket && (hasMoved || zoneChanged || now - local.lastSyncTime > 1000)) {
         if (now - local.lastSyncTime > 40) {
           socket.emit('update', { ...local, username: local.name, roomType: 'study' });
           local.lastSentX = local.x; 
           local.lastSentZone = local.zone;
           local.lastSyncTime = now;
         }
      }

      // Draw
      ctx.clearRect(0,0,VW,VH);
      ctx.save();
      ctx.translate(-cameraX, 0); // pan camera

      drawRoom(now);
      
      // Sort and draw players
      const allPlayers = [local]; 
      // Iterate players prop via ref
      Object.values(playersRef.current || {}).forEach(remote => {
         if (remote.id !== socket?.id && remote.roomType === 'study') {
            remote.lerpX = remote.lerpX || remote.x; remote.lerpY = remote.lerpY || remote.y;
            remote.lerpX += (remote.x - remote.lerpX) * 0.15; remote.lerpY += (remote.y - remote.lerpY) * 0.15;
            allPlayers.push({ ...remote, x: remote.lerpX, y: remote.lerpY, name: remote.username });
         }
      });
      allPlayers.sort((a,b)=>a.y-b.y).forEach(p => drawCharacter(p));
      
      ctx.restore();

      // UI Overlay hint
      if (currentZone) {
         ctx.fillStyle = 'rgba(255,255,255,0.7)'; roundRect(ctx, VW/2-80, 20, 160, 30, 15); ctx.fill();
         ctx.fillStyle = '#35263d'; ctx.font = 'bold 14px Nunito'; ctx.textAlign = 'center'; ctx.fillText('You are at: ' + zones[currentZone].name, VW/2, 40);
      }

      requestAnimationFrame(loop);
    };

    const animId = requestAnimationFrame(loop);
    return () => { 
      cancelAnimationFrame(animId); 
      window.removeEventListener('keydown', handleKeyDown); 
      window.removeEventListener('keyup', handleKeyUp); 
      if (socket) {
        socket.off('init', handleInit);
        socket.off('draw', handleDraw);
        socket.off('clearCanvas', handleClear);
      }
    };
  }, [user, socket, zones, onZoneEnter, onZoneLeave]);

  return (
    <canvas ref={canvasRef} width={1000} height={500} style={{ width:'100%', height:'100%', display:'block' }} />
  );
};

export default StudyCanvas;
