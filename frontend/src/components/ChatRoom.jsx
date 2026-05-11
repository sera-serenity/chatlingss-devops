import React, { useEffect, useState, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket, connectGameSocket, getGameSocket } from '../services/socketService';
import GameCanvas from './GameCanvas';
import MovieTheatre from './MovieTheatre';
import DrawingBoard from './DrawingBoard';
import StudyRoom from './StudyRoom';
import StreetWallRoom from './StreetWallRoom';
import TerritoryCaptureGame from './TerritoryCaptureGame';

import styles from './ChatRoom.module.css';
import { incrementStat, sendFriendRequest } from '../services/authService';

// removed THEMES

const AVATAR_EMOJI = { bunny: '🐰', cat: '🐱', dog: '🐶' };

export default function ChatRoom({ token, user, room, onLogout, onLeaveRoom }) {
  const [messages,    setMessages]    = useState([]);
  const [inputVal,    setInputVal]    = useState('');
  const [onlineCount, setOnlineCount] = useState(1);
  const [players,     setPlayers]     = useState({});
  const [socket,      setSocket]      = useState(null);
  const [gameSocket,  setGameSocket]  = useState(null);
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [activeFilter, setActiveFilter] = useState('none'); // none, pink, sepia
  const [editorItems, setEditorItems] = useState([]); // { id, x, y, type: 'sticker'|'text', value, color }
  const [editingTextId, setEditingTextId] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [isSendingEmoji, setIsSendingEmoji] = useState(false);
  const [roomMusic, setRoomMusic] = useState(null); // { url, title, playing, sender, videoId }
  const [showMusicInput, setShowMusicInput] = useState(false);
  const [musicInput, setMusicInput] = useState('');
  
  const [roomInfo, setRoomInfo] = useState(null);
  const [showMemory, setShowMemory] = useState(false);
  const [hideUI, setHideUI] = useState(false);
  const [activePoll, setActivePoll] = useState(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''] });
  const [showDashboard, setShowDashboard] = useState(false);
  const [notification, setNotification] = useState(null); // { type, fromName, fromId }
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const logRef = useRef(null);

  const roomId    = room?._id   || room?.name || 'global';
  const roomName  = room?.name  || 'Global Room';
  const roomTheme = room?.theme || '🌈';
  const roomType  = room?.roomType || 'standard';

  useEffect(() => {
    const s = connectSocket(token);
    setSocket(s);
    window.chatSocket = s;

    const gs = connectGameSocket(token, { 
      roomType: room?.roomType || 'standard',
      gameType: room?.gameType || '' 
    });
    console.log('🔌 Initializing Game Socket...', { roomType: room?.roomType, gameType: room?.gameType });
    setGameSocket(gs);

    s.on('connect', () => {
      // ── RECOVERABILITY: read persisted timestamp from localStorage ──
      // On reconnect this sends the last seen timestamp so the server
      // returns only messages the client missed while disconnected.
      const storedTs = localStorage.getItem(`cutechat_lastSeen_${roomId}`);
      const lastSeenTimestamp = storedTs || null;
      s.emit('join', { room: roomId, lastSeenTimestamp, ...user });
      incrementStat(token, 'roomsJoined').catch(console.error);
    });

    gs.on('connect', () => {
      gs.emit('joinGame', { room: roomId, ...user });
      // ── RECOVERABILITY: also emit rejoinGame in case we're reconnecting mid-game ──
      // The server will restore state if a game is already in progress.
      gs.emit('rejoinGame', { room: roomId });
    });
    if (gs.connected) {
      gs.emit('joinGame', { room: roomId, ...user });
      gs.emit('rejoinGame', { room: roomId });
    }

    s.on('init', (data) => {
      const history = (data.chatHistory || []).slice(-40);
      setMessages(history);
      setOnlineCount(data.roomOnlineCount || Object.keys(data.players || {}).length + 1);
      setPlayers(data.players || {});
      setHideUI(false);
      if (data.music) setRoomMusic(data.music);
      if (data.roomInfo) setRoomInfo(data.roomInfo);

      // ── RECOVERABILITY: persist latest message timestamp ──
      // Next connect/reconnect will use this to fetch only missed messages.
      if (history.length > 0) {
        const latestTs = history[history.length - 1]?.ts;
        if (latestTs) {
          localStorage.setItem(`cutechat_lastSeen_${roomId}`, latestTs);
        }
      }
    });

    s.on('roomUpdate', (update) => {
      if (update.type === 'pin') {
        setRoomInfo(prev => ({
          ...prev,
          pinnedMessages: [...(prev.pinnedMessages || []), update.data],
          memory: [...(prev.memory || []), { type: 'pinned', content: update.data.text, author: update.data.senderName, timestamp: update.data.timestamp }]
        }));
      }
    });

    s.on('pollUpdate', (poll) => {
      setActivePoll(poll);
    });

    s.on('pollVoteUpdate', (voteData) => {
      setActivePoll(prev => {
        if (!prev) return null;
        const newOptions = [...prev.options];
        const optIdx = newOptions.indexOf(voteData.option);
        if (optIdx !== -1) {
            // This is naive, ideally votes are tracked by user
        }
        return { ...prev };
      });
    });

    s.on('musicUpdate', (m) => {
      setRoomMusic(m);
    });

    s.on('friendRequestIncoming', (data) => {
      setNotification({ type: 'friendRequest', ...data });
      setTimeout(() => setNotification(null), 10000);
    });

    s.on('friendRequestUpdate', (data) => {
      setNotification({ type: 'friendUpdate', ...data });
      setTimeout(() => setNotification(null), 5000);
    });

    const handlePlayerClick = async (e) => {
      const p = e.detail;
      if (p.userId === user.id) return;
      if (window.confirm(`Send a friend request to ${p.username}? ✨`)) {
        try {
          await sendFriendRequest(token, p.userId);
          s.emit('friendRequest', { targetUserId: p.userId });
          setNotification({ type: 'friendUpdate', fromName: p.username, accepted: 'sent' });
          setTimeout(() => setNotification(null), 3000);
        } catch (err) { alert(err.response?.data?.error || "Error sending request"); }
      }
    };
    window.addEventListener('playerClicked', handlePlayerClick);

    s.on('playerJoined', (p) => {
        setPlayers(prev => ({ ...prev, [p.id]: p }));
        setMessages(prev => [...prev, {
          isSystem: true,
          messageId: `sys-join-${Date.now()}-${p.id}`,
          text: `✨ ${p.username || p.name || 'Someone'} joined the room!`
        }].slice(-50));
    });

    s.on('playerLeft', (id) => {
        setPlayers(prev => {
            const next = { ...prev };
            const p = next[id];
            if (p) {
              setMessages(msgs => [...msgs, {
                isSystem: true,
                messageId: `sys-leave-${Date.now()}-${id}`,
                text: `👋 ${p.username || p.name || 'Someone'} left the room.`
              }].slice(-50));
            }
            delete next[id];
            return next;
        });
    });

    s.on('playerUpdated', (p) => {
        setPlayers(prev => ({ ...prev, [p.id]: p }));
    });

    s.on('roomOnlineCount', (data) => {
      if (data.roomId === roomId) setOnlineCount(data.count);
    });

    s.on('chat', (entry) => {
      setMessages((prev) => {
        if (prev.some(m => m.messageId === entry.messageId)) return prev;
        const updated = [...prev, entry].slice(-50);
        // Persist latest timestamp for recoverability
        if (entry.ts) localStorage.setItem(`cutechat_lastSeen_${roomId}`, entry.ts);
        return updated;
      });
      if (entry.messageId && entry.userId !== user.id && entry.sender !== user.username) {
        // Always mark delivered (message reached device)
        s.emit('messageDelivered', entry.messageId);
        // Mark seen ONLY if chat panel is currently visible
        if (!hideUI) {
          s.emit('messageSeen', entry.messageId);
        }
      }
    });

    return () => {
      s.off('init');
      s.off('roomUpdate');
      s.off('chat');
      s.off('receiveMessage');
      s.off('playerJoined');
      s.off('playerLeft');
      s.off('onlineCount');
      s.off('musicUpdate');
      s.off('movieUpdate');
    };
  }, [token, user, roomId]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const socket = getSocket();
    if (!socket) return;
    
    // Using simple emit for now; real retry logic could wrap this.
    socket.emit('chat', { text: inputVal.trim() }, (response) => {
      if (!response.success) {
        console.error("Message failed to send:", response.error);
        alert("Failed to send message. Please try again.");
      }
    });
    setInputVal('');
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err) {
      console.error("Camera error:", err);
      alert("Camera access denied or device not found! 🥺");
    }
  };

  useEffect(() => {
    if (showCamera && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.error("Play error:", e));
    }
  }, [showCamera, cameraStream]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCapturedImage(null);
    setEditorItems([]);
    setEditingTextId(null);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = photoCanvasRef.current;
    if (!video || !canvas) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Un-mirror the capture to match preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset

    if (activeFilter === 'pink') {
      ctx.fillStyle = 'rgba(255, 182, 193, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (activeFilter === 'sepia') {
      // Sepia is trickier on canvas, we'll stick to a basic overlay or just accept the base filter was pre-applied
    }
    
    const dataUrl = canvas.toDataURL('image/png');
    console.log("Photo Captured (Un-mirrored)");
    setCapturedImage(dataUrl);
  };

  const addItem = (type, value) => {
    setEditorItems([...editorItems, { 
      id: Date.now(), 
      type, 
      value, 
      x: 100, 
      y: 100,
      color: '#ff80bf'
    }]);
  };

  const handleDragStart = (e, id) => {
    setDragItem(id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!dragItem) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setEditorItems(editorItems.map(item => 
      item.id === dragItem ? { ...item, x, y } : item
    ));
  };

  const STICKERS = {
    heart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><filter id="glow"><feGaussianBlur stdDeviation="1.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#ff4d94" filter="url(#glow)"/></svg>`,
    star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2l-2.81 6.63L2 9.24l5.46 4.73L5.82 21z" fill="#fffb00" stroke="#ff80bf" stroke-width="1"/></svg>`,
    bunny: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff0f9" stroke="#ffb3d9" stroke-width="1"/><path d="M8 8c0-3 1-5 2-5s2 2 2 5M12 8c0-3 1-5 2-5s2 2 2 5" fill="#ffb3d9" stroke="#fff" /><circle cx="9" cy="11" r="1.5" fill="#35263d"/><circle cx="15" cy="11" r="1.5" fill="#35263d"/><path d="M11 14s.5 1 1 1 1-1 1-1" stroke="#ff80bf" fill="none" stroke-linecap="round"/></svg>`,
    cat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f0e6ff" stroke="#c9a0ff" stroke-width="1"/><path d="M6 8l3 3M18 8l-3 3" stroke="#c9a0ff" stroke-width="2"/><path d="M7 6l3 4M17 6l-3 4" fill="#c9a0ff" /><circle cx="9" cy="12" r="1.5" fill="#35263d"/><circle cx="15" cy="12" r="1.5" fill="#35263d"/><path d="M10 15c1 1 3 1 4 0" stroke="#9d8df1" fill="none" stroke-linecap="round"/></svg>`,
    dog: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#e1f5fe" stroke="#03a9f4" stroke-width="1"/><path d="M5 10c0-3 2-4 4-4s4 1 4 4M11 10c0-3 2-4 4-4s4 1 4 4" fill="#81d4fa" /><circle cx="9" cy="13" r="1.5" fill="#35263d"/><circle cx="15" cy="13" r="1.5" fill="#35263d"/><circle cx="12" cy="15" r="1" fill="#01579b"/></svg>`,
    bow: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12c-2-4-8-4-8 0 0 4 6 4 8 0m0 0c2-4 8-4 8 0 0 4-6 4-8 0" fill="#ff80bf" stroke="#fff" /><circle cx="12" cy="12" r="2.5" fill="#fff" stroke="#ff80bf"/></svg>`
  };

  const renderSticker = (type) => {
    return <div dangerouslySetInnerHTML={{ __html: STICKERS[type] }} style={{ width: 60, height: 60, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.1))' }} />;
  };

  const sendSelfie = async () => {
    if (isSendingEmoji || !capturedImage) return;
    setIsSendingEmoji(true);
    try {
      const baseCanvas = photoCanvasRef.current;
      if (!baseCanvas) throw new Error("Invalid base canvas");

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = baseCanvas.width;
      finalCanvas.height = baseCanvas.height;
      const ctx = finalCanvas.getContext('2d');
      ctx.drawImage(baseCanvas, 0, 0);

      const scaleX = finalCanvas.width / 432;
      const scaleY = finalCanvas.height / 324;

      const drawPromises = editorItems.map(item => {
        return new Promise((resolve) => {
          const nx = item.x * scaleX; 
          const ny = item.y * scaleY;
          if (item.type === 'text') {
            ctx.font = `bold ${finalCanvas.width * 0.08}px Nunito, sans-serif`;
            ctx.fillStyle = item.color;
            ctx.textAlign = 'center';
            ctx.fillText(item.value, nx, ny);
            resolve();
          } else {
            const img = new Image();
            const svg = STICKERS[item.value];
            if (!svg) return resolve();
            img.onload = () => {
              const size = finalCanvas.width * 0.22;
              ctx.drawImage(img, nx - size/2, ny - size/2, size, size);
              resolve();
            };
            img.onerror = resolve;
            img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
          }
        });
      });

      await Promise.all(drawPromises);
      
      const blob = await new Promise(resolve => finalCanvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error("Blob creation failed");

      const formData = new FormData();
      formData.append('file', blob, `selfie_${Date.now()}.png`);
      formData.append('userId', user?.id || 'anonymous');
      formData.append('roomId', roomId);

      const resp = await fetch(`${process.env.REACT_APP_MESSAGE_URL || 'http://localhost:5003'}/api/files/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await resp.json();
      
      if (resp.ok && data.url) {
        getSocket()?.emit('chat', { 
          text: "Look at my selfie! ✨",
          fileUrl: data.url,
          fileType: 'image/png'
        });
        stopCamera();
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err) {
      console.error("Selfie Error:", err);
      alert("Selfie failed: " + err.message);
    } finally {
      setIsSendingEmoji(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', user?.id || 'anonymous');
    formData.append('roomId', roomId);

    try {
      const resp = await fetch(`${process.env.REACT_APP_MESSAGE_URL || 'http://localhost:5003'}/api/files/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await resp.json();
      if (resp.ok && data.url) {
        getSocket()?.emit('chat', { 
          text: `Shared a file: ${data.name}`,
          fileUrl: data.url,
          fileName: data.name,
          fileType: data.type,
          userId: user?.id,
          roomId: roomId
        });
      } else {
        console.error('Upload error:', data);
        alert(`File upload failed: ${data.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('File upload failed! Please check service connection.');
    }
  };

  const handleMusicSubmit = (e) => {
    e.preventDefault();
    if (!musicInput.trim()) return;

    let videoId = '';
    const match = musicInput.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\s]{11})/);
    if (match) videoId = match[1];

    if (!videoId) {
      alert("Invalid YouTube URL! 🌸 Please paste a link like https://youtube.com/watch?v=...");
      return;
    }

    const socket = getSocket();
    if (socket) {
      socket.emit('musicTrack', {
        url: musicInput,
        videoId: videoId,
        title: "Cute Music ✨", // Ideally we'd fetch this, but for now fixed title
        playing: true
      });
    }
    setMusicInput('');
    setShowMusicInput(false);
  };

  const sharedFiles = messages.filter(m => m.fileUrl);

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ display: hideUI ? 'none' : 'flex' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className={styles.backBtn} onClick={onLeaveRoom}>← Lobby</button>
          <div className={styles.logo}>🐾 CuteChat</div>
          <div className={styles.roomBadge}>{roomTheme} {roomName}</div>
        </div>
        <div className={styles.controls}>
          <button className={styles.headerBtn} onClick={() => setShowMusicInput(!showMusicInput)} title="Boombox ✨">💿</button>
          <button className={styles.headerBtn} onClick={() => setShowPollCreator(!showPollCreator)} title="Create Poll">📊</button>
          <button className={styles.headerBtn} onClick={() => setShowFilePanel(!showFilePanel)} title="Shared Files">
            📂 {sharedFiles.length > 0 && <span className={styles.fileCount}>{sharedFiles.length}</span>}
          </button>
          <span className={styles.onlineBadge}>🟢 {onlineCount} online</span>
          <button className={styles.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main className={styles.gameWrapper} style={hideUI ? { padding: 0 } : {}}>
        <div className={styles.gameCanvasArea}>
          {socket && (
            roomTheme.includes('🎬') ? (
              <MovieTheatre user={user} players={players} roomId={roomId} socket={socket} />
            ) : (roomTheme.includes('🖌️') || roomType === 'drawing') ? (
              <DrawingBoard user={user} players={players} socket={socket} hideUI={hideUI} setHideUI={setHideUI} />
            ) : roomTheme.includes('📚') ? (
              <StudyRoom user={user} players={players} roomId={roomId} socket={socket} />
            ) : room?.gameType === 'territory_capture' ? (
              <TerritoryCaptureGame user={user} players={players} roomId={roomId} socket={gameSocket} roomTheme={roomTheme} hideUI={hideUI} setHideUI={setHideUI} />
            ) : (roomTheme.includes('🎨') || roomType === 'graffiti') ? (
              <StreetWallRoom user={user} players={players} roomId={roomId} socket={socket} hideUI={hideUI} setHideUI={setHideUI} />
            ) : (
              <GameCanvas user={user} players={players} roomId={roomId} roomTheme={roomTheme} socket={socket} hideUI={hideUI} setHideUI={setHideUI} />
            )
          )}
        </div>
          
          {/* Chat Box Area */}
          <div className={styles.chatOverlay} style={{ display: hideUI ? 'none' : 'flex', border: '1px solid rgba(255,179,217,0.2)' }}>
            <div className={styles.chatHeader}>Room Chat ✨</div>
            <div className={styles.chatLog} ref={logRef} style={{ minHeight: '100px' }}>
              {messages.map((m, i) => {
                if (m.isSystem) {
                  return (
                    <div key={i} className={`${styles.message} ${styles.systemMessage}`}>
                      {m.text}
                    </div>
                  );
                }

                const isMe = m.userId === user.id || m.sender === user.username;
                const messageClass = isMe ? styles.msgSent : styles.msgReceived;
                
                return (
                  <div key={i} className={`${styles.message} ${messageClass}`}>
                    <div className={styles.messageHeader}>
                      <div className={styles.msgName}>
                        {AVATAR_EMOJI[m.avatar] || '🐾'} {isMe ? 'You' : (m.sender || m.name || 'Anon')}
                      </div>
                    </div>
                    <div className={styles.msgText}>
                      {m.text}
                      {m.fileUrl && (
                        <div className={styles.fileMessage}>
                          {m.fileType?.includes('image') ? (
                            <div className={styles.imageWrapper}>
                              <img src={m.fileUrl} alt="shared" className={styles.msgImage} onClick={() => window.open(m.fileUrl, '_blank')} />
                              <div className={styles.imageHint}>Click to zoom 🔍</div>
                            </div>
                          ) : m.fileType?.includes('pdf') ? (
                            <div className={styles.pdfCard} onClick={() => window.open(m.fileUrl, '_blank')}>
                              <div className={styles.pdfIcon}>📄</div>
                              <div className={styles.pdfInfo}>
                                <div className={styles.pdfName}>{m.fileName}</div>
                                <div className={styles.pdfSize}>PDF Document</div>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.docCard} onClick={() => window.open(m.fileUrl, '_blank')}>
                              <div className={styles.docIcon}>📁</div>
                              <div className={styles.docInfo}>
                                <div className={styles.docName}>{m.fileName}</div>
                                <button className={styles.downloadBtn}>Download</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {isMe && m.status && (
                        <div className={styles.msgStatus} style={{ textAlign: 'right', fontSize: '0.85rem', fontStyle: 'italic', marginTop: '4px', color: m.status === 'seen' ? '#4da6ff' : '#aaa' }}>
                          {m.status === 'sent' && 'Sent'}
                          {m.status === 'delivered' && 'Delivered'}
                          {m.status === 'seen' && (
                            m.seenBy && m.seenBy.length > 0 ? (
                              (m.seenBy.length >= onlineCount - 1 && onlineCount > 1) ? 'Seen by all' : `Seen by ${m.seenBy.length}`
                            ) : 'Seen'
                          )}
                          {m.status === 'failed' && 'Failed'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && <div style={{ color: '#c0a8d0', fontSize: '0.8rem' }}>Welcome to the room! ✨</div>}
            </div>
          </div>


          {/* Room HUDs (Music + Polls + Files now in Header, logic remains) */}
          <div className={styles.roomHuds} style={{ display: hideUI ? 'none' : 'flex' }}>
            {roomMusic && (
              <div className={styles.musicHud}>
                <div className={styles.nowPlaying}>
                  <div className={styles.nowPlayingLabel}>Now Playing ✨</div>
                  <div className={styles.nowPlayingTitle}>{roomMusic.title}</div>
                  <div className={styles.nowPlayingSender}>by {roomMusic.sender}</div>
                </div>
              </div>
            )}
            
            {showMusicInput && (
              <form className={styles.musicInputPanel} onSubmit={handleMusicSubmit}>
                <b>Music Queue ✨</b>
                <div className={styles.songQueue}>
                  {roomInfo?.playlist?.map((s, i) => (
                    <div key={i} className={styles.songItem}>🎵 {s.title}</div>
                  ))}
                  {(!roomInfo?.playlist || roomInfo.playlist.length === 0) && <p style={{fontSize:'0.7rem', color:'#888'}}>Queue is empty</p>}
                </div>
                <input 
                  placeholder="Paste YouTube Link... 🌸" 
                  value={musicInput}
                  onChange={(e) => setMusicInput(e.target.value)}
                  autoFocus
                />
                <button type="submit">Add to Queue ✨</button>
                {roomMusic && <button type="button" onClick={() => getSocket()?.emit('musicTrack', {url:null})}>Stop ✖</button>}
              </form>
            )}
          </div>

          {/* New Panels */}

          {activePoll && (
            <div className={styles.pollPopup}>
              <div className={styles.pollHeader}>
                <h4>Poll: {activePoll.question}</h4>
                <button onClick={() => setActivePoll(null)}>×</button>
              </div>
              <div className={styles.pollOptions}>
                {activePoll.options.map((opt, i) => (
                  <button key={i} className={styles.pollOption} onClick={() => {
                    socket.emit('pollVote', { pollId: activePoll.id, option: opt });
                    setActivePoll(null); // Simple close on vote
                  }}>
                    {opt}
                  </button>
                ))}
              </div>
              <div className={styles.pollFooter}>Started by {activePoll.sender}</div>
            </div>
          )}

          {showPollCreator && (
            <div className={styles.modalOverlay}>
              <div className={styles.modal}>
                <h3>Create a Poll 📊</h3>
                <input 
                  className={styles.modalInput} 
                  placeholder="Question..." 
                  value={pollForm.question}
                  onChange={(e) => setPollForm({...pollForm, question: e.target.value})}
                />
                {pollForm.options.map((opt, i) => (
                  <input 
                    key={i}
                    className={styles.modalInput} 
                    placeholder={`Option ${i+1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollForm.options];
                      next[i] = e.target.value;
                      setPollForm({...pollForm, options: next});
                    }}
                  />
                ))}
                <button className={styles.addOptBtn} onClick={() => setPollForm({...pollForm, options: [...pollForm.options, '']})}>+ Option</button>
                <div className={styles.modalBtns}>
                  <button className={styles.cancelBtn} onClick={() => setShowPollCreator(false)}>Cancel</button>
                  <button className={styles.submitBtn} onClick={() => {
                    socket.emit('pollCreated', pollForm);
                    setShowPollCreator(false);
                  }}>Send Poll ✨</button>
                </div>
              </div>
            </div>
          )}

          {showFilePanel && (
            <div className={styles.filePanel}>
              <h3>Shared Files 🐾</h3>
              <div className={styles.fileList}>
                {sharedFiles.length === 0 && <p>No files shared yet!</p>}
                {sharedFiles.map((f, i) => (
                  <div key={i} className={styles.fileItem} onClick={() => window.open(f.fileUrl, '_blank')}>
                    <div className={styles.fileItemIcon}>
                      {f.fileType?.includes('image') ? '🖼️' : '📄'}
                    </div>
                    <div className={styles.fileItemInfo}>
                      <div className={styles.fileItemName}>{f.fileName}</div>
                      <div className={styles.fileItemSender}>by {f.sender}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {roomMusic && (
            <div style={{ display: 'none' }}>
              <iframe 
                width="0" height="0" 
                src={`https://www.youtube.com/embed/${roomMusic.videoId}?autoplay=1&loop=1&playlist=${roomMusic.videoId}`}
                title="bg-music"
                allow="autoplay"
              />
            </div>
          )}

          <div className={styles.controlsHint}>
            🎮 ← → / A D : Move &nbsp;·&nbsp; Space/W : Jump<br />
            ✨ 1 - 7 : Actions (Wave, Dance, Hug, etc.)
          </div>

          <div className={styles.bottomBar} style={{ display: hideUI ? 'none' : 'flex' }}>
            <div className={styles.inputAvatar}>
              {AVATAR_EMOJI[user?.avatar] || '🐾'}
            </div>
            
            <button type="button" className={styles.cameraBtn} onClick={startCamera}>
              📸
            </button>

            <button type="button" className={styles.attachBtn} onClick={() => fileInputRef.current.click()}>
              📎
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload}
            />
            
            <form onSubmit={handleSend} style={{ flex: 1, display: 'flex', gap: 12 }}>
              <input
                className={styles.input}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={`Message ${roomName}...`}
                autoComplete="off"
              />
              <button type="submit" className={styles.sendBtn}>Send ✨</button>
            </form>
          </div>


        {/* Selfie Modal */}
        {showCamera && (
          <div className={styles.cameraOverlay}>
            <div className={styles.cameraCard}>
              <div className={styles.cameraHeader}>
                <h3>Selfie Time! ✨🤳</h3>
                <button onClick={stopCamera}>×</button>
              </div>
              
              <div className={styles.cameraPreview} onDragOver={handleDragOver}>
                {!capturedImage ? (
                  <video ref={videoRef} autoPlay playsInline muted className={styles.videoStream} />
                ) : (
                  <div className={styles.editorArea}>
                    <img src={capturedImage} alt="captured" className={styles.capturedImg} />
                    {editorItems.map(item => (
                      <div 
                        key={item.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        className={styles.editorItem} 
                        style={{ left: `${item.x}px`, top: `${item.y}px`, color: item.color }}
                      >
                        {item.type === 'text' ? (
                          <input 
                            value={item.value} 
                            onChange={(e) => setEditorItems(editorItems.map(i => i.id === item.id ? { ...i, value: e.target.value } : i))}
                            className={styles.textInput}
                            autoFocus
                          />
                        ) : (
                          renderSticker(item.value)
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <canvas ref={photoCanvasRef} style={{ display: 'none' }} />
              </div>

              <div className={styles.cameraControls}>
                {!capturedImage ? (
                  <>
                    <div className={styles.filterRow}>
                      <button onClick={() => setActiveFilter('none')} className={activeFilter==='none' ? styles.active : ''}>Natural</button>
                      <button onClick={() => setActiveFilter('pink')} className={activeFilter==='pink' ? styles.active : ''}>🌸 Pink</button>
                      <button onClick={() => setActiveFilter('sepia')} className={activeFilter==='sepia' ? styles.active : ''}>🎞️ Vintage</button>
                    </div>
                    <button className={styles.captureBtn} onClick={capturePhoto}>📸 Snap!</button>
                  </>
                ) : (
                  <>
                    <div className={styles.stickerShelf}>
                      <button onClick={() => addItem('sticker', 'heart')}>💖</button>
                      <button onClick={() => addItem('sticker', 'star')}>⭐</button>
                      <button onClick={() => addItem('sticker', 'bunny')}>🐰</button>
                      <button onClick={() => addItem('sticker', 'cat')}>🐱</button>
                      <button onClick={() => addItem('sticker', 'dog')}>🐶</button>
                      <button onClick={() => addItem('sticker', 'bow')}>🎀</button>
                      <button className={styles.textBtn} onClick={() => addItem('text', 'Hello!')}>T</button>
                    </div>
                    <div className={styles.actionRow}>
                      <button className={styles.retakeBtn} onClick={() => setCapturedImage(null)}>Retake</button>
                      <button className={styles.sendPhotoBtn} onClick={sendSelfie} disabled={isSendingEmoji}>
                        {isSendingEmoji ? 'Sending... ✨' : 'Send Selfie ✨'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      {/* Notification Popups (Bottom Right) */}
      {notification && (
        <div className={styles.notificationPopup}>
          {notification.type === 'friendRequest' ? (
            <>
              <div className={styles.notifIcon}>🤝</div>
              <div className={styles.notifBody}>
                <p><b>{notification.fromName}</b> sent you a friend request! ✨</p>
                <div className={styles.notifBtns}>
                  <button className={styles.notifAccept} onClick={async () => {
                     try {
                        const res = await acceptFriendRequest(token, notification.fromId);
                        setNotification({ type: 'friendUpdate', accepted: true, fromName: notification.fromName });
                        setTimeout(() => setNotification(null), 5000);
                        // Emit response
                        socket.emit('friendRequestResponse', { targetUserId: notification.fromId, accepted: true });
                     } catch (err) { alert("Error accepting"); }
                  }}>Accept</button>
                  <button className={styles.notifDecline} onClick={() => setNotification(null)}>Later</button>
                </div>
              </div>
            </>
          ) : (
            <>
                <div className={styles.notifIcon}>{notification.accepted ? '💖' : '👋'}</div>
                <div className={styles.notifBody}>
                    <p><b>{notification.fromName}</b> {notification.accepted ? 'accepted your friend request! 🎉' : 'declined for now.'}</p>
                </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
