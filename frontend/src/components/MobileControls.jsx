import React, { useState, useRef, useEffect } from 'react';

export default function MobileControls() {
  const [position, setPosition] = useState(0); // offset of handle in pixels
  const [activeKey, setActiveKey] = useState(null); // 'a' or 'd'
  const [isMobile, setIsMobile] = useState(false);
  const trackRef = useRef(null);
  const maxDrag = 50; // max drag radius in pixels

  useEffect(() => {
    const checkMobile = () => {
      // Show on screens <= 900px wide or devices supporting touch
      setIsMobile(
        window.matchMedia('(max-width: 900px)').matches || 
        ('ontouchstart' in window) || 
        navigator.maxTouchPoints > 0
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const triggerKey = (key, eventType) => {
    const event = new KeyboardEvent(eventType, {
      key: key,
      keyCode: key === ' ' ? 32 : key.charCodeAt(0),
      code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
      which: key === ' ' ? 32 : key.charCodeAt(0),
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  };

  const handleTouchStart = (e) => {
    handleTouchMove(e);
  };

  const handleTouchMove = (e) => {
    if (!trackRef.current) return;
    const touch = e.touches[0];
    const trackRect = trackRef.current.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;
    let offset = touch.clientX - trackCenter;

    // Constrain offset to track limits
    if (offset > maxDrag) offset = maxDrag;
    if (offset < -maxDrag) offset = -maxDrag;

    setPosition(offset);

    // Calculate ratio and trigger corresponding keyboard events
    const ratio = offset / maxDrag; // -1 to 1
    if (ratio < -0.25) {
      if (activeKey !== 'a') {
        if (activeKey === 'd') triggerKey('d', 'keyup');
        triggerKey('a', 'keydown');
        setActiveKey('a');
      }
    } else if (ratio > 0.25) {
      if (activeKey !== 'd') {
        if (activeKey === 'a') triggerKey('a', 'keyup');
        triggerKey('d', 'keydown');
        setActiveKey('d');
      }
    } else {
      if (activeKey) {
        triggerKey(activeKey, 'keyup');
        setActiveKey(null);
      }
    }
  };

  const handleTouchEnd = () => {
    // Return slider handle to center and release keys
    setPosition(0);
    if (activeKey) {
      triggerKey(activeKey, 'keyup');
      setActiveKey(null);
    }
  };

  useEffect(() => {
    return () => {
      if (activeKey) {
        triggerKey(activeKey, 'keyup');
      }
    };
  }, [activeKey]);

  if (!isMobile) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '0',
      right: '0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 24px',
      zIndex: 9999,
      pointerEvents: 'none', // click through empty space
    }}>
      {/* Horizontal Slider Joystick */}
      <div 
        ref={trackRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '140px',
          height: '46px',
          background: 'rgba(255, 255, 255, 0.35)',
          backdropFilter: 'blur(10px)',
          borderRadius: '23px',
          border: '2.5px solid #fff',
          boxShadow: '0 8px 32px rgba(80, 58, 90, 0.15)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          touchAction: 'none',
          userSelect: 'none'
        }}
      >
        <span style={{ position: 'absolute', left: '15px', color: '#ff80bf', fontSize: '1.1rem', fontWeight: 'bold', userSelect: 'none', opacity: 0.7 }}>◀</span>
        <span style={{ position: 'absolute', right: '15px', color: '#ff80bf', fontSize: '1.1rem', fontWeight: 'bold', userSelect: 'none', opacity: 0.7 }}>▶</span>
        
        {/* Joystick Thumb */}
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ffb3d9, #c9a0ff)',
          boxShadow: '0 4px 12px rgba(80, 58, 90, 0.25)',
          border: '2px solid #fff',
          transform: `translateX(${position}px)`,
          transition: position === 0 ? 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '1rem',
          userSelect: 'none'
        }}>
          🐾
        </div>
      </div>

      {/* Jump Button */}
      <button
        onTouchStart={(e) => {
          e.preventDefault();
          triggerKey(' ', 'keydown');
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          triggerKey(' ', 'keyup');
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          triggerKey(' ', 'keydown');
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          triggerKey(' ', 'keyup');
        }}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff914d, #ff5757)',
          border: '3px solid #fff',
          boxShadow: '0 8px 24px rgba(255, 87, 87, 0.4)',
          color: '#fff',
          fontSize: '0.85rem',
          fontWeight: '900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          touchAction: 'none',
          cursor: 'pointer',
          outline: 'none',
          userSelect: 'none',
          transform: 'scale(1)',
          transition: 'transform 0.1s'
        }}
        onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
        onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        JUMP
      </button>
    </div>
  );
}
