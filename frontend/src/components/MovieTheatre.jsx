import React, { useEffect, useRef, useState } from 'react';
import styles from './MovieTheatre.module.css';
import { getSocket } from '../services/socketService';

export default function MovieTheatre({ user, players, roomId, socket }) {
  const [movie, setMovie] = useState(null); // { videoId, currentTime, isPlaying, lastUpdated, sender }
  const [inputUrl, setInputUrl] = useState('');
  const [showInput, setShowInput] = useState(false);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const isInternalChange = useRef(false);
  const syncIntervalRef = useRef(null);

  // ── SOCKET EVENTS ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Late-joiner sync: server sends current video state in 'init'
    socket.on('init', (data) => {
      if (data.movie) setMovie(data.movie);
    });

    // Unified video update from server (play/pause/seek/start/sync)
    socket.on('videoUpdate', (state) => {
      if (!state || !state.videoId) return;
      setMovie(state);
    });

    // Legacy movieUpdate support
    socket.on('movieUpdate', (m) => {
      if (!m || !m.videoId) return;
      setMovie({
        videoId: m.videoId,
        currentTime: m.currentTime ?? 0,
        isPlaying: m.playing ?? m.isPlaying ?? true,
        lastUpdated: m.ts ?? Date.now(),
        sender: m.sender
      });
    });

    return () => {
      socket.off('init');
      socket.off('videoUpdate');
      socket.off('movieUpdate');
    };
  }, [socket]);

  // ── DRIFT CORRECTION: request sync every 5s ───────────────────
  useEffect(() => {
    if (!socket) return;

    syncIntervalRef.current = setInterval(() => {
      if (movie?.videoId) {
        socket.emit('requestSync');
      }
    }, 5000);

    return () => {
      clearInterval(syncIntervalRef.current);
    };
  }, [socket, movie?.videoId]);

  // ── Load YouTube IFrame API ───────────────────────────────────
  useEffect(() => {
    if (window.YT) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      console.log('YT API Ready');
    };
  }, []);

  // ── Initialize/Update Player when videoId changes ─────────────
  useEffect(() => {
    if (!movie?.videoId || !window.YT) return;

    if (!playerRef.current) {
      playerRef.current = new window.YT.Player('movie-player', {
        videoId: movie.videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onStateChange: onPlayerStateChange
        }
      });
    } else {
      const currentId = playerRef.current.getVideoData?.().video_id;
      if (currentId !== movie.videoId) {
        playerRef.current.loadVideoById(movie.videoId);
      }
    }
  }, [movie?.videoId]);

  // ── Sync player state from server ─────────────────────────────
  useEffect(() => {
    if (!playerRef.current || !movie || isInternalChange.current) return;

    isInternalChange.current = true;

    const playerState = playerRef.current.getPlayerState?.();

    // Sync play/pause
    if (movie.isPlaying && playerState !== 1) {
      playerRef.current.playVideo?.();
    } else if (!movie.isPlaying && playerState !== 2) {
      playerRef.current.pauseVideo?.();
    }

    // Drift-corrected time: account for time elapsed since server's lastUpdated
    const currentTime = playerRef.current.getCurrentTime?.() || 0;
    const serverTime = movie.isPlaying
      ? movie.currentTime + (Date.now() - (movie.lastUpdated ?? Date.now())) / 1000
      : movie.currentTime;

    if (Math.abs(currentTime - serverTime) > 2) {
      playerRef.current.seekTo?.(serverTime, true);
    }

    setTimeout(() => { isInternalChange.current = false; }, 500);
  }, [movie]);

  // ── Player state change: emit to server ───────────────────────
  const onPlayerStateChange = (event) => {
    if (isInternalChange.current) return;

    const s = getSocket();
    if (!s) return;

    const newState = event.data;
    const currentTime = playerRef.current?.getCurrentTime?.() ?? 0;

    if (newState === 1) {
      // Playing → emit videoAction play
      s.emit('videoAction', { action: 'play', currentTime });
    } else if (newState === 2) {
      // Paused → emit videoAction pause
      s.emit('videoAction', { action: 'pause', currentTime });
    }
  };

  // ── Start a new movie ─────────────────────────────────────────
  const handleStartMovie = (e) => {
    e.preventDefault();
    let videoId = '';
    const match = inputUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\s]{11})/);
    if (match) videoId = match[1];

    if (videoId) {
      const s = getSocket();
      if (s) {
        // Use videoStart for a fresh video so server resets state to t=0
        s.emit('videoStart', { videoId });
      }
      setInputUrl('');
      setShowInput(false);
    } else {
      alert('Please paste a valid YouTube link! 🎞️');
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {/* The Big Screen */}
      <div className={styles.screenStage}>
        <div className={styles.screenBorder}>
          <div className={styles.screenGlow} />
          <div id="movie-player" className={styles.player} />
          {!movie && (
            <div className={styles.emptyScreen} onClick={() => setShowInput(true)}>
              <div className={styles.emptyContent}>
                <div className={styles.emptyIcon}>🎬</div>
                <div className={styles.emptyText}>Click to insert a movie...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The Seats Area */}
      <div className={styles.seatingArea}>
        {[0, 1].map(rowIndex => (
          <div key={rowIndex} className={styles.seatRow}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map(seatIndex => {
              const seatGlobalIndex = rowIndex * 8 + seatIndex;
              const playerArray = Object.values(players || {});
              const seatedPlayer = playerArray[seatGlobalIndex % playerArray.length];
              const isLocal = seatedPlayer?.id === socket?.id;
              const hasPlayer = playerArray.length > seatGlobalIndex;

              return (
                <div key={seatIndex} className={styles.seatWrapper}>
                  {hasPlayer && seatedPlayer && (
                    <div className={`${styles.spectator} ${isLocal ? styles.isLocal : ''}`}>
                      <div className={styles.spectatorAvatar} style={{ background: seatedPlayer.color }}>
                        {seatedPlayer.avatar === 'bunny' ? '🐰' : seatedPlayer.avatar === 'cat' ? '🐱' : '🐶'}
                      </div>
                      <div className={styles.spectatorName}>{isLocal ? 'You' : seatedPlayer.username}</div>
                    </div>
                  )}
                  <div className={styles.seatTop} />
                  <div className={styles.seatBase} />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Controls Overlay */}
      <div className={styles.theatreControls}>
        <button className={styles.theatreBtn} onClick={() => setShowInput(!showInput)}>
          {movie ? 'Change Movie 📼' : 'Start Movie Night ✨'}
        </button>
        {movie && (
          <span className={styles.nowPlayingInfo}>
            Now watching: <b>{movie.sender}'s pick</b> 🍿
          </span>
        )}
      </div>

      {showInput && (
        <div className={styles.inputModal}>
          <form onSubmit={handleStartMovie} className={styles.inputForm}>
            <h3>What are we watching? 🍿</h3>
            <input
              placeholder="Paste YouTube Link... 🌸"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              autoFocus
            />
            <div className={styles.formActions}>
              <button type="button" onClick={() => setShowInput(false)}>Cancel</button>
              <button type="submit">Let's Go! 🎬</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
