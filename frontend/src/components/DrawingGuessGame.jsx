import React, { useEffect, useState, useRef } from 'react';
import styles from './DrawingGuessGame.module.css';
import { io } from 'socket.io-client';
import ResultModal from './ResultModal';

const COLORS = ['#ff4d94', '#ff80bf', '#ffb3d9', '#c9a0ff', '#9d8df1', '#85ffcc', '#03a9f4', '#fffb00', '#35263d', '#ffffff'];
const SIZES = [2, 5, 10, 20];

export default function DrawingGuessGame({ token, user, room, onLogout, onLeaveRoom }) {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState({ round: 0, drawerId: null, wordLength: 0, targetWord: '', timeRemaining: 0, scores: {} });
  const [chatInput, setChatInput] = useState('');
  const [wordChoices, setWordChoices] = useState([]);

  // ── Game lifecycle ──
  const [lifecycle, setLifecycle] = useState({ gameId: null, status: 'idle', scores: {}, players: [] });

  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);

  const canvasRef = useRef(null);
  const currentStrokeRef = useRef(null);
  const lastPosRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    const s = io(process.env.REACT_APP_GAME_URL || 'http://localhost:5004', {
      auth: { token },
      query: { roomId: room._id || room.name, roomType: 'game', gameType: 'drawing_guess' }
    });
    setSocket(s);
    socketRef.current = s;

    s.on('init', (data) => {
      setPlayers(data.players || {});
    });

    s.emit('joinGame', { room: room._id || room.name });

    s.on('gameState', (state) => {
      setGameState(state);
      if (state.drawings) {
        state.drawings.forEach(drawStroke);
      }
      if (state.players) {
        setPlayers(prev => ({ ...prev, ...state.players }));
      }
    });

    s.on('playerUpdated', (p) => {
      if (p.id !== s.id) {
        setPlayers(prev => ({ ...prev, [p.id]: { ...prev[p.id], ...p } }));
      }
    });

    s.on('playerLeft', (data) => {
      setPlayers(prev => {
        const next = { ...prev };
        delete next[data.id];
        return next;
      });
    });

    s.on('wordChoices', (choices) => setWordChoices(choices));

    s.on('message', (msg) => {
      setMessages(prev => [...prev, msg].slice(-100));
    });



    s.on('draw', drawStroke);
    s.on('clearCanvas', () => {
      const cvs = canvasRef.current;
      if (cvs) cvs.getContext('2d').clearRect(0,0,cvs.width,cvs.height);
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
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const drawStroke = (stroke) => {
    const { points, color, size, eraser } = stroke;
    if (points.length < 2) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = eraser ? '#ffffff' : color;
    ctx.lineWidth = size;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  };

  const isDrawer = gameState.drawerId === socket?.id;

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: ((cx - rect.left)/rect.width)*canvas.width, y: ((cy - rect.top)/rect.height)*canvas.height };
  };

  const startDrawing = (e) => {
    if (!isDrawer || !gameState.targetWord) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getMousePos(e);
    lastPosRef.current = pos;
    currentStrokeRef.current = { color, size, eraser: eraserMode, points: [pos] };
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing || !currentStrokeRef.current) return;
    const pos = getMousePos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = eraserMode ? '#ffffff' : color; ctx.lineWidth = size;
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    currentStrokeRef.current.points.push(pos);
    lastPosRef.current = pos;
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStrokeRef.current && socketRef.current) {
      if (currentStrokeRef.current.points.length > 1) socketRef.current.emit('draw', currentStrokeRef.current);
    }
    currentStrokeRef.current = null;
  };

  const handleChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.emit('chatMessage', { text: chatInput });
    setChatInput('');
  };

  const sortedScores = Object.entries(gameState.scores).sort((a,b) => b[1]-a[1]);

  const handlePlayAgain = () => {
    // 1. Reset lifecycle and state
    setLifecycle({ gameId: null, status: 'idle', scores: {}, players: [] });
    setGameState({ round: 0, drawerId: null, wordLength: 0, targetWord: '', timeRemaining: 0, scores: {} });
    setMessages([]);
    setWordChoices([]);
    
    // 2. Clear Canvas
    const cvs = canvasRef.current;
    if (cvs) cvs.getContext('2d').clearRect(0,0,cvs.width,cvs.height);
    
    // 3. Re-join
    socketRef.current?.emit('joinGame', { room: room._id || room.name });
    console.log("🔄 Drawing Game Refresh: UI Cleared.");
  };

  return (
    <div className={styles.gameContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.leaveBtn} onClick={onLeaveRoom}>← Leave Game</button>
          <h2>{room.name}</h2>
        </div>
        
        <div className={styles.wordDisplay}>
           {isDrawer && !gameState.targetWord && <span className={styles.hint}>Waiting for word selection...</span>}
           {isDrawer && gameState.targetWord && <span className={styles.targetWord}>{gameState.targetWord}</span>}
           {!isDrawer && gameState.targetWord && <span className={styles.wordBlanks}>{gameState.targetWord.replace(/[a-zA-Z]/g, '_ ')}</span>}
           {!isDrawer && !gameState.targetWord && <span className={styles.hint}>Awaiting new round...</span>}
        </div>
        
        <div className={styles.timerDisplay}>⏱️ {gameState.timeRemaining}s</div>
      </div>

      <div className={styles.gameBody}>
        {/* Canvas Area */}
        <div className={styles.canvasArea}>
          
          {isDrawer && !gameState.targetWord && wordChoices.length > 0 && (
            <div className={styles.wordSelectorOverlay}>
              <div className={styles.wordSelectorModal}>
                <h3>Choose a word to draw! 🎨</h3>
                <div className={styles.choices}>
                  {wordChoices.map(w => (
                    <button key={w} onClick={() => {
                        socketRef.current?.emit('gameAction', { action: 'selectWord', word: w });
                        setWordChoices([]);
                    }}>{w}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isDrawer && gameState.drawerId && !gameState.targetWord && (
             <div className={styles.waitingOverlay}>
               <h3>{players[gameState.drawerId]?.username || 'Someone'} is choosing a word... 🤔</h3>
             </div>
          )}

          <canvas 
            ref={canvasRef} width={800} height={600} className={`${styles.canvas} ${isDrawer ? styles.canDraw : ''}`}
            onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={finishDrawing} onMouseLeave={finishDrawing}
          />
          
          {isDrawer && (
            <div className={styles.toolbar}>
              {COLORS.map(c => <button key={c} className={`${styles.colorBtn} ${color === c ? styles.active : ''}`} style={{background:c}} onClick={() => {setColor(c);setEraserMode(false)}} />)}
              <div className={styles.divider} />
              {SIZES.map(s => <button key={s} className={`${styles.sizeBtn} ${size === s ? styles.active : ''}`} onClick={() => setSize(s)}><div style={{width:s,height:s,background:eraserMode?'#ccc':color,borderRadius:'50%'}}/></button>)}
              <div className={styles.divider} />
              <button className={`${styles.actionBtn} ${eraserMode ? styles.activeAction : ''}`} onClick={() => setEraserMode(!eraserMode)}>🧹</button>
              <button className={styles.actionBtn} onClick={() => {socketRef.current?.emit('clearCanvas'); canvasRef.current.getContext('2d').clearRect(0,0,800,600)}}>💣</button>
            </div>
          )}

          {/* ── Waiting UI ── */}
          {gameState?.state === 'waiting' && (
              <div className={styles.waitingOverlay}>
                  <div className={styles.waitingBox}>
                      <h3>Waiting for more friends... ✨</h3>
                      <div className={styles.playerCount}>
                          🐾 {Object.keys(players).length + 1} / 2 joined
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
        </div>

        {/* Right Sidebar */}
        <div className={styles.sidebar}>
          
          <div className={styles.leaderboard}>
            <h3>🏆 Leaderboard</h3>
            {sortedScores.map(([id, score], idx) => (
              <div key={id} className={styles.lbRow}>
                <span className={styles.lbRank}>{idx+1}.</span>
                <span className={styles.lbName}>{players[id]?.username || (id === socket?.id ? user.username : 'Player')}</span>
                <span className={styles.lbScore}>{score} pts</span>
              </div>
            ))}
          </div>

          <div className={styles.chatWrapper}>
            <div className={styles.chatLog} ref={logRef}>
              {messages.map((m, i) => (
                <div key={i} className={`${styles.msg} ${m.isSystem ? styles.systemMsg : ''} ${m.isSuccess ? styles.successMsg : ''}`}>
                  {!m.isSystem && <b>{m.sender}: </b>}
                  <span>{m.text}</span>
                </div>
              ))}
            </div>
            <form className={styles.chatForm} onSubmit={handleChat}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type your guess here..." disabled={isDrawer} />
            </form>
          </div>
        </div>
      </div>

      {/* ── Result Modal ──────────────────────────────────────────────── */}
      {lifecycle.status === 'ended' && (
        <ResultModal
          gameId={lifecycle.gameId}
          scores={lifecycle.scores}
          players={players}
          myId={socket?.id}
          myUser={user}
          gameType="drawing_guess"
          onPlayAgain={handlePlayAgain}
          onLeave={onLeaveRoom}
        />
      )}
    </div>
  );
}
