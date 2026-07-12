import React, { useState, useEffect } from 'react';

export default function MobileControls() {
  const [isMobile, setIsMobile] = useState(false);
  const [pressedKeys, setPressedKeys] = useState({});

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
    const keyCodes = {
      'a': { key: 'a', code: 'KeyA', keyCode: 65 },
      'd': { key: 'd', code: 'KeyD', keyCode: 68 },
      'w': { key: 'w', code: 'KeyW', keyCode: 87 },
      's': { key: 's', code: 'KeyS', keyCode: 83 },
      'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
      'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
      'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
      'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
      ' ': { key: ' ', code: 'Space', keyCode: 32 }
    };
    
    const info = keyCodes[key];
    if (!info) return;

    const event = new KeyboardEvent(eventType, {
      key: info.key,
      keyCode: info.keyCode,
      code: info.code,
      which: info.keyCode,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  };

  const handlePressStart = (key, e) => {
    e.preventDefault();
    setPressedKeys(prev => ({ ...prev, [key]: true }));

    if (key === 'left') {
      triggerKey('a', 'keydown');
      triggerKey('ArrowLeft', 'keydown');
    } else if (key === 'right') {
      triggerKey('d', 'keydown');
      triggerKey('ArrowRight', 'keydown');
    } else if (key === 'up') {
      triggerKey('w', 'keydown');
      triggerKey('ArrowUp', 'keydown');
    } else if (key === 'down') {
      triggerKey('s', 'keydown');
      triggerKey('ArrowDown', 'keydown');
    } else if (key === 'jump') {
      triggerKey(' ', 'keydown');
    }
  };

  const handlePressEnd = (key, e) => {
    e.preventDefault();
    setPressedKeys(prev => ({ ...prev, [key]: false }));

    if (key === 'left') {
      triggerKey('a', 'keyup');
      triggerKey('ArrowLeft', 'keyup');
    } else if (key === 'right') {
      triggerKey('d', 'keyup');
      triggerKey('ArrowRight', 'keyup');
    } else if (key === 'up') {
      triggerKey('w', 'keyup');
      triggerKey('ArrowUp', 'keyup');
    } else if (key === 'down') {
      triggerKey('s', 'keyup');
      triggerKey('ArrowDown', 'keyup');
    } else if (key === 'jump') {
      triggerKey(' ', 'keyup');
    }
  };

  if (!isMobile) return null;

  const button3dStyle = (color1, color2, shadowColor) => ({
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    background: `linear-gradient(135deg, ${color1}, ${color2})`,
    border: '2.5px solid #fff',
    color: '#fff',
    fontSize: '1.2rem',
    fontWeight: '900',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    touchAction: 'none',
    cursor: 'pointer',
    outline: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    transition: 'transform 0.05s, box-shadow 0.05s',
  });

  const getButtonStyle = (key, color1, color2, shadowColor) => {
    const isPressed = pressedKeys[key];
    return {
      ...button3dStyle(color1, color2, shadowColor),
      transform: isPressed ? 'translateY(4px)' : 'translateY(0px)',
      boxShadow: isPressed 
        ? `0 1px 0 ${shadowColor}, 0 3px 6px rgba(80, 58, 90, 0.15)` 
        : `0 5px 0 ${shadowColor}, 0 8px 16px rgba(80, 58, 90, 0.2)`,
    };
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      left: '0',
      right: '0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      padding: '0 16px',
      zIndex: 9999,
      pointerEvents: 'none', // click through empty space
    }}>
      {/* 3D D-Pad (Up, Left, Down, Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 48px)',
        gridTemplateRows: 'repeat(2, 48px)',
        gap: '6px',
        pointerEvents: 'auto',
      }}>
        {/* Row 1 */}
        <div></div>
        <button
          onTouchStart={(e) => handlePressStart('up', e)}
          onTouchEnd={(e) => handlePressEnd('up', e)}
          onMouseDown={(e) => handlePressStart('up', e)}
          onMouseUp={(e) => handlePressEnd('up', e)}
          style={getButtonStyle('up', '#ffb3d9', '#c9a0ff', '#b58bd4')}
        >
          ▲
        </button>
        <div></div>

        {/* Row 2 */}
        <button
          onTouchStart={(e) => handlePressStart('left', e)}
          onTouchEnd={(e) => handlePressEnd('left', e)}
          onMouseDown={(e) => handlePressStart('left', e)}
          onMouseUp={(e) => handlePressEnd('left', e)}
          style={getButtonStyle('left', '#ffb3d9', '#c9a0ff', '#b58bd4')}
        >
          ◀
        </button>
        <button
          onTouchStart={(e) => handlePressStart('down', e)}
          onTouchEnd={(e) => handlePressEnd('down', e)}
          onMouseDown={(e) => handlePressStart('down', e)}
          onMouseUp={(e) => handlePressEnd('down', e)}
          style={getButtonStyle('down', '#ffb3d9', '#c9a0ff', '#b58bd4')}
        >
          ▼
        </button>
        <button
          onTouchStart={(e) => handlePressStart('right', e)}
          onTouchEnd={(e) => handlePressEnd('right', e)}
          onMouseDown={(e) => handlePressStart('right', e)}
          onMouseUp={(e) => handlePressEnd('right', e)}
          style={getButtonStyle('right', '#ffb3d9', '#c9a0ff', '#b58bd4')}
        >
          ▶
        </button>
      </div>

      {/* 3D Jump Button */}
      <button
        onTouchStart={(e) => handlePressStart('jump', e)}
        onTouchEnd={(e) => handlePressEnd('jump', e)}
        onMouseDown={(e) => handlePressStart('jump', e)}
        onMouseUp={(e) => handlePressEnd('jump', e)}
        style={{
          ...getButtonStyle('jump', '#ff914d', '#ff5757', '#d94747'),
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          fontSize: '0.9rem',
        }}
      >
        JUMP
      </button>
    </div>
  );
}
