import React from 'react';
import styles from './LobbyBackground.module.css';

export default function LobbyBackground({ themeMode }) {
  return (
    <div className={`${styles.background} ${styles[themeMode] || styles.chat}`}>
      <div className={styles.overlay} />
      
      {/* Animated Elements */}
      <div className={styles.cloud1} />
      <div className={styles.cloud2} />
      <div className={styles.cloud3} />
      
      <div className={styles.sparkleContainer}>
        {[...Array(15)].map((_, i) => (
          <div key={i} className={styles.sparkle} style={{ 
            left: `${Math.random() * 100}%`, 
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            fontSize: `${Math.random() * 10 + 10}px`
          }}>✨</div>
        ))}
      </div>

      <div className={styles.floatingIsland} />
      <div className={styles.bottomGlow} />
    </div>
  );
}
