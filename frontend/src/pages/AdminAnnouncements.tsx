import React, { useEffect, useState, useContext, useMemo } from 'react';
import api, { getCachedData } from '../api';
import Modal from '../components/Modal';
import SkeletonCard from '../components/SkeletonCard';
import { ToastContext } from '../ToastContext';

interface Announcement {
  id: number;
  title: string;
  content: string;
  target_role: string;
  priority: 'normal' | 'important' | 'urgent';
  created_by?: number;
  author_name?: string;
  created_at: string;
  is_active: boolean;
}

const AdminAnnouncements: React.FC = () => {
  const cachedAnnouncements = getCachedData<Announcement[]>('/announcements');
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => cachedAnnouncements || []);
  const [isLoading, setIsLoading] = useState(() => !cachedAnnouncements || cachedAnnouncements.length === 0);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'student' | 'faculty'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'normal' | 'important' | 'urgent'>('all');
  
  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target_role: 'all',
    priority: 'normal',
  });

  // Delete confirmation
  const [itemToDelete, setItemToDelete] = useState<Announcement | null>(null);

  const toast = useContext(ToastContext);

  const fetchAnnouncements = async () => {
    if (!cachedAnnouncements) {
      setIsLoading(true);
    }
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data || []);
    } catch {
      toast?.showToast('Failed to load announcements', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({ title: '', content: '', target_role: 'all', priority: 'normal' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (a: Announcement) => {
    setEditingItem(a);
    setFormData({
      title: a.title,
      content: a.content,
      target_role: a.target_role,
      priority: a.priority,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast?.showToast('Please provide both title and content', 'error');
      return;
    }

    setIsActionLoading(true);
    try {
      if (editingItem) {
        await api.put(`/announcements/${editingItem.id}`, formData);
        toast?.showToast('Announcement updated successfully', 'success');
      } else {
        await api.post('/announcements', formData);
        toast?.showToast('Announcement broadcast successfully', 'success');
      }
      setIsModalOpen(false);
      fetchAnnouncements();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to save announcement', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsActionLoading(true);
    try {
      await api.delete(`/announcements/${itemToDelete.id}`);
      toast?.showToast('Announcement removed', 'success');
      setItemToDelete(null);
      fetchAnnouncements();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to delete announcement', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(a => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q);

      const matchesAudience = audienceFilter === 'all' || a.target_role === audienceFilter;
      const matchesPriority = priorityFilter === 'all' || a.priority === priorityFilter;

      return matchesSearch && matchesAudience && matchesPriority;
    });
  }, [announcements, searchQuery, audienceFilter, priorityFilter]);

  return (
    <div className="page-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>📢 Announcement Management</h1>
          <p>Broadcast university-wide alerts, deadline notices, and official announcements to students and faculty.</p>
        </div>
        <button 
          type="button" 
          className="btn-primary" 
          style={{ width: 'auto' }} 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenCreate();
          }}
        >
          + New Announcement
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
        background: 'var(--surface)',
        padding: '0.85rem 1.25rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, minWidth: '280px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
            <input
              type="text"
              placeholder="Search announcements by title or content..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.4rem', width: '100%', borderRadius: 'var(--radius-md)' }}
            />
          </div>

          <select
            value={audienceFilter}
            onChange={e => setAudienceFilter(e.target.value as any)}
            style={{ width: 'auto', padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-md)', minWidth: '130px' }}
          >
            <option value="all">All Audiences</option>
            <option value="student">Students Only</option>
            <option value="faculty">Faculty Only</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value as any)}
            style={{ width: 'auto', padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-md)', minWidth: '130px' }}
          >
            <option value="all">All Priorities</option>
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </select>

          {(searchQuery || audienceFilter !== 'all' || priorityFilter !== 'all') && (
            <button
              className="btn-outline"
              style={{ width: 'auto', padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
              onClick={() => { setSearchQuery(''); setAudienceFilter('all'); setPriorityFilter('all'); }}
            >
              Reset
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          Showing <strong>{filteredAnnouncements.length}</strong> of {announcements.length} notices
        </div>
      </div>

      {/* Announcements Table */}
      <div className="table-scroll" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '1rem 1.5rem' }}>Title & Content</th>
              <th style={{ padding: '1rem 1.5rem' }}>Target Audience</th>
              <th style={{ padding: '1rem 1.5rem' }}>Priority</th>
              <th style={{ padding: '1rem 1.5rem' }}>Posted Date</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ padding: '2rem' }}><SkeletonCard /></td></tr>
            ) : filteredAnnouncements.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📢</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>No announcements match your search</div>
                  <div style={{ fontSize: '0.875rem' }}>Try clearing filters or search query.</div>
                </td>
              </tr>
            ) : (
              filteredAnnouncements.map(a => {
                const isUrgent = a.priority === 'urgent';
                const isImportant = a.priority === 'important';

                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1.25rem 1.5rem', maxWidth: '380px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.content}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span className="badge" style={{
                        background: a.target_role === 'student' ? '#dbeafe' : a.target_role === 'faculty' ? '#d1fae5' : 'var(--accent-yellow)',
                        color: a.target_role === 'student' ? '#1e40af' : a.target_role === 'faculty' ? '#065f46' : 'var(--text-main)'
                      }}>
                        {a.target_role === 'all' ? '🌐 All Users' : a.target_role === 'student' ? '🎓 Students Only' : '👨‍🏫 Faculty Only'}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span className="badge" style={{
                        background: isUrgent ? '#fee2e2' : isImportant ? '#fef3c7' : '#f1f5f9',
                        color: isUrgent ? '#991b1b' : isImportant ? '#92400e' : '#475569'
                      }}>
                        {isUrgent ? '🚨 Urgent' : isImportant ? '⚠️ Important' : 'Standard'}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn-outline" 
                          style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                          onClick={() => handleOpenEdit(a)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn-outline" 
                          style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#dc2626', borderColor: '#fca5a5' }} 
                          onClick={() => setItemToDelete(a)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Compose / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Announcement' : 'Broadcast New Announcement'}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Announcement Title</label>
            <input
              type="text"
              required
              placeholder="e.g., Spring 2026 Add/Drop Deadline Extended"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Target Audience</label>
              <select
                value={formData.target_role}
                onChange={e => setFormData({ ...formData, target_role: e.target.value })}
              >
                <option value="all">🌐 All University Users</option>
                <option value="student">🎓 Students Only</option>
                <option value="faculty">👨‍🏫 Faculty Only</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>Priority Level</label>
              <select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
              >
                <option value="normal">Normal Priority</option>
                <option value="important">⚠️ Important Notice</option>
                <option value="urgent">🚨 Urgent / Action Required</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Announcement Message</label>
            <textarea
              required
              rows={5}
              placeholder="Write the full announcement message here..."
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn-outline"
              style={{ width: 'auto' }}
              onClick={() => setIsModalOpen(false)}
              disabled={isActionLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: 'auto' }}
              disabled={isActionLoading}
            >
              {isActionLoading ? 'Saving...' : editingItem ? 'Save Changes' : '📢 Broadcast Notice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Delete Announcement"
        size="sm"
      >
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
          Are you sure you want to delete <strong>{itemToDelete?.title}</strong>? It will no longer be visible in student or faculty inboxes.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn-outline" style={{ width: 'auto' }} onClick={() => setItemToDelete(null)} disabled={isActionLoading}>
            Cancel
          </button>
          <button className="btn-primary" style={{ width: 'auto', background: '#dc2626' }} onClick={handleDelete} disabled={isActionLoading}>
            {isActionLoading ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminAnnouncements;
