import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from './StreetWallRoom.module.css';

export default function StreetWallRoom({ user, players, roomId, socket, hideUI, setHideUI }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [activeColor, setActiveColor] = useState('#ff4d88');
  const [stampMode, setStampMode] = useState(null); 
  const [brushSize, setBrushSize] = useState(6);
  const [transparency, setTransparency] = useState(1);
  const [eraserMode, setEraserMode] = useState(false);
  
  const activeColorRef = useRef('#ff4d88');
  const stampModeRef = useRef(null);
  const brushSizeRef = useRef(6);
  const transparencyRef = useRef(1);
  const eraserModeRef = useRef(false);
  const cameraXRef = useRef(0);
  
  const drawingsRef = useRef([]);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  
  const localStateRef = useRef(null);
  const keysRef = useRef({});
  const playerBubblesRef = useRef({});

  const STAMPS = ['⭐', '🌸', '💖', '🔥', '🦋', '🎨', '✨', '💀'];
  const COLORS = ['#ff4d88', '#ff80bf', '#ffb3d9', '#fffb00', '#85ffcc', '#00ccff', '#c9a0ff', '#ffffff', '#35263d', '#ff9900', '#00ff00', '#ff0000'];

  // Handle Socket & Setup
  useEffect(() => {
    const handleInit = (data) => {
      if (data.drawingHistory && data.drawingHistory.length > 0) {
        // Map database schema back to frontend stroke objects if needed
        const mapped = data.drawingHistory.map(ev => ({
          type: ev.type,
          points: ev.data.points,
          color: ev.data.color,
          size: ev.data.size,
          timestamp: ev.timestamp
        }));
        drawingsRef.current = mapped;
      } else if (data.drawings && data.drawings.length > 0) {
        drawingsRef.current = data.drawings;
      }
    };
    const handleDraw = (stroke) => {
      drawingsRef.current.push(stroke);
      if (drawingsRef.current.length > 5000) drawingsRef.current.shift();
    };
    const handleSync = (drawings) => {
      if (drawings && drawings.length > 0) drawingsRef.current = drawings;
    };
    const handleClear = () => { drawingsRef.current = []; };
    const handleChat = (entry) => {
      playerBubblesRef.current[entry.id] = { text: entry.text, timer: 4000 };
    };

    if (socket) {
      socket.on('init', handleInit);
      socket.on('syncDrawings', handleSync);
      socket.on('draw', handleDraw);
      socket.on('clearCanvas', handleClear);
      socket.on('chat', handleChat);
      socket.emit('requestDrawings');
    }
    
    return () => {
      if (socket) {
        socket.off('init', handleInit);
        socket.off('syncDrawings', handleSync);
        socket.off('draw', handleDraw);
        socket.off('clearCanvas', handleClear);
        socket.off('chat', handleChat);
      }
    };
  }, [socket]);

  // Main Graphics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    
    const setResolution = () => {
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
    };
    setResolution();
    window.addEventListener('resize', setResolution);

    const SCENE_W = 4000;
    const G = 2200;
    const JUMP_V = 880;
    const CW = 46; const CH = 50;
    
    let animId;
    const lastTimeRef = { current: performance.now() };

    let local = localStateRef.current || {
      x: 300, y: 0, vx: 0, vy: 0, onGround: false,
      avatar: user?.avatar || 'bunny', color: user?.color || '#ffb3d9',
      name: user?.username || 'You',
      action: 'idle'
    };
    localStateRef.current = local;

    // Drawing utils
    const roundRect = (ctx, x, y, w, h, r) => {
      ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
      ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h);
      ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath();
    };

    const drawCharacter = (p) => {
      const { x, y, avatar, color, name } = p;
      ctx.save();
      // Shadow
      ctx.fillStyle = 'rgba(20,20,30,0.15)'; ctx.beginPath(); ctx.ellipse(x+CW/2, y+CH+6, CW*0.4, 6, 0, 0, Math.PI*2); ctx.fill();
      
      // Body
      ctx.fillStyle = color || '#fff';
      roundRect(ctx, x, y, CW, CH, 14); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; roundRect(ctx, x+CW*0.18, y+CH*0.36, CW*0.64, CH*0.48, 11); ctx.fill();
      
      // Artist Splatters 🎨
      ctx.fillStyle = '#ff4d88'; ctx.beginPath(); ctx.arc(x+CW*0.3, y+CH*0.6, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#00ccff'; ctx.beginPath(); ctx.arc(x+CW*0.7, y+CH*0.7, 3, 0, Math.PI*2); ctx.fill();

      // Artist Eyes ✨
      ctx.fillStyle = '#35263d';
      ctx.beginPath(); ctx.arc(x+CW*0.3, y+CH*0.35, 5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+CW*0.7, y+CH*0.35, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x+CW*0.3-2, y+CH*0.35-2, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+CW*0.7-2, y+CH*0.35-2, 2, 0, Math.PI*2); ctx.fill();
      
      ctx.fillStyle = 'rgba(255, 100, 150, 0.4)';
      ctx.beginPath(); ctx.ellipse(x+CW*0.15, y+CH*0.48, 6, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x+CW*0.85, y+CH*0.48, 6, 3, 0, 0, Math.PI*2); ctx.fill();

      ctx.fillStyle = '#35263d';
      ctx.beginPath(); ctx.arc(x+CW/2, y+CH*0.5, 4, 0, Math.PI); ctx.fill();

      // Artist Beret 🎨
      ctx.fillStyle = '#ff4d88';
      ctx.beginPath(); ctx.ellipse(x+CW*0.4, y-2, CW*0.4, 8, -0.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#35263d'; ctx.beginPath(); ctx.arc(x+CW*0.4, y-10, 2, 0, Math.PI*2); ctx.fill();
      
      // Paintbrush 🖌️
      const bob = Math.sin(performance.now() / 200) * 4;
      ctx.fillStyle = '#a67c52'; roundRect(ctx, x-10, y+CH*0.3+bob, 4, 25, 2); ctx.fill();
      ctx.fillStyle = '#c0c0c0'; ctx.fillRect(x-11, y+CH*0.3+bob-5, 6, 6);
      ctx.fillStyle = '#f0d9b5'; ctx.beginPath(); ctx.moveTo(x-11, y+CH*0.3+bob-5); ctx.lineTo(x-8, y+CH*0.3+bob-15); ctx.lineTo(x-5, y+CH*0.3+bob-5); ctx.fill();
      ctx.fillStyle = activeColorRef.current || '#00ccff'; ctx.beginPath(); ctx.arc(x-8, y+CH*0.3+bob-14, 3, 0, Math.PI*2); ctx.fill();

      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Nunito'; ctx.textAlign = 'center';
      ctx.fillText(name, x+CW/2, y-20);

      // Chat Bubble (Positioned higher, with a tail)
      const bubble = playerBubblesRef.current[p.id || socket?.id];
      if (bubble && bubble.timer > 0 && bubble.text) {
        const bw = 120; const bh = 30; // Bubble W/H
        const bx = x + CW/2 - bw/2;
        const by = y - 65;
        
        ctx.fillStyle = 'rgba(255,255,255,0.98)'; 
        ctx.strokeStyle = '#ffb3d9';
        ctx.lineWidth = 2;
        
        // Draw bubble
        roundRect(ctx, bx, by, bw, bh, 12); ctx.fill(); ctx.stroke();
        
        // Draw tail
        ctx.beginPath();
        ctx.moveTo(x + CW/2 - 6, by + bh);
        ctx.lineTo(x + CW/2, by + bh + 8);
        ctx.lineTo(x + CW/2 + 6, by + bh);
        ctx.fill(); ctx.stroke();
        
        // Bubble text
        ctx.fillStyle = '#35263d'; ctx.font = '700 11px Nunito'; 
        ctx.fillText(bubble.text, x+CW/2, by + 19);
      }
      
      ctx.restore();
    };

    const drawScene = () => {
      const FLOOR_Y = canvas.height * 0.85;

      ctx.fillStyle = '#2b2a33';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      ctx.translate(-cameraXRef.current, 0);

      // The Wall
      ctx.fillStyle = '#5c545c';
      ctx.fillRect(0, 0, SCENE_W, FLOOR_Y);
      
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      for (let y = 0; y < FLOOR_Y; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SCENE_W, y); ctx.stroke();
        for (let x = 0; x < SCENE_W; x += 100) {
          const offsetX = (y / 50) % 2 === 0 ? 0 : 50;
          ctx.beginPath(); ctx.moveTo(x + offsetX, y); ctx.lineTo(x + offsetX, y + 50); ctx.stroke();
        }
      }

      // Drawings
      drawingsRef.current.forEach(stroke => {
        if (stroke.type === 'stamp') {
          ctx.globalAlpha = stroke.alpha || 1;
          ctx.font = `${stroke.size*4}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(stroke.stamp, stroke.x, stroke.y);
          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = stroke.alpha || 1;
          ctx.strokeStyle = stroke.eraser ? '#5c545c' : stroke.color;
          ctx.lineWidth = stroke.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          if (stroke.points && stroke.points.length > 0) {
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
              ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });
      
      // Render active local stroke
      if (currentStrokeRef.current) {
        const s = currentStrokeRef.current;
        if (s.points && s.points.length > 0) {
          ctx.globalAlpha = s.alpha || 1;
          ctx.strokeStyle = s.eraser ? '#5c545c' : s.color; 
          ctx.lineWidth = s.size; ctx.lineCap='round'; ctx.lineJoin='round';
          ctx.beginPath(); ctx.moveTo(s.points[0].x, s.points[0].y);
          for(let i=1;i<s.points.length;i++) ctx.lineTo(s.points[i].x, s.points[i].y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      ctx.fillStyle = '#1c1b22';
      ctx.fillRect(0, FLOOR_Y, SCENE_W, canvas.height - FLOOR_Y);
      ctx.fillStyle = '#0f0e14'; ctx.fillRect(0, FLOOR_Y, SCENE_W, 10);

      // Buckets
      const drawBucket = (bx, by, bcolor) => {
        ctx.fillStyle = '#c4c4c4'; roundRect(ctx, bx, by-20, 24, 20, 2); ctx.fill();
        ctx.fillStyle = bcolor; ctx.fillRect(bx+2, by-18, 20, 16);
        ctx.fillStyle = '#fff'; ctx.fillRect(bx+6, by-14, 12, 8);
        ctx.fillStyle = bcolor; ctx.beginPath(); ctx.arc(bx-5, by, 6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx+30, by+5, 4, 0, Math.PI*2); ctx.fill();
      };
      drawBucket(800, FLOOR_Y, '#ff4d88');
      drawBucket(880, FLOOR_Y, '#00ccff');
      drawBucket(1800, FLOOR_Y, '#fffb00');
      drawBucket(2500, FLOOR_Y, '#85ffcc');

      Object.values(players).forEach(p => {
        if (p.id !== socket?.id && p.room === roomId) {
          drawCharacter({ ...p, y: Math.min(p.y, FLOOR_Y - CH) }); 
        }
      });
      drawCharacter({ ...local, y: Math.min(local.y, FLOOR_Y - CH) });

      ctx.restore();
    };

    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      const FLOOR_Y = canvas.height * 0.85;

      local.vx = 0;
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          if (keysRef.current['arrowleft'] || keysRef.current['a']) local.vx = -400; 
          else if (keysRef.current['arrowright'] || keysRef.current['d']) local.vx = 400;

          if ((keysRef.current['arrowup'] || keysRef.current['w'] || keysRef.current[' ']) && local.onGround) {
            local.vy = -JUMP_V;
            local.onGround = false;
            keysRef.current[' '] = false;
          }
      }

      local.vy += G * dt;
      local.x += local.vx * dt;
      local.y += local.vy * dt;

      if (local.y >= FLOOR_Y - CH) {
        local.y = FLOOR_Y - CH;
        local.vy = 0;
        local.onGround = true;
      }

      if (local.x < 0) local.x = 0;
      if (local.x > SCENE_W - CW) local.x = SCENE_W - CW;

      cameraXRef.current = local.x - canvas.width/2;
      if (cameraXRef.current < 0) cameraXRef.current = 0;
      if (cameraXRef.current > SCENE_W - canvas.width) cameraXRef.current = SCENE_W - canvas.width;

      if (!local.lastSyncTime) local.lastSyncTime = 0;
      const hasMoved = Math.abs(local.x - (local.lastSentX||0)) > 1;
      if (socket && (hasMoved || now - local.lastSyncTime > 1000)) {
         if (now - local.lastSyncTime > 40) {
           socket.emit('update', { ...local, username: local.name, roomType: 'graffiti' });
           local.lastSentX = local.x; 
           local.lastSyncTime = now;
         }
      }

      Object.keys(playerBubblesRef.current).forEach(id => {
         const b = playerBubblesRef.current[id];
         if (b.timer > 0) b.timer -= dt * 1000;
      });

      drawScene();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    const handleKeyDown = (e) => { keysRef.current[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', setResolution);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [user, players, roomId, socket]);

  // Pointer Handlers for Drawing on the Wall
  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (cx - rect.left) + cameraXRef.current,
      y: cy - rect.top
    };
  };

  const startDrawing = (e) => {
    if (e.target !== canvasRef.current) return;
    const pos = getMousePos(e);
    
    if (stampModeRef.current) {
        const stampStroke = { type: 'stamp', stamp: stampModeRef.current, x: pos.x, y: pos.y, size: brushSizeRef.current * 2, alpha: transparencyRef.current };
        if (socket) socket.emit('draw', stampStroke);
        return;
    }

    isDrawingRef.current = true;
    currentStrokeRef.current = {
      type: 'brush',
      color: activeColorRef.current,
      size: brushSizeRef.current,
      alpha: transparencyRef.current,
      eraser: eraserModeRef.current,
      points: [pos]
    };
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    currentStrokeRef.current.points.push(getMousePos(e));
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentStrokeRef.current && socket) {
      if (currentStrokeRef.current.points.length > 1) {
        console.log('🎨 Emitting draw event to server...');
        socket.emit('draw', currentStrokeRef.current);
      }
    }
    currentStrokeRef.current = null;
  };

  const clearWall = () => {
    if(window.confirm("Erase exactly everything on the wall?")) socket.emit('clearCanvas');
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.topHud}>
         <div className={styles.hudBubble}>🎨 <b>Wall Painting Room</b></div>
         {!hideUI && <div className={styles.hudBubble}>Move with WASD, Click & Drag to Paint!</div>}
      </div>

      <canvas 
        ref={canvasRef}
        className={styles.canvas}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerOut={stopDrawing}
        onPointerCancel={stopDrawing}
      />

      <div className={styles.toolbar}>
        <div className={styles.toolSection} style={{ flexDirection: 'column' }}>
          {COLORS.slice(0, 6).map(c => (
            <button 
              key={c}
              className={`${styles.colorBtn} ${activeColor === c && !eraserMode ? styles.active : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                 setActiveColor(c); activeColorRef.current = c;
                 setStampMode(null); stampModeRef.current = null;
                 setEraserMode(false); eraserModeRef.current = false;
              }}
            />
          ))}
        </div>
        <div className={styles.toolSection} style={{ flexDirection: 'column' }}>
          {COLORS.slice(6).map(c => (
            <button 
              key={c}
              className={`${styles.colorBtn} ${activeColor === c && !eraserMode ? styles.active : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                 setActiveColor(c); activeColorRef.current = c;
                 setStampMode(null); stampModeRef.current = null;
                 setEraserMode(false); eraserModeRef.current = false;
              }}
            />
          ))}
        </div>
        <div className={styles.divider} />
        <div className={styles.toolSection} style={{ flexDirection: 'column' }}>
           <button 
             className={`${styles.sizeBtn} ${brushSize === 2 ? styles.active : ''}`} 
             onClick={() => { setBrushSize(2); brushSizeRef.current = 2; }}
             title="Fine"
           >🖌</button>
           <button 
             className={`${styles.sizeBtn} ${brushSize === 6 ? styles.active : ''}`} 
             onClick={() => { setBrushSize(6); brushSizeRef.current = 6; }}
             title="Medium"
           >🖍</button>
           <button 
             className={`${styles.sizeBtn} ${brushSize === 16 ? styles.active : ''}`} 
             onClick={() => { setBrushSize(16); brushSizeRef.current = 16; }}
             title="Big"
           >💥</button>
        </div>
        <div className={styles.divider} />
        <button 
           className={`${styles.actionBtn} ${eraserMode ? styles.activeAction : ''}`} 
           onClick={() => { 
               const newMode = !eraserMode;
               setEraserMode(newMode); eraserModeRef.current = newMode;
               if (newMode) { setStampMode(null); stampModeRef.current = null; }
           }}
           title="Eraser"
        >🧽</button>
        <button className={styles.actionBtn} onClick={clearWall} title="Clear Wall">🗑️</button>
        <div className={styles.divider} />
        <button 
          className={styles.actionBtn} 
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else containerRef.current.requestFullscreen();
          }} 
          title="Full Screen"
        >📺</button>
        <button 
          className={`${styles.actionBtn} ${hideUI ? styles.activeAction : ''}`} 
          onClick={() => setHideUI(!hideUI)} 
          title="Toggle Chat"
        >{hideUI ? '💬' : '🙈'}</button>
      </div>
    </div>
  );
}
