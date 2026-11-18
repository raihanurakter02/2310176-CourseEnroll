import React, { useEffect, useState } from 'react';

type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: ModalSize;
}

const SIZE_MAP: Record<ModalSize, string> = {
  sm: '400px',
  md: '520px',
  lg: '700px',
};

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Small delay to allow DOM insertion before triggering animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 180);
  };

  if (!isVisible) return null;

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    zIndex: 1000,
    backdropFilter: 'blur(2px)',
    transition: 'opacity 200ms ease',
    opacity: isAnimating ? 1 : 0,
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: SIZE_MAP[size],
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    overflow: 'hidden',
    transition: 'opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
    opacity: isAnimating ? 1 : 0,
    transform: isAnimating ? 'translateY(0)' : 'translateY(20px)',
  };

  return (
    <div style={backdropStyle} onClick={handleClose}>
      <div style={cardStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              color: 'var(--text-main)',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h3>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              lineHeight: 1,
              transition: 'background 0.15s ease, color 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--focus-yellow)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-main)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
            }}
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
