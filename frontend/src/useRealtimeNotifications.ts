import { useEffect, useRef } from 'react';
import { getWsUrl } from './api';

// Non-intrusive soft modern audio notification ping using Web Audio API
const playNotificationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Tone 1: Soft warm sine wave (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.35);

    // Tone 2: Harmonious higher chime (880 Hz - A5)
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, ctx.currentTime);
        gain2.gain.setValueAtTime(0.06, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.4);
      } catch {
        // Silently catch audio restrictions
      }
    }, 120);
  } catch {
    // Browsers may block audio until first user gesture; silently ignore
  }
};

export const useRealtimeNotifications = (
  userId?: number,
  userRole?: string,
  toast?: { showToast: (message: string, type?: 'success' | 'error' | 'info') => void } | null
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    let isSubscribed = true;

    const connect = () => {
      try {
        const wsUrl = getWsUrl();
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          // Connected cleanly
        };

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            if (event.data === 'pong') return;
            const data = JSON.parse(event.data);

            if (data.type === 'new_announcement') {
              // Check if announcement targets this user's role
              const roleTarget = data.target_role || 'all';
              if (roleTarget === 'all' || roleTarget === userRole) {
                toast?.showToast(`📢 New Notice: ${data.title}`, 'info');
                playNotificationChime();
                window.dispatchEvent(new CustomEvent('announcements:refresh'));
              }
            } else if (data.type === 'enrollment_update') {
              if (data.student_id === userId) {
                const statusUpper = (data.status || '').toUpperCase();
                const type = data.status === 'approved' ? 'success' : data.status === 'rejected' ? 'error' : 'info';
                toast?.showToast(`🎓 Enrollment Update: ${data.course_title || 'Course'} is ${statusUpper}!`, type);
                playNotificationChime();
                window.dispatchEvent(new CustomEvent('enrollments:refresh'));
              }
            } else if (data.type === 'waitlist_promoted') {
              if (data.student_id === userId) {
                toast?.showToast(`🎉 Waitlist Promotion! A seat opened in ${data.course_title || 'your course'} and you are now enrolled!`, 'success');
                playNotificationChime();
                window.dispatchEvent(new CustomEvent('enrollments:refresh'));
              }
            } else if (data.type === 'session_revoked') {
              if (data.user_id === userId) {
                window.dispatchEvent(new CustomEvent('auth:logout', {
                  detail: { reason: 'Your session was revoked by an administrator' }
                }));
              }
            } else if (data.type === 'user_banned') {
              if (data.user_id === userId) {
                window.dispatchEvent(new CustomEvent('auth:logout', {
                  detail: { reason: 'Your account has been suspended by an administrator' }
                }));
              }
            }
          } catch {
            // Non-JSON message (e.g. text ping)
          }
        };

        ws.onclose = () => {
          if (!isSubscribed) return;
          // Exponential / gentle reconnect after 4 seconds
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, 4000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        // Fallback: reconnect after delay
        reconnectTimeoutRef.current = window.setTimeout(connect, 6000);
      }
    };

    connect();

    // Heartbeat ping every 25 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send('ping');
        } catch {
          // ignore
        }
      }
    }, 25000);

    return () => {
      isSubscribed = false;
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId, userRole, toast]);
};
