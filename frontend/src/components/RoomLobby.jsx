import React, { useEffect, useState, useCallback } from 'react';
import { getRooms, createRoom, verifyCode } from '../services/roomService';
import LobbyBackground from './LobbyBackground';
import UserDashboard from './UserDashboard';
import styles from './RoomLobby.module.css';

const THEMES = [
  { id: '🌸', label: 'Sakura Meadow', preview: '🌸', image: '/preview/flower.png' },
  { id: '🌊', label: 'Coral Cave', preview: '🌊', image: '/preview/water.png' },
  { id: '🌙', label: 'Moonlight Camp', preview: '🌙', image: '/preview/night.png' },
  { id: '🍀', label: 'Magic Forest', preview: '🍀', image: '/preview/grass.png' },
  { id: '🎬', label: 'Movie Night', preview: '🎬', image: '/preview/movie.png' },
  { id: '🖌️', label: 'Art Studio', preview: '🖌️', image: '/preview/drawingboard.png' },
  { id: '📚', label: 'Library', preview: '📚', image: '/preview/study.png' },
  { id: '🎨', label: 'Creative Hub', preview: '🎨', image: '/preview/street.png' }
];

const THEME_CATEGORIES = {
    '🌸': 'Theme Rooms', '🌊': 'Theme Rooms', '🌙': 'Theme Rooms', '🍀': 'Theme Rooms',
    '🎬': 'Watch Together',
    '🖌️': 'Drawing', '🎨': 'Drawing',
    '📚': 'Study'
};

const CATEGORIES = [
    { value: 'All', label: 'All Rooms' },
    { value: 'Theme Rooms', label: 'Theme Rooms' },
    { value: 'Study', label: 'Study' },
    { value: 'Drawing', label: 'Drawing' },
    { value: 'Watch Together', label: 'Watch Together' }
];

const GAME_INFO = {
  drawing_guess: {
    label: 'Drawing Guess',
    desc: 'One player draws while others guess!',
    howTo: 'Selected drawer chooses a word. Others type guesses in chat. First to guess wins!',
    image: '/preview/drawnguess.png'
  },
  typing_race: {
    label: 'Typing Race',
    desc: 'Be the fastest typist in the room!',
    howTo: 'Wait for the countdown. Type the sentence exactly as shown. Speed is key!',
    image: '/preview/typing.png'
  },
  territory_capture: {
    label: 'Territory Capture',
    desc: 'Paint the room with your colors!',
    howTo: 'Move around to paint the floor. The player with the most territory when time runs out wins!',
    image: '/preview/color-territory.png'
  },
  tag_game: {
    label: 'Tag Game',
    desc: 'Don\'t be IT! Chase or run away!',
    howTo: 'If you are IT (glowing red), touch others to tag. Lowest cumulative IT time wins!',
    image: '/preview/it.png'
  },
  emoji_catch: {
    label: 'Emoji Catch',
    desc: 'Collect falling treasures!',
    howTo: 'Move your bucket. Catch Stars/Hearts (+ pts). Avoid Skulls/Poison (- pts)!',
    image: '/preview/catch emmoji.png'
  },
};

