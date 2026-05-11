import React, { useState, useEffect, useRef } from 'react';
import styles from './StickyBoard.module.css';

export default function StickyBoard({ user, socket, roomId }) {
  const [notes, setNotes] = useState([]);
  const [dragNote, setDragNote] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('init', (data) => {
      if (data.roomInfo && data.roomInfo.stickyNotes) {
        setNotes(data.roomInfo.stickyNotes);
      }
    });

    socket.on('stickyNoteUpdate', (note) => {
      setNotes(prev => {
        const idx = prev.findIndex(n => n.id === note.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = note;
          return next;
        }
        return [...prev, note];
      });
    });

    socket.on('stickyNoteDeleted', (noteId) => {
      setNotes(prev => prev.filter(n => n.id !== noteId));
    });

    return () => {
      socket.off('stickyNoteUpdate');
      socket.off('stickyNoteDeleted');
    };
  }, [socket]);

  const addNote = (type) => {
    let content = '';
    let data = '';
    
    if (type === 'text') {
      content = window.prompt("Enter text for your note: ✨");
      if (!content) return;
    } else if (type === 'image') {
      content = window.prompt("Enter image URL: 🖼️");
      if (!content) return;
    } else if (type === 'drawing') {
      content = "Sketch Note";
      data = "M 0 0 L 50 50"; // Mock drawing data for now
    }

    const newNote = {
      id: 'study-note-' + Date.now(),
      x: 50 + Math.random() * 300,
      y: 50 + Math.random() * 300,
      color: ['#ffb3d9', '#ffffb3', '#b3e5fc'][Math.floor(Math.random() * 3)],
      text: content,
      userName: user?.username || 'Anon',
      type: type,
      data: data
    };
    socket?.emit('addStickyNote', newNote);
  };

  const handleDragStart = (e, id) => {
    setDragNote(id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!dragNote) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setNotes(prev => prev.map(n => n.id === dragNote ? { ...n, x, y } : n));
  };

  const handleDragEnd = () => {
    if (!dragNote) return;
    const note = notes.find(n => n.id === dragNote);
    if (note) {
      socket?.emit('addStickyNote', note);
    }
    setDragNote(null);
  };

  return (
    <div className={styles.boardContainer} ref={containerRef} onDragOver={handleDragOver}>
      <div className={styles.boardHeader}>
        <h3>Collaborative Sticky Board 📝✨</h3>
        <div className={styles.btnGroup}>
          <button onClick={() => addNote('text')}>Add Text ✍️</button>
          <button onClick={() => addNote('image')}>Add Image 🖼️</button>
          <button onClick={() => addNote('drawing')}>Add Sketch 🎨</button>
        </div>
      </div>
      
      <div className={styles.canvasArea}>
        {notes.map(note => (
          <div 
            key={note.id}
            className={styles.stickyItem}
            style={{ 
              left: note.x, 
              top: note.y, 
              backgroundColor: note.color,
              zIndex: dragNote === note.id ? 100 : 10
            }}
            draggable
            onDragStart={(e) => handleDragStart(e, note.id)}
            onDragEnd={handleDragEnd}
          >
            <div className={styles.noteAuthor}>{note.userName}'s note</div>
            <div className={styles.noteContent}>
              {note.type === 'text' && <p>{note.text}</p>}
              {note.type === 'image' && <img src={note.text} alt="note" style={{maxWidth:'100%', borderRadius:8}} />}
              {note.type === 'drawing' && (
                 <svg viewBox="0 0 100 100" style={{width:'100%', height:'100%'}}>
                    <path d={note.data || "M 10 10 L 90 90"} stroke="#35263d" fill="none" strokeWidth="3" />
                 </svg>
              )}
            </div>
            <button className={styles.deleteBtn} onClick={() => socket?.emit('deleteStickyNote', note.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
