import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { 
  drawCharacter, drawSceneBase, applyPhysics, drawPlatform,
  SCALE as DEFAULT_SCALE, VW, VH, CW, CH, JUMP_V, pickLine, roundRect 
} from '../utils/gameRender';
import styles from './EmojiCatchGame.module.css';
import ResultModal from './ResultModal';

const EC_SCALE = 0.55;

export default function EmojiCatchGame({ token, user, room, onLeaveRoom }) {
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [gameState, setGameState] = useState(null);
  const playersRef = useRef({});
  const localRef = useRef({ 
    x: VW/2, y: VH * 0.85 - CH, vx: 0, vy: 0, onGround: false,
    lastSync: 0
  });
  const gameStateRef = useRef(null);
  const lastUpdateRef = useRef(performance.now());
  const effectsRef = useRef([]);
  const [notifications, setNotifications] = useState([]);

  // ── Game lifecycle ──
  const [lifecycle, setLifecycle] = useState({ gameId: null, status: 'idle', scores: {}, players: [] });

  const addNotification = (text) => {
    setNotifications(prev => [...prev.slice(-3), { text, id: Date.now() }]);
  };

  useEffect(() => {
    const s = io(process.env.REACT_APP_GAME_URL || 'http://localhost:5004', {
      auth: { token },
      query: { roomId: room._id || room.name, roomType: 'game', gameType: 'emoji_catch' }
    });
    setSocket(s);
    socketRef.current = s;
    s.emit('joinGame', { room: room._id || room.name });

    s.on('gameState', (state) => {
        setGameState(state);
        gameStateRef.current = state;
        if (state.players) {
            Object.entries(state.players).forEach(([id, p]) => {
                if (id !== s.id) {
                    playersRef.current[id] = { ...playersRef.current[id], ...p };
                }
            });
        }
    });
    s.on('playerUpdated', (p) => { 
        if (p.id !== s.id) {
            playersRef.current[p.id] = { ...playersRef.current[p.id], ...p };
        } 
    });
    s.on('playerLeft', (data) => {
        delete playersRef.current[data.id];
    });
    s.on('message', (m) => { if (m.isSystem) addNotification(m.text); });
    s.on('emojiCaught', (data) => {
        if (data.playerId === s.id) {
            effectsRef.current.push({ x: VW/2, y: VH/2, t: 0, life: 1000, text: data.points > 0 ? `+${data.points}!` : `${data.points}!`, color: data.points > 0 ? '#ffeb3b' : '#ff4d4d' });
        }
    });

    // ── Pipeline events ──
    s.on('GAME_STARTED', (data) => {
      setLifecycle({ gameId: data.gameId, status: 'active', scores: {}, players: data.players || [] });
    });
    s.on('GAME_ENDED', (data) => {
      setLifecycle(prev => ({ ...prev, status: 'ended', scores: data.scores || {}, gameId: data.gameId }));
    });

    return () => s.disconnect();
  }, [token, room]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const keys = {};
    const handleDown = (e) => { 
        const k = e.key.toLowerCase();
        if (['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d',' '].includes(k)) { 
            e.preventDefault(); 
            keys[k] = true; 
        } 
    };
    const handleUp = (e) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);

    const local = localRef.current;
    local.avatar = user.avatar; local.color = user.color; local.username = user.username;
    local.mood = 'happy'; local.action = 'idle';

    const drawFallingObject = (ctx, x, y, type, t) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t / 500);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#35263d';
        
        if (type === 'star') {
            ctx.fillStyle = '#ffea00';
            ctx.beginPath();
            for(let i=0; i<5; i++) {
                ctx.rotate(Math.PI / 2.5);
                ctx.lineTo(0, 15);
                ctx.rotate(Math.PI / 2.5);
                ctx.lineTo(0, 6);
            }
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(Math.sin(t/100)*10, Math.cos(t/100)*10, 2, 0, Math.PI*2); ctx.fill();
        } else if (type === 'heart') {
            ctx.fillStyle = '#ff80bf';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-10, -10, -20, 0, 0, 15); ctx.bezierCurveTo(20, 0, 10, -10, 0, 0); ctx.fill(); ctx.stroke();
        } else if (type === 'skull') {
            ctx.fillStyle = '#f5f5f5';
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#35263d'; ctx.beginPath(); ctx.arc(-4, -2, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4, -2, 3, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = '#9c27b0';
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    };

    const platforms = [
        {x: 100, y: VH * 0.65, w: 200},
        {x: 900, y: VH * 0.65, w: 200},
        {x: 500, y: VH * 0.50, w: 200}
    ];

    const loop = (now) => {
        const dt = Math.min(0.033, (now - lastUpdateRef.current) / 1000);
        lastUpdateRef.current = now;

        const speed = 400;
        if (keys['arrowleft'] || keys['a']) local.vx = -speed;
        else if (keys['arrowright'] || keys['d']) local.vx = speed;
        else local.vx *= 0.85;

        if ((keys['arrowup'] || keys['w'] || keys[' ']) && local.onGround) {
            local.vy = -JUMP_V; local.onGround = false;
        }

        applyPhysics(local, dt, VW, VH, VH * 0.85, platforms);

        if (now - (local.lastSync || 0) > 40) {
            socketRef.current?.emit('updatePosition', { x: local.x, y: local.y });
            local.lastSync = now;
        }

        ctx.save();
        ctx.scale(EC_SCALE, EC_SCALE);
        ctx.clearRect(0,0,VW,VH);
        drawSceneBase(ctx, 'green', VW, VH, VH * 0.85);

        platforms.forEach(p => drawPlatform(ctx, p));

        Object.entries(playersRef.current).forEach(([id, p]) => {
            if (p.x === undefined || p.y === undefined) return;
            p.lerpX = p.lerpX === undefined ? p.x : p.lerpX;
            p.lerpY = p.lerpY === undefined ? p.y : p.lerpY;
            p.lerpX += (p.x - p.lerpX) * 0.2; 
            p.lerpY += (p.y - p.lerpY) * 0.2;
        });

        const state = gameStateRef.current;
        if (state?.objects) {
            state.objects.forEach(obj => {
                drawFallingObject(ctx, obj.x, obj.y, obj.type, now);
            });
        }

        const playersList = [
            {...local, id: (socketRef.current?.id || 'local')},
            ...Object.entries(playersRef.current).map(([id, p]) => ({
                ...p, id, x: p.lerpX, y: p.lerpY 
            }))
        ].sort((a,b) => (a.y+CH) - (b.y+CH));

        playersList.forEach(p => {
            const props = { prop: 'bucket' };
            drawCharacter(ctx, p, p.username || 'Friend', props);
        });

        for(let i=effectsRef.current.length-1; i>=0; i--) {
            const e = effectsRef.current[i]; e.t += dt*1000;
            const alpha = 1 - e.t/e.life;
            ctx.save(); ctx.globalAlpha = alpha;
            ctx.fillStyle = e.color; ctx.font = 'bold 30px Nunito'; ctx.textAlign = 'center';
            ctx.fillText(e.text, e.x, e.y - (e.t/10));
            ctx.restore();
            if (e.t >= e.life) effectsRef.current.splice(i,1);
        }

        ctx.restore();
        animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
        window.removeEventListener('keydown', handleDown);
        window.removeEventListener('keyup', handleUp);
        cancelAnimationFrame(animId);
    };
  }, [socket, user]);

  const playerLookup = {
    [socket?.id]: { username: user.username, avatar: user.avatar, color: user.color }
  };
  Object.entries(playersRef.current).forEach(([id, p]) => { playerLookup[id] = p; });

  const handlePlayAgain = () => {
    // 1. Reset source-of-truth refs
    playersRef.current = {};
    gameStateRef.current = null;
    effectsRef.current = [];
    setNotifications([]);
    
    // 2. Reset local position
    localRef.current.x = VW/2;
    localRef.current.y = VH * 0.85 - CH;
    
    // 3. Reset React state
    setLifecycle({ gameId: null, status: 'idle', scores: {}, players: [] });
    setGameState(null);

    // 4. Re-join
    socketRef.current?.emit('joinGame', { room: room._id || room.name });
    console.log("🔄 Emoji Catch Refresh: State cleared.");
  };

  return (
    <div className={styles.gameWrapper}>
      <div className={styles.hud}>
        <button onClick={onLeaveRoom} className={styles.backBtn}>← Quit</button>
        <div className={styles.gameTitle}>Catch the Spells! 🌟</div>
        <div className={styles.timerBox}>⏱️ {gameState?.timeRemaining || 0}s</div>
      </div>

      <div className={styles.canvasContainer}>
        <canvas ref={canvasRef} width={VW * EC_SCALE} height={VH * EC_SCALE} className={styles.canvas} />
        <div className={styles.notifications}>
          {notifications.map(n => (
            <div key={n.id} className={styles.notifItem}>{n.text}</div>
          ))}
        </div>

        {/* ── Waiting UI ── */}
        {gameState?.state === 'waiting' && (
            <div className={styles.waitingOverlay}>
                <div className={styles.waitingBox}>
                    <h3>Waiting for more friends... ✨</h3>
                    <div className={styles.playerCount}>
                        🐾 {Object.keys(playerLookup).length} / 2 joined
                    </div>
                    <button className={styles.quitWaitingBtn} onClick={onLeaveRoom}>
                        Back to Lobby
                    </button>
                </div>
            </div>
        )}

        {/* ── Countdown UI ── */}
        {gameState?.state === 'countdown' && (
            <div className={styles.countdownOverlay}>
                <div className={styles.countdownValue}>{gameState.timeRemaining}</div>
                <div className={styles.countdownText}>GET READY! ✨</div>
            </div>
        )}

        <div className={styles.scores}>
           <div className={styles.scoreHead}>Scoreboard</div>
           {gameState?.scores && Object.entries(gameState.scores).sort((a,b)=>b[1]-a[1]).map(([id, score]) => (
               <div key={id} className={styles.scoreRow}>
                   <span>{playersRef.current[id]?.username || (id === socket?.id ? user.username : '...')}</span>
                   <span className={styles.points}>{score} pts</span>
               </div>
           ))}
        </div>
      </div>

      {/* ── Result Modal ──────────────────────────────────────────────── */}
      {lifecycle.status === 'ended' && (
        <ResultModal
          gameId={lifecycle.gameId}
          scores={lifecycle.scores}
          players={playerLookup}
          myId={socket?.id}
          myUser={user}
          gameType="emoji_catch"
          onPlayAgain={handlePlayAgain}
          onLeave={onLeaveRoom}
        />
      )}
    </div>
  );
}
