import React, { useState, useEffect, useRef } from 'react';
import styles from './UserDashboard.module.css';
import { updateProfile } from '../services/authService';

const AVATARS = [
  { id: 'bunny', emoji: '🐰', color: '#ffb3d9', label: 'Bunny' },
  { id: 'cat', emoji: '🐱', color: '#c9a0ff', label: 'Cat' },
  { id: 'dog', emoji: '🐶', color: '#85ffcc', label: 'Dog' },
];

const PROPS = ['none', 'flower', 'glasses', 'cap', 'crown', 'bow'];
const MOODS = ['happy', 'sad', 'angry', 'cute', 'puppy', 'flirty', 'sleepy', 'chill', 'silly'];

export default function UserDashboard({ user, onClose, onUpdateUser }) {
  const [name, setName] = useState(user?.username || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || 'bunny');
  const [selectedMood, setSelectedMood] = useState(user?.mood || 'happy');
  const [selectedProp, setSelectedProp] = useState(user?.prop || 'none');
  const [selectedColor, setSelectedColor] = useState(user?.color || '#ffb3d9');
  
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);
  const token = localStorage.getItem('cc_token');

  // ─── Session Logic ─────────────────────────────────────────────────────────
  const [sessionStartTime] = useState(Date.now());
  const [uptime, setUptime] = useState('00:00:00');

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Date.now() - sessionStartTime;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setUptime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  useEffect(() => {
    drawPreview();
  }, [selectedAvatar, selectedMood, selectedProp, selectedColor]);

  const drawPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const CW = 80; const CH = 85;
    const vx = 20; const vy = 40;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const roundRect = (ctx,x,y,w,h,r) => { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); };
    ctx.fillStyle = selectedColor;
    roundRect(ctx, vx, vy, CW, CH, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; 
    roundRect(ctx, vx+CW*0.18, vy+CH*0.36, CW*0.64, CH*0.48, 11); ctx.fill();
    ctx.fillStyle = selectedColor;
    if (selectedAvatar === 'bunny') {
      ctx.save(); ctx.translate(vx+CW*0.3, vy+CH*0.1); ctx.beginPath(); ctx.ellipse(0,-CH*0.42, CW*0.13, CH*0.36, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(vx+CW*0.7, vy+CH*0.1); ctx.beginPath(); ctx.ellipse(0,-CH*0.42, CW*0.13, CH*0.36, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
    } else if (selectedAvatar === 'cat') {
      ctx.beginPath(); ctx.moveTo(vx+CW*0.12, vy+6); ctx.lineTo(vx+CW*0.02, vy-12); ctx.lineTo(vx+CW*0.32, vy+6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(vx+CW*0.88, vy+6); ctx.lineTo(vx+CW*0.98, vy-12); ctx.lineTo(vx+CW*0.68, vy+6); ctx.fill();
    } else if (selectedAvatar === 'dog') {
      const earW = 14; const earH = 26;
      ctx.save(); ctx.translate(vx+2, vy+10); ctx.rotate(0.3); roundRect(ctx, -earW, 0, earW, earH, 7); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(vx+CW-2, vy+10); ctx.rotate(-0.3); roundRect(ctx, 0, 0, earW, earH, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      roundRect(ctx, vx+CW*0.3, vy+CH*0.55, CW*0.4, CH*0.22, 8); ctx.fill();
      ctx.fillStyle = '#35263d';
      ctx.beginPath(); ctx.arc(vx+CW*0.5, vy+CH*0.6, 2.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#35263d';
    ctx.beginPath(); ctx.arc(vx+CW*0.33, vy+CH*0.38, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(vx+CW*0.67, vy+CH*0.38, 5, 0, Math.PI*2); ctx.fill();
    if (selectedProp !== 'none') {
      ctx.save(); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (selectedProp === 'flower') {
        const fx = vx + CW * 0.8; const fy = vy + 4;
        ctx.fillStyle = '#ffde59'; ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#35263d'; ctx.stroke();
        ctx.fillStyle = '#ff914d';
        for (let i = 0; i < 5; i++) {
          ctx.save(); ctx.translate(fx, fy); ctx.rotate((i * Math.PI * 2) / 5);
          ctx.beginPath(); ctx.ellipse(7, 0, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
      } else if (selectedProp === 'glasses') {
        ctx.strokeStyle = '#35263d'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(vx + CW * 0.33, vy + CH * 0.38, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(vx + CW * 0.67, vy + CH * 0.38, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(vx + CW * 0.33 + 7, vy + CH * 0.38); ctx.quadraticCurveTo(vx + CW/2, vy + CH * 0.38 - 2, vx + CW * 0.67 - 7, vy + CH * 0.38); ctx.stroke();
      } else if (selectedProp === 'cap') {
        ctx.fillStyle = '#5271ff'; ctx.beginPath(); ctx.moveTo(vx + 4, vy + 8); ctx.quadraticCurveTo(vx + CW/2, vy - 10, vx + CW - 4, vy + 8); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(vx + CW - 8, vy + 4); ctx.lineTo(vx + CW + 10, vy + 8); ctx.stroke();
      } else if (selectedProp === 'crown') {
        const cx = vx + CW/2; const cy = vy - 8; ctx.fillStyle = '#ffde59';
        ctx.beginPath(); ctx.moveTo(cx - 15, cy + 5); ctx.lineTo(cx - 18, cy - 10); ctx.lineTo(cx - 8, cy - 2); ctx.lineTo(cx, cy - 12); ctx.lineTo(cx + 8, cy - 2); ctx.lineTo(cx + 18, cy - 10); ctx.lineTo(cx + 15, cy + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (selectedProp === 'bow') {
        ctx.fillStyle = '#ff5757'; const bx = vx + CW * 0.2; const by = vy + 2;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(bx - 12, by - 12, bx - 12, by + 12, bx, by); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(bx + 12, by - 12, bx + 12, by + 12, bx, by); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updatedUser = { 
        username: name, 
        avatar: selectedAvatar,
        mood: selectedMood,
        prop: selectedProp,
        color: selectedColor
      };
      const res = await updateProfile(token, updatedUser);
      onUpdateUser(res.data);
      onClose();
    } catch (err) { 
      alert("Failed to save profile ✨");
    } finally {
      setLoading(false);
    }
  };

  const getSocialEnergy = () => {
    const msgs = user?.messagesSent || 0;
    if (msgs > 50) return 'Radiant 🌈';
    if (msgs > 10) return 'High ✨';
    return 'Chilling ☁️';
  };

  const getMastery = () => {
    const wins = user?.gamesWon || 0;
    if (wins > 20) return 'Legend 👑';
    if (wins > 5) return 'Pro 🌟';
    return 'Rookie 🐾';
  };

  const dashboardStats = [
    { 
      label: 'Session Time', 
      value: uptime, 
      icon: '⏱️',
      info: 'Time spent in your current session.',
      color: '#ffb3d9' 
    },
    { 
      label: 'Social Energy', 
      value: getSocialEnergy(), 
      icon: '💬',
      info: 'Based on total messages sent.',
      color: '#c9a0ff' 
    },
    { 
      label: 'Mastery Level', 
      value: getMastery(), 
      icon: '🏆',
      info: 'Based on your total game wins.',
      color: '#85ffcc' 
    },
    { 
      label: 'Vibe Check', 
      value: '100% Cute', 
      icon: '💖',
      info: 'Sync between your mood and style.',
      color: '#ffde59' 
    },
  ];

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
        <div className={styles.layout}>
          <div className={styles.preview}>
            <div className={styles.statusIndicator}>● ACTIVE NOW</div>
            <canvas ref={canvasRef} width={120} height={140} className={styles.charCanvas} />
            <h2 className={styles.previewName}>{name}</h2>
            <div className={styles.observabilityGrid}>
                {dashboardStats.map(s => (
                    <div key={s.label} className={styles.obsItem} style={{ borderLeftColor: s.color }} title={s.info}>
                        <div className={styles.obsMain}>
                            <span className={styles.obsIcon}>{s.icon}</span>
                            <div className={styles.obsTexts}>
                                <span className={styles.obsLabel}>{s.label}</span>
                                <span className={styles.obsValue}>{s.value}</span>
                            </div>
                        </div>
                        <span className={styles.infoIcon}>ⓘ</span>
                    </div>
                ))}
            </div>
          </div>

          <div className={styles.content}>
            <h1 className={styles.title}>Player Dashboard ✨</h1>
            <div className={styles.section}>
              <label className={styles.label}>Player Nickname</label>
              <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name..." />
            </div>

            <div className={styles.appearanceSection}>
              <div className={styles.section}>
                <label className={styles.label}>Avatar</label>
                <div className={styles.avatarGrid}>
                  {AVATARS.map(av => (
                    <button key={av.id} className={`${styles.avatarChip} ${selectedAvatar === av.id ? styles.activeAvatar : ''}`} onClick={() => setSelectedAvatar(av.id)}>
                      <span className={styles.chipEmoji}>{av.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.section}>
                  <label className={styles.label}>Base Color</label>
                  <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)} className={styles.colorInput} />
                </div>
                <div className={styles.section}>
                  <label className={styles.label}>Prop</label>
                  <select className={styles.select} value={selectedProp} onChange={e => setSelectedProp(e.target.value)}>
                    {PROPS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.metricsPanel}>
                <div className={styles.metricsHeader}>
                    <label className={styles.label}>Gameplay Stats</label>
                    <span className={styles.liveTag}>LIVE</span>
                </div>
                <div className={styles.statCards}>
                    <div className={styles.statCard}>
                        <div className={styles.cardVal}>{user?.gamesPlayed || 0}</div>
                        <div className={styles.cardLab}>Games</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.cardVal}>{user?.gamesWon || 0}</div>
                        <div className={styles.cardLab}>Wins</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.cardVal}>{user?.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(0) : 0}%</div>
                        <div className={styles.cardLab}>Win Rate</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.cardVal}>{user?.roomsJoined || 0}</div>
                        <div className={styles.cardLab}>Rooms</div>
                    </div>
                </div>
                <div className={styles.detailedMetrics}>
                    <div className={styles.detRow}><span>Lifetime Play Time</span><span>{user?.totalPlayTime || '14m 32s'}</span></div>
                    <div className={styles.detRow}><span>Messages Sent</span><span>{user?.messagesSent || 0}</span></div>
                    <div className={styles.detRow}><span>Social Points</span><span>{((user?.messagesSent || 0) * 5)} pts</span></div>
                </div>
            </div>

            <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
                {loading ? 'SAVING... ✨' : 'SAVE PROFILE 💖'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
