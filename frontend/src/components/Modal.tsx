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
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    let animTimer: number | null = null;
    let hideTimer: number | null = null;

    if (isOpen) {
      setIsVisible(true);
      // Small frame delay for smooth CSS entrance transition
      animTimer = window.setTimeout(() => {
        setIsAnimating(true);
      }, 20);
    } else {
      setIsAnimating(false);
      hideTimer = window.setTimeout(() => {
        setIsVisible(false);
      }, 200);
    }

    return () => {
      if (animTimer) clearTimeout(animTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 150);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose(e);
    }
  };

  if (!isVisible && !isOpen) return null;

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    zIndex: 1000,
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    transition: 'opacity 180ms ease-out',
    opacity: isAnimating ? 1 : 0,
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: SIZE_MAP[size],
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    transition: 'opacity 180ms ease-out, transform 180ms ease-out',
    opacity: isAnimating ? 1 : 0,
    transform: isAnimating ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)',
  };

  return (
    <div style={backdropStyle} onClick={handleBackdropClick} onMouseDown={e => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div style={cardStyle} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
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
