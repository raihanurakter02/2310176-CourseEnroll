import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import SkeletonCard from '../components/SkeletonCard';
import { ToastContext } from '../ToastContext';

interface User { id: number; name: string; email: string; role: string; }

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'student' });
  const toast = useContext(ToastContext);

  const fetchUsers = () => {
    setIsPageLoading(true);
    setTimeout(() => {
      api.get('/users')
        .then(res => setUsers(res.data))
        .catch(() => toast?.showToast('Failed to load users', 'error'))
        .finally(() => setIsPageLoading(false));
    }, 600);
  };

  useEffect(() => fetchUsers(), []);

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

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '1rem 1.5rem' }}>Name</th>
              <th style={{ padding: '1rem 1.5rem' }}>Email</th>
              <th style={{ padding: '1rem 1.5rem' }}>Role</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPageLoading ? (
              <tr><td colSpan={4} style={{ padding: '2rem' }}><SkeletonCard /></td></tr>
            ) : (
              users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{user.name}</td>
                  <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)' }}>{user.email}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span className={`badge ${user.role === 'admin' ? 'badge-danger' : user.role === 'faculty' ? 'badge-warning' : 'badge-primary'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn-outline" 
                        style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                        onClick={() => setEditingUser(user)}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn-outline" 
                        style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#dc2626', borderColor: '#fca5a5' }} 
                        onClick={() => setUserToDelete(user.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
    </div>
  );
};

export default AdminUsers;