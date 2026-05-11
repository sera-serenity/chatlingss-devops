import React, { useEffect, useState, useRef } from 'react';
import styles from './TypingRaceGame.module.css';
import { io } from 'socket.io-client';
import ResultModal from './ResultModal';

export default function TypingRaceGame({ token, user, room, onLogout, onLeaveRoom }) {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState({ state: 'waiting', targetSentence: '', timeRemaining: 0, scores: {} });
  const [chatInput, setChatInput] = useState('');

  // ── Game lifecycle ──
  const [lifecycle, setLifecycle] = useState({ gameId: null, status: 'idle', scores: {}, players: [] });

  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const s = io(process.env.REACT_APP_GAME_URL || 'http://localhost:5004', {
      auth: { token },
      query: { roomId: room._id || room.name, roomType: 'game', gameType: 'typing_race' }
    });
    setSocket(s);
    socketRef.current = s;

    s.on('init', (data) => {
      setPlayers(data.players || {});
    });

    s.emit('joinGame', { room: room._id || room.name });

    s.on('gameState', (state) => {
      setGameState(state);
      if (state.state === 'playing' && inputRef.current) {
        inputRef.current.focus();
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

    s.on('message', (msg) => {
      setMessages(prev => [...prev, msg].slice(-100));
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

  const handleChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.emit('chatMessage', { text: chatInput });
    setChatInput('');
  };

  const getMatchedChars = () => {
    if (!gameState.targetSentence) return 0;
    let matchCount = 0;
    for (let i = 0; i < chatInput.length; i++) {
        if (i < gameState.targetSentence.length && chatInput[i] === gameState.targetSentence[i]) {
            matchCount++;
        } else {
            break;
        }
    }
    return matchCount;
  };

  const matchedChars  = getMatchedChars();
  const sortedScores  = Object.entries(gameState.scores).sort((a,b) => b[1]-a[1]);

  const handlePlayAgain = () => {
    // 1. Reset lifecycle and state
    setLifecycle({ gameId: null, status: 'idle', scores: {}, players: [] });
    setGameState({ state: 'waiting', targetSentence: '', timeRemaining: 0, scores: {} });
    setMessages([]);
    setChatInput('');
    
    // 2. Re-join
    socketRef.current?.emit('joinGame', { room: room._id || room.name });
    console.log("🔄 Typing Race Refresh: State cleared.");
  };

  return (
    <div className={styles.gameContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.leaveBtn} onClick={onLeaveRoom}>← Leave Game</button>
          <h2>{room.name}</h2>
        </div>
        <div className={styles.timerDisplay}>⏱️ {gameState.timeRemaining || 0}s</div>
      </div>

      <div className={styles.gameBody}>
        {/* Main Race Area */}
        <div className={styles.raceArea}>
          
          <div className={styles.raceBoard}>
             {gameState.state === 'waiting' && <h2 className={styles.statusMsg}>Waiting for players or next round... ⏳</h2>}
             {gameState.state === 'countdown' && <h1 className={styles.countdown}>{gameState.timeRemaining}</h1>}
             {gameState.state === 'playing' && (
                 <div className={styles.sentenceCard}>
                    <div className={styles.sentenceWrapper}>
                        <span className={styles.matchedText}>{gameState.targetSentence.substring(0, matchedChars)}</span>
                        <span className={styles.unmatchedText}>{gameState.targetSentence.substring(matchedChars)}</span>
                    </div>
                 </div>
             )}
          </div>

          <form className={styles.typeInputContainer} onSubmit={handleChat}>
             <input 
               ref={inputRef}
               className={styles.typeInput}
               value={chatInput} 
               onChange={e => setChatInput(e.target.value)} 
               placeholder={gameState.state === 'playing' ? "Type here as fast as you can! ⌨️🔥" : "Wait for the round to start..."} 
               disabled={gameState.state !== 'playing'} 
               autoComplete="off"
               spellCheck="false"
             />
          </form>

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
          gameType="typing_race"
          onPlayAgain={handlePlayAgain}
          onLeave={onLeaveRoom}
        />
      )}
    </div>
  );
}
