import React from 'react';
import styles from './ResultModal.module.css';

/**
 * ResultModal – shown after GAME_ENDED is received.
 */
export default function ResultModal({ gameId, scores, players = {}, myId, myUser, gameType, onPlayAgain, onLeave, isTournamentFinal = false }) {
  if (!scores) return null;

  const sortedEntries = Object.entries(scores).sort((a, b) => {
    // For tag game, lower time is better, BUT for tournaments, higher cumulative is better.
    if (gameType === 'tag_game' && !isTournamentFinal) return a[1] - b[1];
    return b[1] - a[1];
  });

  const getPlayerData = (id) => {
    if (id === myId) return { username: myUser?.username || 'You', avatar: myUser?.avatar || 'bunny', color: myUser?.color || '#ff80bf' };
    const p = players[id] || {};
    return {
      username: p.username || 'Player',
      avatar:   p.avatar || 'cat',
      color:    p.color || '#ffb3d9'
    };
  };

  const medals = ['🥇', '🥈', '🥉'];
  const topEntry = sortedEntries[0];
  const winnerId = topEntry?.[0];
  const winnerData = getPlayerData(winnerId);
  const isWinner = winnerId === myId;

  const unitLabel = gameType === 'tag_game' ? 's' : ' pts';

  const renderAvatar = (avatar) => {
    if (avatar === 'bunny') return '🐰';
    if (avatar === 'cat')   return '🐱';
    if (avatar === 'dog')   return '🐶';
    return '🐾';
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isTournamentFinal 
                ? (isWinner ? 'Tournament Victory! 👑' : 'Tournament Final Standing')
                : (isWinner ? 'Victory!' : `${winnerData.username} Wins!`)}
          </h2>
          <div className={styles.subtitle}>
              {isTournamentFinal ? 'You completed the tournament! Amazing job!' : 'A great game with even better friends!'}
          </div>
        </div>

        <div className={styles.scoreboard}>
          {sortedEntries.map(([id, score], idx) => {
            const p = getPlayerData(id);
            return (
              <div
                key={id}
                className={`${styles.scoreRow} ${id === myId ? styles.me : ''} ${idx === 0 ? styles.winner : ''}`}
                style={{ '--player-color': p.color }}
              >
                <div className={styles.rank}>{medals[idx] || (idx + 1)}</div>
                <div className={styles.playerInfo}>
                  <span className={styles.avatar}>{renderAvatar(p.avatar)}</span>
                  <span className={styles.name}>{p.username}</span>
                </div>
                <div className={styles.score}>{score}{unitLabel}</div>
              </div>
            );
          })}
        </div>

        <div className={styles.actions}>
          <button className={styles.playAgainBtn} onClick={onPlayAgain}>
            Let's Play Again! ✨
          </button>
          <button className={styles.leaveBtn} onClick={onLeave}>
            Back to Lobby
          </button>
        </div>
        
        <div className={styles.footer}>
          Game ID: {gameId?.slice(0, 8) || 'xxxx'}
        </div>
      </div>
    </div>
  );
}
