import React, { useEffect, useRef, useState } from 'react';
import styles from './DrawingBoard.module.css';

const COLORS = ['#ff4d94', '#ff80bf', '#ffb3d9', '#c9a0ff', '#9d8df1', '#85ffcc', '#03a9f4', '#fffb00', '#35263d', '#ffffff'];
const SIZES = [2, 5, 10, 20];

export default function DrawingBoard({ user, players, socket, hideUI, setHideUI }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);
  const [stickyNotes, setStickyNotes] = useState([]); // [{ id, x, y, color, text, userName }]
  const [dragNote, setDragNote] = useState(null);
  
  // To track the current stroke being drawn locally before sending
  const currentStrokeRef = useRef(null);
  const lastPosRef = useRef(null);

  // Removed dynamic setResolution. Canvas is strictly 1200x800 logically.

  // Handle incoming socket events
  useEffect(() => {
    if (!socket) return;
    
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
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    };

    const handleInit = (data) => {
      if (data.drawingHistory && data.drawingHistory.length > 0) {
        data.drawingHistory.forEach(ev => {
          drawStroke({
            points: ev.data.points,
            color: ev.data.color,
            size: ev.data.size,
            eraser: ev.type === 'eraser'
          });
        });
      } else if (data.drawings && data.drawings.length > 0) {
        data.drawings.forEach(drawStroke);
      }
      if (data.roomInfo && data.roomInfo.stickyNotes) {
        setStickyNotes(data.roomInfo.stickyNotes);
      }
    };

    const handleSyncDrawings = (drawings) => {
      if (drawings && drawings.length > 0) {
        drawings.forEach(drawStroke);
      }
    };

    const handleClearCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    socket.on('init', handleInit);
    socket.on('syncDrawings', handleSyncDrawings);
    socket.on('draw', drawStroke);
    socket.on('clearCanvas', handleClearCanvas);

    const handleStickyNoteUpdate = (note) => {
      setStickyNotes(prev => {
        const idx = prev.findIndex(n => n.id === note.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = note;
          return next;
        }
        return [...prev, note];
      });
    };

    const handleStickyNoteDeleted = (noteId) => {
      setStickyNotes(prev => prev.filter(n => n.id !== noteId));
    };

    socket.on('stickyNoteUpdate', handleStickyNoteUpdate);
    socket.on('stickyNoteDeleted', handleStickyNoteDeleted);

    // Request full history in case we mounted after the room initialization
    socket.emit('requestDrawings');

    return () => {
      socket.off('init', handleInit);
      socket.off('syncDrawings', handleSyncDrawings);
      socket.off('draw', drawStroke);
      socket.off('clearCanvas', handleClearCanvas);
      socket.off('stickyNoteUpdate', handleStickyNoteUpdate);
      socket.off('stickyNoteDeleted', handleStickyNoteDeleted);
    };
  }, [socket]);

  // Drawing Handlers
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getMousePos(e);
    lastPosRef.current = pos;
    currentStrokeRef.current = {
      color,
      size,
      eraser: eraserMode,
      points: [pos]
    };
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing || !currentStrokeRef.current) return;
    const pos = getMousePos(e);
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = eraserMode ? '#ffffff' : color;
    ctx.lineWidth = size;
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    currentStrokeRef.current.points.push(pos);
    lastPosRef.current = pos;
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStrokeRef.current && socket) {
      if (currentStrokeRef.current.points.length > 1) {
        console.log('🎨 Emitting draw event from board to server...');
        socket.emit('draw', currentStrokeRef.current);
      }
    }
    currentStrokeRef.current = null;
    lastPosRef.current = null;
  };

  const addStickyNote = () => {
    const text = window.prompt("Enter note text: ✨");
    if (!text) return;
    const color = window.confirm("Pink? (Cancel for Yellow / OK for Pink)") 
      ? '#ffb3d9' 
      : (window.confirm("Yellow? (Cancel for Blue / OK for Yellow)") ? '#ffffb3' : '#b3e5fc');
    
    const newNote = {
      id: 'note-' + Date.now(),
      x: 100 + Math.random() * 500,
      y: 100 + Math.random() * 300,
      color,
      text,
      userName: user?.username || 'Anon'
    };
    socket?.emit('addStickyNote', newNote);
  };

  const handleNoteDragStart = (e, id) => {
    setDragNote(id);
  };

  const handleNoteDragOver = (e) => {
    e.preventDefault();
    if (!dragNote) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const note = stickyNotes.find(n => n.id === dragNote);
    if (note) {
      const updatedNote = { ...note, x, y };
      setStickyNotes(stickyNotes.map(n => n.id === dragNote ? updatedNote : n));
    }
  };

  const handleNoteDragEnd = () => {
    if (!dragNote) return;
    const note = stickyNotes.find(n => n.id === dragNote);
    if (note) {
      socket?.emit('addStickyNote', note);
    }
    setDragNote(null);
  };

  const clearCanvas = () => {
    if (window.confirm('Clear the whole board for everyone? ✨')) {
      socket?.emit('clearCanvas');
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const downloadCanvas = () => {
    const link = document.createElement('a');
    link.download = `cute-doodle-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <div className={styles.boardWrapper} ref={containerRef} onDragOver={handleNoteDragOver} style={hideUI ? { maxWidth: '100%', height: '100%', borderRadius: 0, aspectRatio: 'auto' } : {}}>
      {stickyNotes.map(note => (
        <div 
          key={note.id}
          className={styles.stickyNote}
          style={{ 
            left: note.x, 
            top: note.y, 
            backgroundColor: note.color,
            transform: `rotate(${Math.sin(parseInt(note.id.split('-')[1])) * 5}deg)`
          }}
          draggable
          onDragStart={(e) => handleNoteDragStart(e, note.id)}
          onDragEnd={handleNoteDragEnd}
        >
          <div className={styles.noteContent}>{note.text}</div>
          <div className={styles.noteOwner}>— {note.userName}</div>
          <button className={styles.deleteNoteBtn} onClick={() => socket?.emit('deleteStickyNote', note.id)}>×</button>
        </div>
      ))}
      <canvas 
        ref={canvasRef}
        width={1200}
        height={800}
        className={styles.canvas}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={finishDrawing}
        onMouseLeave={finishDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={finishDrawing}
      />
      
      {/* Painters area (HUD) */}
      <div className={styles.paintersArea}>
        {Object.values(players || {}).map(p => (
           <div key={p.id} className={styles.painterNode} style={{borderColor: p.color}}>
             {p.avatar === 'bunny' ? '🐰' : p.avatar === 'cat' ? '🐱' : '🐶'}
             <div className={styles.painterName}>{p.id === socket?.id ? 'You' : p.username}</div>
           </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolSection}>
          {COLORS.map(c => (
            <button 
              key={c} 
              className={`${styles.colorBtn} ${color === c && !eraserMode ? styles.active : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => { setColor(c); setEraserMode(false); }}
            />
          ))}
        </div>
        
        <div className={styles.divider} />
        
        <div className={styles.toolSection}>
          {SIZES.map(s => (
            <button 
              key={s} 
              className={`${styles.sizeBtn} ${size === s ? styles.active : ''}`}
              onClick={() => setSize(s)}
            >
              <div style={{ width: s, height: s, backgroundColor: eraserMode ? '#ccc' : color, borderRadius: '50%' }} />
            </button>
          ))}
        </div>

        <div className={styles.divider} />
        
        <div className={styles.toolSection}>
          <button 
            className={`${styles.actionBtn} ${eraserMode ? styles.activeAction : ''}`} 
            onClick={() => setEraserMode(!eraserMode)}
            title="Eraser"
          >
            🧹
          </button>
          <button className={styles.actionBtn} onClick={addStickyNote} title="Add Sticky Note">
            📝
          </button>
          <button className={styles.actionBtn} onClick={clearCanvas} title="Clear Board">
            💣
          </button>
          <button className={styles.actionBtn} onClick={downloadCanvas} title="Save Drawing">
            🖼️
          </button>
          <button 
            className={styles.actionBtn} 
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else containerRef.current.requestFullscreen();
            }} 
            title="Full Screen"
          >
            📺
          </button>
          <button 
            className={`${styles.actionBtn} ${hideUI ? styles.activeAction : ''}`} 
            onClick={() => setHideUI(!hideUI)} 
            title="Toggle Chat"
          >
            {hideUI ? '💬' : '🙈'}
          </button>
        </div>
      </div>
    </div>
  );
}
