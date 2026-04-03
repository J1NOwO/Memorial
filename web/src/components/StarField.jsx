// StarField.jsx - 추모 모드 별빛 배경 (은은하게 반짝)
import { useMemo } from 'react';

export default function StarField() {
  const stars = useMemo(() =>
    Array.from({ length: 45 }, (_, i) => ({
      id:       i,
      left:     `${(Math.random() * 98 + 1).toFixed(1)}%`,
      top:      `${(Math.random() * 98 + 1).toFixed(1)}%`,
      size:     +(Math.random() * 1.6 + 0.8).toFixed(1),
      duration: `${(Math.random() * 3 + 2.5).toFixed(1)}s`,
      delay:    `${(Math.random() * 5).toFixed(1)}s`,
    })), []
  );

  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {stars.map((s) => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: s.left, top: s.top,
            width: s.size, height: s.size,
            borderRadius: '50%',
            backgroundColor: 'white',
            animation: `twinkle ${s.duration} ease-in-out ${s.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}
