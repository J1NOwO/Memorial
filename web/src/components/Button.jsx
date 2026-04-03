// Button.jsx - 공통 버튼 (primary / secondary / ghost)
export default function Button({
  variant = 'primary',
  children,
  onClick,
  disabled,
  fullWidth,
  style,
  type = 'button',
  size = 'md',
}) {
  const sizes = {
    sm: { padding: '9px 16px', fontSize: 13 },
    md: { padding: '14px 24px', fontSize: 15 },
    lg: { padding: '17px 28px', fontSize: 16 },
  };

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%)',
      color: 'var(--card)',
      border: 'none',
      boxShadow: '0 4px 16px rgba(92,74,58,0.25)',
    },
    secondary: {
      background: 'linear-gradient(135deg, var(--accent) 0%, #b8845a 100%)',
      color: 'white',
      border: 'none',
      boxShadow: '0 4px 16px rgba(196,149,106,0.35)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-mid)',
      border: '1.5px solid var(--border)',
      boxShadow: 'none',
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 'var(--radius-md)',
        fontWeight: 700,
        fontFamily: 'var(--font-sans)',
        letterSpacing: 0.3,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? '100%' : undefined,
        transition: 'all 0.2s var(--ease)',
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
