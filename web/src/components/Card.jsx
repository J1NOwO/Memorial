// Card.jsx - 공통 카드 컴포넌트
export default function Card({ children, style, className, onClick, lift = true, padding }) {
  return (
    <div
      className={`${lift && onClick ? 'card-lift' : ''} ${className || ''}`}
      onClick={onClick}
      style={{
        backgroundColor: 'var(--card)',
        borderRadius: 'var(--radius-lg)',
        padding: padding ?? 20,
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border-light)',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
