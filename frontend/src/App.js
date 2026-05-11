import React, { useEffect, useState } from 'react';
import LoginPage from './components/LoginPage';
import RoomLobby from './components/RoomLobby';
import ChatRoom  from './components/ChatRoom';
import { getMe } from './services/authService';

import DrawingGuessGame from './components/DrawingGuessGame';
import TypingRaceGame from './components/TypingRaceGame';
import TagGame from './components/TagGame';
import EmojiCatchGame from './components/EmojiCatchGame';


// flow: login → lobby → chatRoom / GameRoom
function App() {
  const [token,   setToken]   = useState(localStorage.getItem('cc_token'));
  const [user,    setUser]    = useState(null);
  const [room,    setRoom]    = useState(null);   // selected room object
  const [loading, setLoading] = useState(!!localStorage.getItem('cc_token'));

  useEffect(() => {
    if (token) {
      getMe(token)
        .then((res) => { setUser(res.data); setLoading(false); })
        .catch(() => handleLogout());
    }
  }, [token]);

  const handleAuth = (t, u) => {
    setToken(t);
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('cc_token');
    localStorage.removeItem('cc_user');
    setToken(null);
    setUser(null);
    setRoom(null);
    setLoading(false);
  };

  const handleJoinRoom = (r) => setRoom(r);
  const handleLeaveRoom = () => setRoom(null);
  const handleUpdateUser = (updated) => setUser(updated);

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800,
        background: 'linear-gradient(160deg,#85ffcc,#c9a0ff,#ffb3d9)',
        color: '#fff', fontFamily: 'Nunito, sans-serif', overflow: 'hidden'
      }}>
        Loading... 🐾
      </div>
    );
  }

  if (!token || !user) return <LoginPage onAuth={handleAuth} />;
  if (!room)          return <RoomLobby user={user} token={token} onJoinRoom={handleJoinRoom} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;

  if (room.roomType === 'game') {
    if (room.gameType === 'drawing_guess') {
      return <DrawingGuessGame token={token} user={user} room={room} onLogout={handleLogout} onLeaveRoom={handleLeaveRoom} />;
    }
    if (room.gameType === 'typing_race') {
      return <TypingRaceGame token={token} user={user} room={room} onLogout={handleLogout} onLeaveRoom={handleLeaveRoom} />;
    }
    if (room.gameType === 'territory_capture') {
      return <ChatRoom token={token} user={user} room={room} onLogout={handleLogout} onLeaveRoom={handleLeaveRoom} />;
    }
    if (room.gameType === 'tag_game') {
      return <TagGame token={token} user={user} room={room} onLogout={handleLogout} onLeaveRoom={handleLeaveRoom} />;
    }
    if (room.gameType === 'emoji_catch') {
      return <EmojiCatchGame token={token} user={user} room={room} onLogout={handleLogout} onLeaveRoom={handleLeaveRoom} />;
    }

  }

  return (
    <ChatRoom
      token={token}
      user={user}
      room={room}
      onLogout={handleLogout}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}

export default App;
