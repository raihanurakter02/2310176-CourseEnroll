import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import api, { getCachedData } from '../api';
import { ToastContext } from '../ToastContext';
import Modal from '../components/Modal';
import SearchInput from '../components/SearchInput';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SecurityStats {
  total_events: number;
  critical_events_24h: number;
  active_sessions: number;
  banned_users: number;
  failed_logins_24h: number;
}

interface SecurityEvent {
  id: number;
  event_type: string;
  user_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  detail: string | null;
  created_at: string;
  severity: 'info' | 'warning' | 'critical';
}

interface Session {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  ip_address: string | null;
  device_hint: string | null;
  created_at: string;
  last_seen: string;
  is_active: boolean;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_banned?: boolean;
  ban_reason?: string | null;
  login_attempts?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  login_success: '✅ Login Success',
  login_failed: '⚠️ Failed Login',
  token_malformed: '🚨 Malformed Token',
  user_banned: '🔒 User Banned',
  user_unbanned: '🔓 User Unbanned',
  session_revoked: '🔑 Session Revoked',
  force_logout_all: '🚨 Force Logout All',
  suspicious_activity: '🕵️ Suspicious Activity',
};

function formatEventType(type: string): string {
  return EVENT_LABELS[type] ?? type.replace(/_/g, ' ');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, React.CSSProperties> = {
    info: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
    warning: { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' },
    critical: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  };
  const style = colors[severity] ?? colors.info;
  return (
    <span
      style={{
        ...style,
        padding: '0.15rem 0.55rem',
        borderRadius: '4px',
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'inline-block',
      }}
      className={severity === 'critical' ? 'badge-pulse' : ''}
    >
      {severity}
    </span>
  );
}

// ── Tab styles ─────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Active Sessions', 'Security Events', 'User Access Control'] as const;
type Tab = typeof TABS[number];

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        height: '110px',
        animation: 'pageFadeIn 0.5s ease-out',
        opacity: 0.6,
      }}
    />
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: number | undefined;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.375rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>{icon}</div>
      <div
        style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: accent ?? 'var(--text-main)',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
        }}
      >
        {value ?? '—'}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const AdminSecurity: React.FC = () => {
  const toast = useContext(ToastContext);

  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  const cachedStats = getCachedData<SecurityStats>('/admin/security/stats');
  const cachedSessions = getCachedData<Session[]>('/admin/security/sessions');
  const cachedEvents = getCachedData<SecurityEvent[]>('/admin/security/events?limit=50&offset=0');
  const cachedUsers = getCachedData<User[]>('/users');

  // Overview
  const [stats, setStats] = useState<SecurityStats>(() => cachedStats || {
    total_events: 0,
    critical_events_24h: 0,
    active_sessions: 0,
    banned_users: 0,
    failed_logins_24h: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [forceLogoutOpen, setForceLogoutOpen] = useState(false);
  const [forceLogoutLoading, setForceLogoutLoading] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<Session[]>(() => cachedSessions || []);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  // Events
  const [events, setEvents] = useState<SecurityEvent[]>(() => cachedEvents || []);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Users
  const [users, setUsers] = useState<User[]>(() => cachedUsers || []);
  const [usersLoading, setUsersLoading] = useState(false);
  const [banModalUser, setBanModalUser] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banLoading, setBanLoading] = useState(false);
  const [unbanLoadingId, setUnbanLoadingId] = useState<number | null>(null);

  // Search & Filter States
  const [sessionSearch, setSessionSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'banned'>('all');

  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions;
    const q = sessionSearch.toLowerCase().trim();
    return sessions.filter(s =>
      s.user_name.toLowerCase().includes(q) ||
      s.user_email.toLowerCase().includes(q) ||
      (s.ip_address && s.ip_address.toLowerCase().includes(q)) ||
      (s.device_hint && s.device_hint.toLowerCase().includes(q))
    );
  }, [sessions, sessionSearch]);

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const q = eventSearch.toLowerCase().trim();
      const matchesSearch = !q || (
        (ev.user_email && ev.user_email.toLowerCase().includes(q)) ||
        (ev.ip_address && ev.ip_address.toLowerCase().includes(q)) ||
        (ev.detail && ev.detail.toLowerCase().includes(q)) ||
        ev.event_type.toLowerCase().includes(q) ||
        formatEventType(ev.event_type).toLowerCase().includes(q)
      );
      const matchesSeverity = severityFilter === 'all' || ev.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [events, eventSearch, severityFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = userSearch.toLowerCase().trim();
      const matchesSearch = !q || (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      const matchesStatus = userStatusFilter === 'all' || (
        userStatusFilter === 'banned' ? u.is_banned : !u.is_banned
      );
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, userSearch, userRoleFilter, userStatusFilter]);

  // ── Fetchers ─────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    if (!cachedStats) setStatsLoading(true);
    try {
      const res = await api.get('/admin/security/stats');
      if (res.data) setStats(res.data);
    } catch (err) {
      console.error('Failed to load security stats', err);
    } finally {
      setStatsLoading(false);
    }
  }, [cachedStats]);

  const fetchSessions = useCallback(async () => {
    if (!cachedSessions) setSessionsLoading(true);
    try {
      const res = await api.get('/admin/security/sessions');
      setSessions(res.data || []);
    } catch (err) {
      console.error('Failed to load sessions', err);
      toast?.showToast('Failed to load sessions', 'error');
    } finally {
      setSessionsLoading(false);
    }
  }, [cachedSessions, toast]);

  const fetchEvents = useCallback(async () => {
    if (!cachedEvents) setEventsLoading(true);
    try {
      const res = await api.get('/admin/security/events?limit=50&offset=0');
      setEvents(res.data || []);
    } catch (err) {
      console.error('Failed to load security events', err);
      toast?.showToast('Failed to load security events', 'error');
    } finally {
      setEventsLoading(false);
    }
  }, [cachedEvents, toast]);

  const fetchUsers = useCallback(async () => {
    if (!cachedUsers) setUsersLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load users', err);
      toast?.showToast('Failed to load users', 'error');
    } finally {
      setUsersLoading(false);
    }
  }, [toast]);

  // Initial loads
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'Overview') fetchStats();
    if (activeTab === 'Active Sessions') fetchSessions();
    if (activeTab === 'Security Events') fetchEvents();
    if (activeTab === 'User Access Control') fetchUsers();
  }, [activeTab, fetchStats, fetchSessions, fetchEvents, fetchUsers]);

  // Auto-refresh events every 30s
  useEffect(() => {
    if (activeTab !== 'Security Events') return;
    const id = setInterval(fetchEvents, 30_000);
    return () => clearInterval(id);
  }, [activeTab, fetchEvents]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleForceLogout = async () => {
    setForceLogoutLoading(true);
    try {
      await api.post('/admin/security/force-logout-all');
      toast?.showToast('All users have been logged out', 'success');
      setForceLogoutOpen(false);
      fetchStats();
    } catch {
      toast?.showToast('Failed to force logout', 'error');
    } finally {
      setForceLogoutLoading(false);
    }
  };

  const handleRevoke = async (sessionId: number) => {
    setRevokingId(sessionId);
    try {
      await api.delete(`/admin/security/sessions/${sessionId}`);
      toast?.showToast('Session revoked', 'success');
      fetchSessions();
    } catch {
      toast?.showToast('Failed to revoke session', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  const handleBan = async () => {
    if (!banModalUser) return;
    setBanLoading(true);
    try {
      await api.post(`/admin/security/users/${banModalUser.id}/ban`, { ban_reason: banReason });
      toast?.showToast(`${banModalUser.name} has been banned`, 'success');
      setBanModalUser(null);
      setBanReason('');
      fetchUsers();
      fetchStats();
      fetchEvents();
    } catch {
      toast?.showToast('Failed to ban user', 'error');
    } finally {
      setBanLoading(false);
    }
  };

  const handleUnban = async (user: User) => {
    setUnbanLoadingId(user.id);
    try {
      await api.post(`/admin/security/users/${user.id}/unban`);
      toast?.showToast(`${user.name} has been unbanned`, 'success');
      fetchUsers();
      fetchStats();
      fetchEvents();
    } catch {
      toast?.showToast('Failed to unban user', 'error');
    } finally {
      setUnbanLoadingId(null);
    }
  };

  // ── Tab: Overview ─────────────────────────────────────────────────────────────

  const renderOverview = () => (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard icon="📊" label="Total Events" value={stats?.total_events} />
            <StatCard icon="🚨" label="Critical (24h)" value={stats?.critical_events_24h} accent="#dc2626" />
            <StatCard icon="🖥️" label="Active Sessions" value={stats?.active_sessions} accent="#2f6f5e" />
            <StatCard icon="🚫" label="Banned Users" value={stats?.banned_users} accent="#d97706" />
            <StatCard icon="⚠️" label="Failed Logins (24h)" value={stats?.failed_logins_24h} accent="#b45309" />
          </>
        )}
      </div>

      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.25rem' }}>
            🚨 Danger Zone
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
            Force logout all currently active sessions system-wide. Users will need to log in again.
          </div>
        </div>
        <button
          onClick={() => setForceLogoutOpen(true)}
          style={{
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#b91c1c')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#dc2626')}
        >
          Force Logout All Users
        </button>
      </div>

      {/* Force Logout Confirmation Modal */}
      <Modal
        isOpen={forceLogoutOpen}
        onClose={() => setForceLogoutOpen(false)}
        title="Confirm Force Logout"
        size="sm"
      >
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          This will immediately invalidate <strong>all</strong> active sessions across the entire platform. Every logged-in user will be signed out.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setForceLogoutOpen(false)}
            className="btn-outline"
            style={{ width: 'auto', flex: 1 }}
          >
            Cancel
          </button>
          <button
            onClick={handleForceLogout}
            disabled={forceLogoutLoading}
            style={{
              flex: 1,
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: forceLogoutLoading ? 'not-allowed' : 'pointer',
              opacity: forceLogoutLoading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {forceLogoutLoading && <span className="spinner" style={{ borderTopColor: '#fff' }} />}
            Force Logout All
          </button>
        </div>
      </Modal>
    </div>
  );

  // ── Tab: Active Sessions ───────────────────────────────────────────────────────

  const renderSessions = () => (
    <div>
      <div className="premium-filter-bar">
        <div className="premium-filter-controls">
          <SearchInput
            placeholder="Search session by user, email, IP, or device..."
            value={sessionSearch}
            onChange={setSessionSearch}
          />
          {sessionSearch && (
            <button
              type="button"
              className="premium-reset-btn"
              onClick={() => setSessionSearch('')}
            >
              ✕ Clear Search
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="premium-count-badge">
            <span>Sessions:</span>
            <strong>{filteredSessions.length}</strong> of {sessions.length}
          </div>
          <button
            onClick={fetchSessions}
            className="btn-outline"
            style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.8125rem', height: '40px' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>
      {sessionsLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading sessions…
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="empty-state">
          {sessionSearch ? 'No active sessions match your search criteria.' : 'No active sessions found.'}
        </div>
      ) : (
        <div className="table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <thead>
              <tr style={{ background: '#f8f7f3', borderBottom: '1px solid var(--border)' }}>
                {['User', 'Email', 'Device', 'IP Address', 'Last Seen', 'Created At', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                    {s.user_name}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{s.user_email}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{s.device_hint ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.ip_address ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(s.last_seen)}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(s.created_at)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        color: s.is_active ? '#065f46' : 'var(--text-muted)',
                      }}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: s.is_active ? '#10b981' : '#9ca3af',
                          display: 'inline-block',
                        }}
                      />
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button
                      onClick={() => handleRevoke(s.id)}
                      disabled={revokingId === s.id}
                      style={{
                        background: 'transparent',
                        border: '1.5px solid #dc2626',
                        color: '#dc2626',
                        borderRadius: '6px',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: revokingId === s.id ? 'not-allowed' : 'pointer',
                        opacity: revokingId === s.id ? 0.6 : 1,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (revokingId !== s.id) (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      {revokingId === s.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Tab: Security Events ───────────────────────────────────────────────────────

  const renderEvents = () => (
    <div>
      <div className="premium-filter-bar">
        <div className="premium-filter-controls">
          <SearchInput
            placeholder="Search events by email, IP, type, or detail..."
            value={eventSearch}
            onChange={setEventSearch}
          />
          <select
            className={`premium-filter-select ${severityFilter !== 'all' ? 'active-filter' : ''}`}
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value as any)}
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          {(eventSearch || severityFilter !== 'all') && (
            <button
              type="button"
              className="premium-reset-btn"
              onClick={() => {
                setEventSearch('');
                setSeverityFilter('all');
              }}
            >
              ✕ Reset Filters
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="premium-count-badge">
            <span>Events:</span>
            <strong>{filteredEvents.length}</strong> of {events.length}
          </div>
          <button
            onClick={fetchEvents}
            className="btn-outline"
            style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.8125rem', height: '40px' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>
      {eventsLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading events…
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="empty-state">
          {eventSearch || severityFilter !== 'all' ? 'No events match your search criteria.' : 'No security events recorded.'}
        </div>
      ) : (
        <div className="table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <thead>
              <tr style={{ background: '#f8f7f3', borderBottom: '1px solid var(--border)' }}>
                {['Timestamp', 'Event Type', 'User', 'IP Address', 'Details', 'Severity'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map(ev => (
                <tr key={ev.id} style={{ borderBottom: '1px solid var(--border)' }} className={`severity-${ev.severity}-bg`}>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{formatDate(ev.created_at)}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.85rem' }}>{formatEventType(ev.event_type)}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>{ev.user_email ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>{ev.ip_address ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.detail ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><SeverityBadge severity={ev.severity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Tab: User Access Control ───────────────────────────────────────────────────

  const renderUsers = () => (
    <div>
      <div className="premium-filter-bar">
        <div className="premium-filter-controls">
          <SearchInput
            placeholder="Search user name or email..."
            value={userSearch}
            onChange={setUserSearch}
          />
          <select
            className={`premium-filter-select ${userRoleFilter !== 'all' ? 'active-filter' : ''}`}
            value={userRoleFilter}
            onChange={e => setUserRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Admin</option>
          </select>
          <select
            className={`premium-filter-select ${userStatusFilter !== 'all' ? 'active-filter' : ''}`}
            value={userStatusFilter}
            onChange={e => setUserStatusFilter(e.target.value as any)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
          {(userSearch || userRoleFilter !== 'all' || userStatusFilter !== 'all') && (
            <button
              type="button"
              className="premium-reset-btn"
              onClick={() => {
                setUserSearch('');
                setUserRoleFilter('all');
                setUserStatusFilter('all');
              }}
            >
              ✕ Reset Filters
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="premium-count-badge">
            <span>Users:</span>
            <strong>{filteredUsers.length}</strong> of {users.length}
          </div>
          <button
            onClick={fetchUsers}
            className="btn-outline"
            style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.8125rem', height: '40px' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>
      {usersLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading users…
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="empty-state">
          {userSearch || userRoleFilter !== 'all' || userStatusFilter !== 'all' ? 'No users match your search and filter criteria.' : 'No users found.'}
        </div>
      ) : (
        <div className="table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <thead>
              <tr style={{ background: '#f8f7f3', borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Email', 'Role', 'Status', 'Failed Logins', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{u.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.email}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span
                      style={{
                        background: u.role === 'admin' ? '#ede9fe' : u.role === 'faculty' ? '#e0f2fe' : '#f0fdf4',
                        color: u.role === 'admin' ? '#6d28d9' : u.role === 'faculty' ? '#0369a1' : '#166534',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {u.is_banned ? (
                      <span
                        style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        🚫 Banned
                      </span>
                    ) : (
                      <span
                        style={{
                          background: '#f0fdf4',
                          color: '#166534',
                          border: '1px solid #bbf7d0',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        ✅ Active
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.85rem' }}>
                    {u.login_attempts ?? 0}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {u.role === 'admin' ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.35rem 0.5rem' }}>
                          Protected Admin
                        </span>
                      ) : u.is_banned ? (
                        <button
                          onClick={() => handleUnban(u)}
                          disabled={unbanLoadingId === u.id}
                          style={{
                            background: 'transparent',
                            border: '1.5px solid #2f6f5e',
                            color: '#2f6f5e',
                            borderRadius: '6px',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: unbanLoadingId === u.id ? 'not-allowed' : 'pointer',
                            opacity: unbanLoadingId === u.id ? 0.6 : 1,
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { if (unbanLoadingId !== u.id) (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          {unbanLoadingId === u.id ? 'Unbanning…' : '🔓 Unban'}
                        </button>
                      ) : (
                        <button
                          onClick={() => { setBanModalUser(u); setBanReason(''); }}
                          style={{
                            background: 'transparent',
                            border: '1.5px solid #dc2626',
                            color: '#dc2626',
                            borderRadius: '6px',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          🔒 Ban
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ban Modal */}
      <Modal
        isOpen={!!banModalUser}
        onClose={() => { setBanModalUser(null); setBanReason(''); }}
        title={`Ban ${banModalUser?.name ?? 'User'}`}
        size="sm"
      >
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Provide a reason for banning <strong>{banModalUser?.name}</strong>. The user will be immediately signed out and unable to log in.
        </p>
        <div className="form-group">
          <label>Ban Reason</label>
          <input
            type="text"
            value={banReason}
            onChange={e => setBanReason(e.target.value)}
            placeholder="e.g. Violation of terms of service"
            onKeyDown={e => e.key === 'Enter' && !banLoading && handleBan()}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            onClick={() => { setBanModalUser(null); setBanReason(''); }}
            className="btn-outline"
            style={{ width: 'auto', flex: 1 }}
          >
            Cancel
          </button>
          <button
            onClick={handleBan}
            disabled={banLoading || !banReason.trim()}
            style={{
              flex: 1,
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: banLoading || !banReason.trim() ? 'not-allowed' : 'pointer',
              opacity: banLoading || !banReason.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'opacity 0.15s',
            }}
          >
            {banLoading && <span className="spinner" style={{ borderTopColor: '#fff' }} />}
            Confirm Ban
          </button>
        </div>
      </Modal>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="page-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <h1>🔒 Security Center</h1>
        <p>Monitor sessions, audit events, and manage user access.</p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          borderBottom: '2px solid var(--border)',
          marginBottom: '1.75rem',
          overflowX: 'auto',
        }}
      >
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px',
              padding: '0.65rem 1rem',
              fontFamily: 'Inter, sans-serif',
              fontWeight: activeTab === tab ? 600 : 500,
              fontSize: '0.875rem',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && renderOverview()}
      {activeTab === 'Active Sessions' && renderSessions()}
      {activeTab === 'Security Events' && renderEvents()}
      {activeTab === 'User Access Control' && renderUsers()}
    </div>
  );
};

export default AdminSecurity;
