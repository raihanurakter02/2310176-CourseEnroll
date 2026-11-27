import React, { useEffect, useState, useContext, useMemo } from 'react';
import api, { getCachedData } from '../api';
import Modal from '../components/Modal';
import SkeletonCard from '../components/SkeletonCard';
import SearchInput from '../components/SearchInput';
import { ToastContext } from '../ToastContext';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  is_banned?: boolean;
  ban_reason?: string | null;
}

const AdminUsers: React.FC = () => {
  const cachedUsers = getCachedData<User[]>('/users');
  const [users, setUsers] = useState<User[]>(() => cachedUsers || []);
  const [isPageLoading, setIsPageLoading] = useState(() => !cachedUsers || cachedUsers.length === 0);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'faculty' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detailModalData, setDetailModalData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [banModalUser, setBanModalUser] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('');
  const [unbanLoadingId, setUnbanLoadingId] = useState<number | null>(null);
  
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'student' });
  const toast = useContext(ToastContext);

  const fetchUsers = () => {
    if (!cachedUsers) {
      setIsPageLoading(true);
    }
    api.get('/users')
      .then(res => setUsers(res.data))
      .catch(() => toast?.showToast('Failed to load users', 'error'))
      .finally(() => setIsPageLoading(false));
  };

  useEffect(() => fetchUsers(), []);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search by name or email
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        user.name.toLowerCase().includes(q) || 
        user.email.toLowerCase().includes(q);

      // Filter by role
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;

      // Filter by status
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'banned' && user.is_banned) || 
        (statusFilter === 'active' && !user.is_banned);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage, totalPages]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkBan = async () => {
    if (selectedIds.length === 0) return;
    setIsActionLoading(true);
    try {
      const res = await api.post('/admin/security/users/bulk-ban', { user_ids: selectedIds, ban_reason: 'Bulk administrative suspension' });
      toast?.showToast(res.data?.message || 'Bulk ban completed', 'success');
      setSelectedIds([]);
      fetchUsers();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Bulk ban failed', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkUnban = async () => {
    if (selectedIds.length === 0) return;
    setIsActionLoading(true);
    try {
      const res = await api.post('/admin/security/users/bulk-unban', { user_ids: selectedIds });
      toast?.showToast(res.data?.message || 'Bulk unban completed', 'success');
      setSelectedIds([]);
      fetchUsers();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Bulk unban failed', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleExportUsers = async () => {
    try {
      const res = await api.get('/admin/export/users', {
        params: { role: roleFilter, status_filter: statusFilter, search: searchQuery },
        responseType: 'blob',
        skipCache: true,
      } as any);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'users_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast?.showToast('Users CSV exported', 'success');
    } catch {
      toast?.showToast('Failed to export users CSV', 'error');
    }
  };

  const openUserDetails = async (userId: number) => {
    setDetailLoading(true);
    setDetailModalData({ loading: true });
    try {
      const res = await api.get(`/admin/users/${userId}/details`, { skipCache: true } as any);
      setDetailModalData(res.data);
    } catch {
      toast?.showToast('Failed to load user details', 'error');
      setDetailModalData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRevokeAllUserSessions = async (userId: number) => {
    try {
      await api.post(`/admin/security/users/${userId}/revoke-sessions`);
      toast?.showToast('All user sessions revoked', 'success');
      openUserDetails(userId);
    } catch {
      toast?.showToast('Failed to revoke sessions', 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      await api.post('/auth/register', newUser);
      toast?.showToast('User created successfully', 'success');
      setNewUser({ name: '', email: '', password: '', role: 'student' });
      setIsCreateModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to create user', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsActionLoading(true);
    try {
      await api.put(`/users/${editingUser.id}`, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role
      });
      toast?.showToast('User updated successfully', 'success');
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to update user', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banModalUser) return;
    setIsActionLoading(true);
    try {
      await api.post(`/admin/security/users/${banModalUser.id}/ban`, {
        ban_reason: banReason || 'Violation of acceptable use policy'
      });
      toast?.showToast(`${banModalUser.name} has been banned`, 'success');
      setBanModalUser(null);
      setBanReason('');
      fetchUsers();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to ban user', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnban = async (user: User) => {
    setUnbanLoadingId(user.id);
    try {
      await api.post(`/admin/security/users/${user.id}/unban`);
      toast?.showToast(`${user.name} has been unbanned successfully!`, 'success');
      fetchUsers();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to unban user', 'error');
    } finally {
      setUnbanLoadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setIsActionLoading(true);
    try {
      await api.delete(`/users/${userToDelete}`);
      toast?.showToast('User deleted successfully', 'success');
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to delete user', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>User Management</h1>
          <p>Manage students, faculty, and administrative accounts.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setIsCreateModalOpen(true)}>
          + Add User
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="premium-filter-bar">
        <div className="premium-filter-controls">
          <SearchInput
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={setSearchQuery}
          />

          <select
            className={`premium-filter-select ${roleFilter !== 'all' ? 'active-filter' : ''}`}
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Admins</option>
          </select>

          <select
            className={`premium-filter-select ${statusFilter !== 'all' ? 'active-filter' : ''}`}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="banned">Banned Only</option>
          </select>

          {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              className="premium-reset-btn"
              onClick={() => { setSearchQuery(''); setRoleFilter('all'); setStatusFilter('all'); }}
            >
              ✕ Reset Filters
            </button>
          )}
        </div>

        <div className="premium-count-badge" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Users:</span>
          <strong>{filteredUsers.length}</strong> of {users.length}
          <button type="button" className="btn-outline" style={{ width: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} onClick={handleExportUsers}>
            📥 Export CSV
          </button>
          {selectedIds.length > 0 && (
            <>
              <button type="button" className="btn-outline" style={{ width: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#fca5a5' }} onClick={handleBulkBan} disabled={isActionLoading}>
                🚫 Bulk Ban ({selectedIds.length})
              </button>
              <button type="button" className="btn-outline" style={{ width: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.8rem', color: '#059669', borderColor: '#a7f3d0' }} onClick={handleBulkUnban} disabled={isActionLoading}>
                🔓 Bulk Unban ({selectedIds.length})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="table-scroll" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '1rem 0.75rem 1rem 1.25rem', width: '36px' }}>Select</th>
              <th style={{ padding: '1rem 1.25rem' }}>Name</th>
              <th style={{ padding: '1rem 1.25rem' }}>Email</th>
              <th style={{ padding: '1rem 1.25rem' }}>Role</th>
              <th style={{ padding: '1rem 1.25rem' }}>Status</th>
              <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPageLoading ? (
              <tr><td colSpan={6} style={{ padding: '2rem' }}><SkeletonCard /></td></tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>No users found</div>
                  <div style={{ fontSize: '0.875rem' }}>Try adjusting your search query or filters.</div>
                </td>
              </tr>
            ) : (
              paginatedUsers.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1.25rem 0.75rem 1.25rem 1.25rem' }}>
                    {user.role !== 'admin' && (
                      <input type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => toggleSelect(user.id)} />
                    )}
                  </td>
                  <td style={{ padding: '1.25rem 1.25rem', fontWeight: 600 }}>{user.name}</td>
                  <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)' }}>{user.email}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span className={`badge ${user.role === 'admin' ? 'badge-danger' : user.role === 'faculty' ? 'badge-warning' : 'badge-primary'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {user.is_banned ? (
                      <span style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        border: '1px solid #fecaca'
                      }}>
                        🚫 Banned
                      </span>
                    ) : (
                      <span style={{
                        background: '#d1fae5',
                        color: '#065f46',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        border: '1px solid #a7f3d0'
                      }}>
                        ✅ Active
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button 
                        className="btn-outline" 
                        style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                        onClick={() => openUserDetails(user.id)}
                      >
                        Details
                      </button>
                      <button 
                        className="btn-outline" 
                        style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                        onClick={() => setEditingUser(user)}
                      >
                        Edit
                      </button>

                      {user.role !== 'admin' && (
                        user.is_banned ? (
                          <button 
                            className="btn-outline" 
                            style={{ 
                              width: 'auto', 
                              padding: '0.4rem 0.8rem', 
                              fontSize: '0.85rem', 
                              color: '#059669', 
                              borderColor: '#a7f3d0',
                              fontWeight: 600,
                              background: '#f0fdf4'
                            }} 
                            onClick={() => handleUnban(user)}
                            disabled={unbanLoadingId === user.id}
                          >
                            {unbanLoadingId === user.id ? 'Unbanning...' : '🔓 Unban'}
                          </button>
                        ) : (
                          <button 
                            className="btn-outline" 
                            style={{ 
                              width: 'auto', 
                              padding: '0.4rem 0.8rem', 
                              fontSize: '0.85rem', 
                              color: '#ea580c', 
                              borderColor: '#fed7aa',
                              fontWeight: 600
                            }} 
                            onClick={() => { setBanModalUser(user); setBanReason(''); }}
                          >
                            🚫 Ban
                          </button>
                        )
                      )}

                      {user.role !== 'admin' && (
                        <button 
                          className="btn-outline" 
                          style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#dc2626', borderColor: '#fca5a5' }} 
                          onClick={() => setUserToDelete(user.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <button className="btn-outline" style={{ width: 'auto' }} disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
            ← Previous
          </button>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Page <strong>{Math.min(currentPage, totalPages)}</strong> of <strong>{totalPages}</strong>
          </span>
          <button className="btn-outline" style={{ width: 'auto' }} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
            Next →
          </button>
        </div>
      )}

      {/* User Detail Modal */}
      <Modal isOpen={!!detailModalData} onClose={() => setDetailModalData(null)} title="User Detail View">
        {detailLoading || detailModalData?.loading ? (
          <p>Loading user details...</p>
        ) : detailModalData?.user ? (
          <div style={{ maxHeight: '70vh', overflowY: 'auto', fontSize: '0.9rem' }}>
            <p><strong>{detailModalData.user.name}</strong> ({detailModalData.user.email}) — <span style={{ textTransform: 'capitalize' }}>{detailModalData.user.role}</span></p>
            <div style={{ marginBottom: '1rem' }}>
              <button className="btn-outline" style={{ width: 'auto', color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleRevokeAllUserSessions(detailModalData.user.id)}>
                🔑 Revoke All Sessions
              </button>
            </div>
            <h4>Enrollments / Courses ({(detailModalData.enrollments?.length || 0) + (detailModalData.taught_courses?.length || 0)})</h4>
            <ul>
              {detailModalData.enrollments?.map((e: any) => (
                <li key={e.id}>{e.course_code}: {e.course_name} ({e.status}{e.grade ? `, Grade: ${e.grade}` : ''})</li>
              ))}
              {detailModalData.taught_courses?.map((c: any) => (
                <li key={c.id}>Teaches {c.course_code}: {c.course_name}</li>
              ))}
            </ul>
            <h4>Study Groups ({detailModalData.groups?.length || 0})</h4>
            <ul>
              {detailModalData.groups?.map((g: any) => (
                <li key={`${g.role}-${g.id}`}>{g.name} ({g.role})</li>
              ))}
            </ul>
            <h4>Sessions ({detailModalData.sessions?.length || 0})</h4>
            <ul>
              {detailModalData.sessions?.map((s: any) => (
                <li key={s.id}>{s.device_hint} — {s.ip_address || 'Unknown IP'} ({s.is_active ? 'Active' : 'Revoked'})</li>
              ))}
            </ul>
            <h4>Recent Activity ({detailModalData.recent_activity?.length || 0})</h4>
            <ul>
              {detailModalData.recent_activity?.slice(0, 10).map((ev: any) => (
                <li key={ev.id}>[{ev.event_type}] {ev.detail} ({new Date(ev.created_at).toLocaleString()})</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>

      {/* Create User Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New User">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Full Name</label>
            <input required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Jane Doe" />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="email@university.edu" />
          </div>
          <div className="form-group">
            <label>Temporary Password</label>
            <input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="••••••••" />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={isActionLoading}>
            {isActionLoading ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={editingUser !== null} onClose={() => setEditingUser(null)} title="Edit User">
        {editingUser && (
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Full Name</label>
              <input required value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" required value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={isActionLoading}>
              {isActionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={userToDelete !== null} onClose={() => setUserToDelete(null)} title="Confirm Deletion">
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ marginBottom: '1.5rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
            Are you sure you want to remove this user from the system? This action is permanent and will clear their active data.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => setUserToDelete(null)} disabled={isActionLoading}>
              Cancel
            </button>
            <button className="btn-primary" style={{ background: '#ef4444' }} onClick={confirmDelete} disabled={isActionLoading}>
              {isActionLoading ? 'Removing...' : 'Confirm Remove'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Ban User Modal */}
      <Modal isOpen={banModalUser !== null} onClose={() => setBanModalUser(null)} title="Ban User Account">
        {banModalUser && (
          <form onSubmit={handleBan}>
            <div style={{ marginBottom: '1.25rem', background: '#fef2f2', border: '1px solid #fee2e2', padding: '0.85rem', borderRadius: '6px' }}>
              <p style={{ margin: 0, color: '#991b1b', fontSize: '0.875rem', lineHeight: 1.5 }}>
                Are you sure you want to suspend <strong>{banModalUser.name}</strong> ({banModalUser.email})?
                Their active sessions will be terminated and they will be blocked from accessing the system immediately.
              </p>
            </div>
            <div className="form-group">
              <label>Suspension Reason</label>
              <input
                required
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="e.g. Terms of service violation, academic misconduct"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn-outline" onClick={() => setBanModalUser(null)} disabled={isActionLoading}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" style={{ background: '#dc2626' }} disabled={isActionLoading}>
                {isActionLoading ? 'Banning...' : 'Confirm Ban'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsers;