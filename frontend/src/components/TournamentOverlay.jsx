import React from 'react';
import styles from './TournamentOverlay.module.css';

export default function TournamentOverlay({ cumulativeScores, currentGame, totalGames, players }) {
  if (!cumulativeScores) return null;

  const sortedEntries = Object.entries(cumulativeScores).sort((a, b) => b[1] - a[1]);

  const getUsername = (userId) => {
    const p = players.find(player => player.userId === userId);
    return p ? p.username : 'Unknown';
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <span className={styles.title}>🏆 Tournament</span>
        <span className={styles.progress}>Game {currentGame} of {totalGames}</span>
      </div>
      <div className={styles.leaderboard}>
        {sortedEntries.map(([userId, score], idx) => (
          <div key={userId} className={styles.row}>
            <span className={styles.rank}>{idx + 1}.</span>
            <span className={styles.name}>{getUsername(userId)}</span>
            <span className={styles.score}>{score} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
