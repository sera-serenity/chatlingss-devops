import React, { useEffect, useState, useRef, useCallback } from 'react';
import StudyCanvas from './StudyCanvas';
import DrawingBoard from './DrawingBoard'; // Reuse for whiteboard zone
import StickyBoard from './StickyBoard';
import styles from './StudyRoom.module.css';

export default function StudyRoom({ user, players, roomId, socket }) {
  const [activeZone, setActiveZone] = useState(null); // 'desk', 'whiteboard', 'shelf', 'break', 'help', null
  const [deskUsers, setDeskUsers] = useState({}); // id -> { name, startTime }
  const [todos, setTodos] = useState([
    { id: 1, text: 'Revise DBMS', done: false },
    { id: 2, text: 'Finish assignment', done: false }
  ]);
  const [newTodo, setNewTodo] = useState('');
  
  // Interactive Zones boundaries (Logical X coords) shifted right by +300
  const ZONES = {
    whiteboard: { x: 400, w: 300, name: 'Whiteboard Wall 🧠' },
    stickies:   { x: 740, w: 220, name: 'Sticky Notes 📝' },
    desk:       { x: 1000, w: 250, name: 'Focus Desk ⏱️' },
    shelf:      { x: 1350, w: 200, name: 'Resource Shelf 📂' },
    break:      { x: 1650, w: 250, name: 'Chill Area 🌿' },
    help:       { x: 2000, w: 200, name: 'Help Desk ✋' }
  };

  useEffect(() => {
    if (!socket) return;
    
    // Custom socket emissions for the study room could go here
    socket.on('updateDeskStatus', (data) => {
      // Sync focus mode users
      setDeskUsers(prev => ({ ...prev, [data.userId]: data }));
    });
    
    return () => socket.off('updateDeskStatus');
  }, [socket]);

  const handleZoneEnter = useCallback((zoneId) => {
    setActiveZone(prev => prev !== zoneId ? zoneId : prev);
  }, []);

  const handleZoneLeave = useCallback(() => {
    setActiveZone(prev => prev !== null ? null : prev);
  }, []);

  const toggleTodo = (id) => {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };
  const addTodo = (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setTodos([...todos, { id: Date.now(), text: newTodo, done: false }]);
    setNewTodo('');
  };

  return (
    <div className={styles.roomContainer}>
      {/* Background Interactive Layer - Handled by StudyCanvas */}
      <StudyCanvas 
        user={user} 
        players={players} 
        socket={socket} 
        zones={ZONES}
        onZoneEnter={handleZoneEnter}
        onZoneLeave={handleZoneLeave}
      />
      
      {/* Absolute HUD Layer above canvas */}
      <div className={styles.hudOverlay}>
        
        {/* To-Do List (Top Right) */}
        <div className={styles.todoPanel}>
          <div className={styles.todoHeader}>📝 Shared To-Do</div>
          <div className={styles.todoList}>
            {todos.map(t => (
              <div key={t.id} className={`${styles.todoItem} ${t.done ? styles.done : ''}`} onClick={() => toggleTodo(t.id)}>
                {t.done ? '✅' : '🟩'} {t.text}
              </div>
            ))}
          </div>
          <form className={styles.todoForm} onSubmit={addTodo}>
            <input value={newTodo} onChange={e=>setNewTodo(e.target.value)} placeholder="Add task..." />
            <button type="submit">+</button>
          </form>
        </div>

        {/* Floating Zone UI overlays */}
        {activeZone === 'desk' && (
           <div className={styles.zonePopupCenter}>
             <h2>⏱️ Focus Mode Started</h2>
             <div className={styles.deskOccupants}>
               <div className={styles.occupant}>You are studying 📖</div>
             </div>
             <p className={styles.hint}>Move away to end focus session.</p>
           </div>
        )}

        {activeZone === 'whiteboard' && (
           <div className={styles.zoneModalFullScreen}>
             <button className={styles.closeBtn} onClick={() => setActiveZone(null)}>Close Whiteboard ✖</button>
             <DrawingBoard user={user} players={players} socket={socket} />
           </div>
        )}

        {activeZone === 'stickies' && (
           <div className={styles.zoneModalFullScreen}>
              <button className={styles.closeBtn} onClick={() => setActiveZone(null)}>Close Board ✖</button>
              <StickyBoard user={user} socket={socket} roomId={roomId} />
           </div>
        )}

        {activeZone === 'shelf' && (
           <div className={styles.zonePopupRight}>
             <h2>📂 Resource Bookshelf</h2>
             <p>Access notes and past papers.</p>
             <div className={styles.mockFiles}>
               <div className={styles.mockFile}>📄 chapter_4_notes.pdf</div>
               <div className={styles.mockFile}>🖼️ diagram_dbms.png</div>
             </div>
             <button className={styles.uploadBtn}>Upload Note ✨</button>
           </div>
        )}

        {activeZone === 'break' && (
           <div className={styles.zonePopupCenterBottom}>
             <h3>☕ Chill Zone</h3>
             <p>Taking a well deserved break with the team!</p>
           </div>
        )}

        {activeZone === 'help' && (
           <div className={styles.zonePopupLeft}>
             <h2>✋ Help Desk</h2>
             <textarea placeholder="I have a doubt about..." className={styles.helpInput} />
             <button className={styles.helpSubmit}>Post Doubt To Room 🔔</button>
           </div>
        )}

      </div>
    </div>
  );
}