export default function RoomLobby({ user, token, onJoinRoom, onLogout, onUpdateUser }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showHowTo, setShowHowTo] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [filterPrivacy, setFilterPrivacy] = useState('all'); // all, public, private
  const [filterCategory, setFilterCategory] = useState('All');
  
  const [form, setForm] = useState({ 
    name: '', theme: '🌸', purpose: '', isPublic: true, 
    roomType: 'chat', gameType: 'none', maxPlayers: 4,
    isTournament: false, rounds: 3 
  });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');
  
  const [joinModal, setJoinModal] = useState({ open: false, room: null, code: '', error: '' });
  const [createdRoomCode, setCreatedRoomCode] = useState(null);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await getRooms();
      setRooms(res.data || []);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const id = setInterval(fetchRooms, 8000); 
    return () => clearInterval(id);
  }, [fetchRooms]);

  const handleCreate = async (e) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) { setErr('Room name is required'); return; }
    try {
      setCreating(true); setErr('');
      const res = await createRoom(
        { 
          name: form.name.trim(), 
          theme: form.roomType === 'game' ? '🎮' : form.theme, 
          purpose: form.roomType === 'game' ? (GAME_INFO[form.gameType]?.desc || '') : form.purpose.trim(),
          isPublic: form.isPublic, 
          createdBy: user?.id,
          roomType: form.roomType,
          gameType: form.gameType,
          maxPlayers: form.maxPlayers
        },
        token
      );
      
      if (!form.isPublic && res.data.code) {
        setCreatedRoomCode(res.data.code);
        setShowConfigModal(null);
      } else {
        setShowModal(false);
        setShowConfigModal(null);
        setForm({ name: '', theme: '🌸', purpose: '', isPublic: true, roomType: 'chat', gameType: 'none', maxPlayers: 4, isTournament: false, rounds: 3 });
        onJoinRoom(res.data);
      }
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not create room');
    } finally {
      setCreating(false);
    }
  };

  const handleStartGame = (gameType, config) => {
      // 1. If global mode, try to find an existing public game of this type
      if (config.isPublic) {
          const existing = rooms.find(r => 
              r.roomType === 'game' && 
              r.gameType === gameType && 
              r.isPublic && 
              (r.onlineCount || 0) < (r.maxPlayers || 12)
          );
          if (existing) {
              onJoinRoom(existing);
              setShowConfigModal(null);
              return;
          }
      }

      // 2. Otherwise create a new one
      const name = `${user.username}'s ${GAME_INFO[gameType].label}`;
      setForm({
          ...form,
          name,
          theme: '🎮',
          purpose: GAME_INFO[gameType].desc,
          isPublic: config.isPublic,
          roomType: 'game',
          gameType: gameType,
          maxPlayers: config.maxPlayers
      });
      setTimeout(() => {
        document.getElementById('hiddenSubmit')?.click();
      }, 0);
  };

  const handleAttemptJoin = (room) => {
    if (room.isPublic || room.name === 'global') {
      onJoinRoom(room);
    } else {
      setJoinModal({ open: true, room, code: '', error: '' });
    }
  };

  const submitJoinCode = async (e) => {
    e.preventDefault();
    try {
      setJoinModal(m => ({...m, error: ''}));
      const res = await verifyCode(joinModal.room._id, joinModal.code.trim(), token);
      if (res.data.success) {
        const fullRoom = joinModal.room;
        setJoinModal({ open: false, room: null, code: '', error: '' });
        onJoinRoom(fullRoom);
      }
    } catch (e) {
      setJoinModal(m => ({...m, error: e.response?.data?.error || 'Invalid code'}));
    }
  };

  const filteredRooms = rooms.filter(r => {
    if ((r.roomType || 'chat') !== activeTab) return false;
    if (filterPrivacy === 'public') return r.isPublic;
    if (filterPrivacy === 'private') return !r.isPublic;
    
    // Category filter
    if (filterCategory !== 'All') {
        const cat = THEME_CATEGORIES[r.theme];
        if (cat !== filterCategory) return false;
    }
    
    return true;
  });

  return (
    <div className={styles.page}>
      <LobbyBackground themeMode={activeTab} />
      
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
            <span className={styles.logoText}>Chatlings</span>
            <span className={styles.tagline}>cute world, hand-drawn dreams ✨</span>
        </div>
        <div className={styles.navRight}>
          <button className={styles.userTag} onClick={() => setShowDashboard(true)}>
            <span className={styles.avatarCircle}>{user?.avatar === 'bunny' ? '🐰' : user?.avatar === 'cat' ? '🐱' : '🐶'}</span>
            <span className={styles.username}>{user?.username || 'Player'}</span>
          </button>
          <button className={styles.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      </nav>

      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>{activeTab === 'chat' ? 'Jump into Chat!' : 'Games Mode'}</h1>
        <p className={styles.heroSub}>{activeTab === 'chat' ? 'Hang out in hand-drawn meadows and make new friends.' : 'Challenge your friends in adorable mini-games!'}</p>
      </div>

      <div className={styles.body}>
        <div className={styles.sectionHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.tabs}>
                <button className={`${styles.tabBtn} ${activeTab === 'chat' ? styles.activeTab : ''}`} onClick={() => setActiveTab('chat')}>Chat Rooms</button>
                <button className={`${styles.tabBtn} ${activeTab === 'game' ? styles.activeTab : ''}`} onClick={() => setActiveTab('game')}>Mini Games</button>
            </div>
            {activeTab === 'chat' && (
                <div className={styles.filterGroup}>
                    <select 
                        className={styles.dropdown} 
                        value={filterCategory} 
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        {CATEGORIES.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                    </select>
                    <div className={styles.filterBar}>
                        <button className={`${styles.filterBtn} ${filterPrivacy === 'all' ? styles.activeFilter : ''}`} onClick={() => setFilterPrivacy('all')}>All</button>
                        <button className={`${styles.filterBtn} ${filterPrivacy === 'public' ? styles.activeFilter : ''}`} onClick={() => setFilterPrivacy('public')}>Public</button>
                        <button className={`${styles.filterBtn} ${filterPrivacy === 'private' ? styles.activeFilter : ''}`} onClick={() => setFilterPrivacy('private')}>Private</button>
                    </div>
                </div>
            )}
          </div>
          {activeTab === 'chat' && (
            <button className={styles.createBtn} onClick={() => {
                setForm({ name: '', theme: '🌸', purpose: '', isPublic: true, roomType: 'chat', gameType: 'none', maxPlayers: 8, isTournament: false, rounds: 3 });
                setShowModal(true);
            }}>Create Room</button>
          )}
        </div>

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <div className={styles.grid}>
            {activeTab === 'chat' && filterPrivacy !== 'private' && filterCategory === 'All' && (
              <div className={`${styles.roomCard} ${styles.globalCard}`} onClick={() => handleAttemptJoin({ name: 'global', theme: '🌈', _id: 'global', roomType: 'chat', isPublic: true })}>
                <div className={styles.cardPreview} style={{ backgroundImage: 'url(/preview/global.png)' }}>
                    <div className={`${styles.visibilityBadge} ${styles.public}`}>PUBLIC</div>
                </div>
                <div className={styles.cardInfo}>
                    <div className={styles.roomName}>Global Room</div>
                    <div className={styles.roomMeta}>The heart of Chatlings. Everyone is here!</div>
                    <div className={styles.cardFooter}>
                        <div className={styles.onlineStatus}>ONLINE</div>
                        <button className={styles.joinBtn}>Enter</button>
                    </div>
                </div>
              </div>
            )}
            
            {activeTab === 'chat' ? (
                filteredRooms.map((r) => {
                    const info = THEMES.find(t => t.id === r.theme);
                    const cat = THEME_CATEGORIES[r.theme] || 'Custom';
                    return (
                      <div key={r._id} className={styles.roomCard} onClick={() => handleAttemptJoin(r)}>
                        <div className={styles.cardPreview} style={{ backgroundImage: info?.image ? `url("${info.image}")` : 'none' }}>
                            {!info?.image && <div className={styles.previewEmoji}>{r.theme || '🌸'}</div>}
                            <div className={`${styles.visibilityBadge} ${r.isPublic ? styles.public : styles.private}`}>
                                {r.isPublic ? 'PUBLIC' : 'PRIVATE'}
                            </div>
                            <div className={styles.typeBadge}>{cat}</div>
                        </div>
                        <div className={styles.cardInfo}>
                          <div className={styles.roomName}>{r.name}</div>
                          <div className={styles.roomMeta}>{r.purpose || 'Chatting and hanging out~'}</div>
                          <div className={styles.cardFooter}>
                              <div className={styles.playerCount}>Players: {r.onlineCount || 0}</div>
                              <button className={styles.joinBtn}>Join</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
            ) : (
              Object.entries(GAME_INFO).map(([key, info]) => (
                <div key={key} className={styles.roomCard}>
                  <div className={styles.cardPreview} style={{ backgroundImage: info.image ? `url("${info.image}")` : 'none' }}>
                      <button className={styles.howToBtn} onClick={() => setShowHowTo(key)}>?</button>
                  </div>
                  <div className={styles.cardInfo}>
                    <div className={styles.roomName}>{info.label}</div>
                    <div className={styles.roomMeta}>{info.desc}</div>
                    <div className={styles.cardFooter}>
                        <button className={styles.joinBtn} onClick={() => setShowConfigModal(key)}>Play Now</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleCreate} style={{ display: 'none' }}><button id="hiddenSubmit" type="submit" /></form>

      {/* Game Config Modal */}
      {showConfigModal && (
          <div className={styles.modalOverlay} onClick={() => setShowConfigModal(null)}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                  <div className={styles.modalTitle}>Game Setup</div>
                  <div className={styles.configBody}>
                      <div className={styles.formGroup}>
                          <label className={styles.label}>Max Players</label>
                          <div className={styles.playerSelect}>
                              {[2, 4, 8, 12].map(n => (
                                  <button 
                                    key={n} 
                                    className={`${styles.numBtn} ${form.maxPlayers === n ? styles.selectedNum : ''}`}
                                    onClick={() => setForm(f => ({ ...f, maxPlayers: n }))}
                                  >{n}</button>
                              ))}
                          </div>
                      </div>
                      <div className={styles.formGroup}>
                          <label className={styles.label}>Privacy Mode</label>
                          <div className={styles.modeGrid}>
                              <button className={`${styles.modeBtn} ${form.isPublic ? styles.selectedMode : ''}`} onClick={() => setForm(f => ({ ...f, isPublic: true }))}>
                                  <div className={styles.modeTexts}><b>Global</b><span>Anyone can join</span></div>
                              </button>
                              <button className={`${styles.modeBtn} ${!form.isPublic ? styles.selectedMode : ''}`} onClick={() => setForm(f => ({ ...f, isPublic: false }))}>
                                  <div className={styles.modeTexts}><b>With Friends</b><span>Private Room</span></div>
                              </button>
                          </div>
                      </div>

                      <div className={styles.formGroup}>
                          <div className={styles.tournamentToggle}>
                              <label className={styles.label}>Tournament Mode</label>
                              <button className={`${styles.toggleBtn} ${form.isTournament ? styles.toggled : ''}`} onClick={() => setForm(f => ({ ...f, isTournament: !f.isTournament }))}>
                                  {form.isTournament ? 'ON' : 'OFF'}
                              </button>
                          </div>
                          {form.isTournament && (
                              <div className={styles.roundSelect}>
                                  {[1, 3, 5, 999].map(r => (
                                      <button 
                                        key={r}
                                        className={`${styles.numBtn} ${form.rounds === r ? styles.selectedNum : ''}`}
                                        onClick={() => setForm(f => ({ ...f, rounds: r }))}
                                      >{r === 999 ? 'Unlimited' : `${r} Rounds`}</button>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
                  <div className={styles.modalBtns}>
                      <button className={styles.cancelBtn} onClick={() => setShowConfigModal(null)}>Cancel</button>
                      <button className={styles.submitBtn} onClick={() => handleStartGame(showConfigModal, { isPublic: form.isPublic, maxPlayers: form.maxPlayers })}>
                          Start Game
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Join Code Modal */}
      {joinModal.open && (
        <div className={styles.modalOverlay} onClick={() => setJoinModal({ open: false, room: null, code: '', error: '' })}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Private Room Code</div>
            <p className={styles.modalSub}>Enter the invite code to join <b>{joinModal.room?.name}</b></p>
            <form onSubmit={submitJoinCode} className={styles.createForm}>
                <input 
                    className={styles.inputLarge} 
                    value={joinModal.code} 
                    onChange={e => setJoinModal(m => ({...m, code: e.target.value.toUpperCase()}))}
                    placeholder="ENTER CODE"
                    maxLength={6}
                    autoFocus
                />
                {joinModal.error && <div className={styles.errMsg}>{joinModal.error}</div>}
                <div className={styles.modalBtns}>
                    <button type="button" className={styles.cancelBtn} onClick={() => setJoinModal({ open: false, room: null, code: '', error: '' })}>Cancel</button>
                    <button type="submit" className={styles.submitBtn}>Join Room</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* How To Play Modal */}
      {showHowTo && (
          <div className={styles.modalOverlay} onClick={() => setShowHowTo(null)}>
              <div className={styles.howToModal}>
                  <div className={styles.howToTitle}>{GAME_INFO[showHowTo]?.label}</div>
                  <p className={styles.howToContent}>{GAME_INFO[showHowTo]?.howTo}</p>
                  <button className={styles.submitBtn} onClick={() => setShowHowTo(null)}>Got it!</button>
              </div>
          </div>
      )}

      {/* Create Room Modal (for Chat) */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Create Chat Room</div>
            <form onSubmit={handleCreate} className={styles.createForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Room Name</label>
                <input className={styles.inputLarge} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Cozy Corner" maxLength={24} autoFocus />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Vibe / Purpose</label>
                <input className={styles.inputSmall} value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} placeholder="e.g. studying together..." maxLength={60} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Theme</label>
                <div className={styles.themeGrid}>
                  {THEMES.map((t) => (
                    <button key={t.id} type="button" className={`${styles.themeOption} ${form.theme === t.id ? styles.selected : ''}`} onClick={() => setForm((f) => ({ ...f, theme: t.id }))} style={{ backgroundImage: `url(${t.image})`, backgroundSize: 'cover' }}>
                        <span className={styles.themeEmojiBack}>{t.preview}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Privacy</label>
                <div className={styles.modeGrid}>
                    <button type="button" className={`${styles.modeBtn} ${form.isPublic ? styles.selectedMode : ''}`} onClick={() => setForm(f => ({ ...f, isPublic: true }))}>
                        <div className={styles.modeTexts}><b>Public</b></div>
                    </button>
                    <button type="button" className={`${styles.modeBtn} ${!form.isPublic ? styles.selectedMode : ''}`} onClick={() => setForm(f => ({ ...f, isPublic: false }))}>
                        <div className={styles.modeTexts}><b>Private</b></div>
                    </button>
                </div>
              </div>
              {err && <div className={styles.errMsg}>{err}</div>}
              <div className={styles.modalBtns}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={creating}>Create Room</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDashboard && <UserDashboard user={user} onClose={() => setShowDashboard(false)} onUpdateUser={onUpdateUser} />}

      {createdRoomCode && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Private Room Code</div>
            <p className={styles.inviteText}>Share this code with friends: <b>{createdRoomCode}</b></p>
            <button className={styles.submitBtn} onClick={() => { setCreatedRoomCode(null); setShowModal(false); fetchRooms(); }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
