import React, { useContext, useEffect, useState } from 'react';
import api from '../api';
import { AuthContext } from '../AuthContext';
import { ToastContext } from '../ToastContext';

interface UserSessionItem {
  id: number;
  device_hint: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen: string;
  is_active: boolean;
}

const ProfilePage: React.FC = () => {
  const auth = useContext(AuthContext);
  const toast = useContext(ToastContext);

  const [name, setName] = useState(auth?.user?.name || '');
  const [email, setEmail] = useState(auth?.user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    if (auth?.user) {
      setName(auth.user.name);
      setEmail(auth.user.email);
    }
  }, [auth?.user]);

  const fetchSessions = () => {
    setLoadingSessions(true);
    api.get('/auth/sessions', { skipCache: true } as any)
      .then((res) => setSessions(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.put('/auth/me', { name, email });
      auth?.updateUser(res.data);
      toast?.showToast('Profile updated successfully', 'success');
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast?.showToast('New password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast?.showToast('New passwords do not match', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast?.showToast('Password changed successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to change password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      toast?.showToast('Session revoked', 'success');
      fetchSessions();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to revoke session', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Account Settings & Security</h1>
        <p>Manage your profile details, password, and active login sessions.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="course-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Profile Information</h3>
          <form onSubmit={handleProfileSave}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
              />
            </div>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Role: <strong style={{ textTransform: 'capitalize' }}>{auth?.user?.role}</strong>
            </div>
            <button type="submit" className="btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        <div className="course-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Change Password</h3>
          <form onSubmit={handlePasswordChange}>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
              />
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>New Password (min 8 chars)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={savingPassword}>
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      <div className="course-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>My Login Sessions</h3>
          <button className="btn-secondary" onClick={fetchSessions}>Refresh</button>
        </div>
        {loadingSessions ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No sessions recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>IP Address</th>
                  <th>Last Seen</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.device_hint || 'Unknown Device'}</td>
                    <td>{s.ip_address || 'Unknown'}</td>
                    <td>{new Date(s.last_seen).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {s.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td>
                      {s.is_active && (
                        <button
                          className="btn-danger"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                          onClick={() => handleRevokeSession(s.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
