import React, { useEffect, useRef, useState } from 'react';
import { 
  drawCharacter, drawSceneBase, applyPhysics, drawPlatform,
  SCALE, VW as DEFAULT_VW, VH as DEFAULT_VH, CW, CH, JUMP_V, pickLine, roundRect 
} from '../utils/gameRender';
import styles from './TerritoryCaptureGame.module.css';
import ResultModal from './ResultModal';
import TournamentOverlay from './TournamentOverlay';

const CELL_SIZE = 60; // Increased from 40

export default function TerritoryCaptureGame({ user, players: initialPlayers, roomId, socket, roomTheme, hideUI, setHideUI }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [tournamentData, setTournamentData] = useState(null);

  // ── Game lifecycle ──
  const [lifecycle, setLifecycle] = useState({ gameId: null, status: 'idle', scores: {}, players: [] });

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const T_VW = dimensions.width;
  const T_VH = dimensions.height;
  
  const localRef = useRef({ 
    x: T_VW * 0.1, y: T_VH * 0.5, vx: 0, vy: 0, onGround: false,
    lastSync: 0, avatar: user.avatar, color: user.color, username: user.username,
    mood: 'happy', action: 'idle'
  });
  
  // Single source of truth for others
  const playersRef = useRef({}); 
  const gridRef = useRef({});
  const lastUpdateRef = useRef(performance.now());
  const [notifications, setNotifications] = useState([]);

  const addNotification = (text) => {
    setNotifications(prev => [...prev.slice(-3), { text, id: Date.now() }]);
  };

  useEffect(() => {
    if (setHideUI) setHideUI(true);
    return () => { if (setHideUI) setHideUI(false); };
  }, [setHideUI]);

  useEffect(() => {
    if (!socket) return;
    
    const onGameState = (state) => {
        setGameState(state);
        if (state.players) {
            Object.entries(state.players).forEach(([id, p]) => {
                if (id !== socket.id) {
                    // Only update if we don't have them or they are new
                    if (!playersRef.current[id]) {
                        playersRef.current[id] = { ...p, lerpX: p.x || 0, lerpY: p.y || 0 };
                    } else {
                        playersRef.current[id] = { ...playersRef.current[id], ...p };
                    }
                }
            });
        }
        if (state.grid) {
            gridRef.current = { ...state.grid };
        }
    };
    const onPaintCell = (data) => {
        gridRef.current[data.cell] = data.color;
    };
    const onPlayerUpdated = (p) => {
        if (p.id !== socket.id) {
            if (!playersRef.current[p.id]) {
                playersRef.current[p.id] = { ...p, lerpX: p.x, lerpY: p.y };
            } else {
                playersRef.current[p.id] = { ...playersRef.current[p.id], ...p };
            }
        }
    };
    const onPlayerLeft = (data) => {
        delete playersRef.current[data.id];
    };
    const onMessage = (m) => { if (m.isSystem) addNotification(m.text); };

    const onGameStarted = (data) => {
      setLifecycle({ gameId: data.gameId, status: 'active', scores: {}, players: data.players || [] });
    };
    const onGameEnded = (data) => {
      setLifecycle(prev => ({ ...prev, status: 'ended', scores: data.scores || {}, gameId: data.gameId }));
    };
    const onLeaderboardUpdated = (data) => {
      setTournamentData(data);
    };
    const onTournamentEnded = (data) => {
      setTournamentData(data);
      addNotification("🏆 TOURNAMENT FINISHED!");
    };
    
    socket.on('gameState', onGameState);
    socket.on('paintCell', onPaintCell);
    socket.on('playerUpdated', onPlayerUpdated);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('message', onMessage);
    socket.on('GAME_STARTED', onGameStarted);
    socket.on('GAME_ENDED', onGameEnded);
    socket.on('LEADERBOARD_UPDATED', onLeaderboardUpdated);
    socket.on('TOURNAMENT_ENDED', onTournamentEnded);
    
    return () => {
        socket.off('gameState', onGameState);
        socket.off('paintCell', onPaintCell);
        socket.off('playerUpdated', onPlayerUpdated);
        socket.off('playerLeft', onPlayerLeft);
        socket.off('message', onMessage);
        socket.off('GAME_STARTED', onGameStarted);
        socket.off('GAME_ENDED', onGameEnded);
        socket.off('LEADERBOARD_UPDATED', onLeaderboardUpdated);
        socket.off('TOURNAMENT_ENDED', onTournamentEnded);
    };
  }, [socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const keys = {};
    const handleDown = (e) => { 
        if (document.activeElement?.tagName === 'INPUT') return;
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
    
    const loop = (now) => {
        const dt = Math.min(0.033, (now - lastUpdateRef.current) / 1000);
        lastUpdateRef.current = now;

        const speed = 500; 
        local.vx = 0; local.vy = 0;
        if (keys['arrowleft'] || keys['a']) local.vx = -speed;
        if (keys['arrowright'] || keys['d']) local.vx = speed;
        if (keys['arrowup'] || keys['w']) local.vy = -speed;
        if (keys['arrowdown'] || keys['s']) local.vy = speed;

        local.x += local.vx * dt;
        local.y += local.vy * dt;

        if (local.x < 0) local.x = 0;
        if (local.x > T_VW - CW) local.x = T_VW - CW;
        if (local.y < 0) local.y = 0;
        if (local.y > T_VH - CH) local.y = T_VH - CH;

        if (now - (local.lastSync || 0) > 40) {
            socket?.emit('updatePosition', { x: local.x, y: local.y });
            local.lastSync = now;
        }

        ctx.clearRect(0, 0, T_VW, T_VH);
        ctx.fillStyle = '#fdfdfd'; // Lighter bg
        ctx.fillRect(0, 0, T_VW, T_VH);
        
        // Grid lines
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        for(let i=0; i<T_VW; i+=CELL_SIZE) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, T_VH); ctx.stroke(); }
        for(let i=0; i<T_VH; i+=CELL_SIZE) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(T_VW, i); ctx.stroke(); }
        
        // Painted territory
        ctx.globalAlpha = 0.8;
        Object.entries(gridRef.current).forEach(([cell, color]) => {
            const [cx, cy] = cell.split(',').map(Number);
            ctx.fillStyle = color;
            ctx.fillRect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        });
        ctx.globalAlpha = 1.0;

        // Update other players lerp
        Object.entries(playersRef.current).forEach(([id, p]) => {
            if (p.x === undefined || p.y === undefined) return;
            p.lerpX = p.lerpX === undefined ? p.x : p.lerpX;
            p.lerpY = p.lerpY === undefined ? p.y : p.lerpY;
            p.lerpX += (p.x - p.lerpX) * 0.2; 
            p.lerpY += (p.y - p.lerpY) * 0.2;
        });

        const playersList = [
            { ...local, id: socket?.id || 'local' },
            ...Object.entries(playersRef.current).map(([id, p]) => ({ ...p, id, x: p.lerpX, y: p.lerpY }))
        ].sort((a,b) => (a.y+CH) - (b.y+CH));

        playersList.forEach(p => {
            drawCharacter(ctx, {...p, mood: p.mood || 'happy'}, p.username || 'Friend', { prop: 'bucket', scale: 1.8 });
        });

        animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
        window.removeEventListener('keydown', handleDown);
        window.removeEventListener('keyup', handleUp);
        cancelAnimationFrame(animId);
    };
  }, [socket, user, roomTheme, T_VW, T_VH]);

  const playerLookup = {
    [socket?.id]: { username: user.username, avatar: user.avatar, color: user.color }
  };
  Object.entries(playersRef.current).forEach(([id, p]) => { playerLookup[id] = p; });

  const handlePlayAgain = () => {
    // 1. Reset all source-of-truth refs to avoid stale visuals
    gridRef.current = {};
    playersRef.current = {};
    setNotifications([]);
    
    // 2. Reset local position to starting spot
    localRef.current.x = T_VW * 0.1;
    localRef.current.y = T_VH * 0.5;
    
    // 3. Reset React state
    setLifecycle({ gameId: null, status: 'idle', scores: {}, players: [] });
    setGameState(null); 

    // 4. Re-announce presence to server
    socket?.emit('joinGame', { room: roomId, ...user });
    console.log("🔄 Game Refresh: State cleared, re-joining...");
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#fff' }}>
      {!socket && (
          <div className={styles.waitingOverlay}>
              <div className={styles.waitingBox}>
                  <h3>Initializing Game... ✨</h3>
                  <p>Connecting to Chatlings Game Servers...</p>
              </div>
          </div>
      )}
      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} style={{ width:'100%', height:'100%' }} />
      
      {/* ── Waiting UI ── */}
      {gameState?.state === 'waiting' && (
          <div className={styles.waitingOverlay}>
              <div className={styles.waitingBox}>
                  <h3>Please wait for more players... ✨</h3>
                  <p>Invite your friends to paint the room with you!</p>
                  <div className={styles.playerCount}>
                      🐾 {Object.keys(playerLookup).length} / 2 joined
                  </div>
                  <button className={styles.quitWaitingBtn} onClick={() => window.location.reload()}>
                    Back to Lobby
                  </button>
              </div>
          </div>
      )}

      {/* ── Countdown UI ── */}
      {gameState?.state === 'countdown' && (
          <div className={styles.countdownOverlay}>
              <div className={styles.countdownValue}>{gameState.timeRemaining}</div>
              <div className={styles.countdownText}>GET READY! 🎨</div>
          </div>
      )}

      <div className={styles.hudOverlay}>
        <div className={styles.timeBoard}>
          ⏱️ {gameState?.timeRemaining || 0}s
        </div>

        {tournamentData && (
          <TournamentOverlay 
            cumulativeScores={tournamentData.cumulativeScores} 
            currentGame={tournamentData.currentGame} 
            totalGames={tournamentData.totalGames}
            players={lifecycle.players}
          />
        )}
        
        <div className={styles.scoreBoard}>
            <div className={styles.scoreHead}>Territory 🎨</div>
            {gameState?.scores && Object.entries(gameState.scores).sort((a,b)=>b[1]-a[1]).map(([id, score]) => (
                <div key={id} className={styles.scoreRow}>
                    <span style={{ color: id === socket?.id ? user.color : (playersRef.current[id]?.color || '#ff80bf'), fontWeight: 800 }}>
                        {id === socket?.id ? user.username : (playersRef.current[id]?.username || '...')}
                    </span>
                    <span className={styles.points}>{score}</span>
                </div>
            ))}
        </div>
      </div>

      <div className={styles.notifications}>
          {notifications.map(n => (
            <div key={n.id} className={styles.notifItem}>{n.text}</div>
          ))}
      </div>
      
      <button className={styles.backBtn} onClick={() => window.location.reload()}>
        ← Quit
      </button>

      {lifecycle.status === 'ended' && (
        <ResultModal
          gameId={lifecycle.gameId}
          scores={lifecycle.scores}
          players={playerLookup}
          myId={socket?.id}
          myUser={user}
          gameType="territory_capture"
          onPlayAgain={handlePlayAgain}
          onLeave={() => window.location.reload()}
        />
      )}
    </div>
  );
}
