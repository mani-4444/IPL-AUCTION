'use client';
import { useEffect, useState } from 'react';

export type ToastType = 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const STYLES: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  error:   { bg: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.35)',  color: '#F87171', icon: '✕' },
  warning: { bg: 'rgba(255,107,0,0.12)', border: 'rgba(255,107,0,0.35)', color: '#FB923C', icon: '!' },
  info:    { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', color: '#60A5FA', icon: 'i' },
};

export function Toast({ message, type = 'error', duration = 4000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const s = STYLES[type];

  useEffect(() => {
    // Trigger entrance animation on next tick
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => { setVisible(false); setTimeout(onClose, 300); }, duration);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [duration, onClose]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: '1.25rem',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '-120%'})`,
        transition: 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.3s ease',
        opacity: visible ? 1 : 0,
        zIndex: 9000,
        maxWidth: '420px',
        width: 'calc(100vw - 2rem)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.875rem 1rem',
        borderRadius: '0.75rem',
        background: s.bg,
        border: `1px solid ${s.border}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
      {/* Icon */}
      <div style={{
        flexShrink: 0,
        width: '1.5rem',
        height: '1.5rem',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 700,
        background: `${s.color}22`,
        color: s.color,
        border: `1px solid ${s.color}55`,
      }}>
        {s.icon}
      </div>
      {/* Message */}
      <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: s.color, lineHeight: 1.4 }}>
        {message}
      </span>
      {/* Close */}
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: s.color,
          opacity: 0.6,
          fontSize: '1rem',
          lineHeight: 1,
          padding: '0.25rem',
        }}
        aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

// ── Hook for managing toast queue ────────────────────────────────────────────
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let _nextId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function showToast(message: string, type: ToastType = 'error') {
    const id = _nextId++;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]); // max 3 visible
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, showToast, dismissToast };
}

// ── Toast container rendered in each page ────────────────────────────────────
export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ReturnType<typeof useToast>['toasts'];
  onDismiss: (id: number) => void;
}) {
  return (
    <>
      {toasts.map((t, i) => (
        <div key={t.id} style={{ transform: `translateY(${i * 4}px)` }}>
          <Toast
            message={t.message}
            type={t.type}
            onClose={() => onDismiss(t.id)}
          />
        </div>
      ))}
    </>
  );
}
