import React, { useEffect, useState, useContext, useMemo } from 'react';
import api from '../api';
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
  is_read: boolean;
}

const AnnouncementsInbox: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'important'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  
  const toast = useContext(ToastContext);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
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
    const handleRefresh = () => fetchAnnouncements();
    window.addEventListener('announcements:refresh', handleRefresh);
    return () => window.removeEventListener('announcements:refresh', handleRefresh);
  }, []);

  const handleMarkAsRead = async (announcement: Announcement) => {
    if (announcement.is_read) return;
    try {
      await api.post(`/announcements/${announcement.id}/read`);
      setAnnouncements(prev => prev.map(a => a.id === announcement.id ? { ...a, is_read: true } : a));
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/announcements/mark-all-read');
      setAnnouncements(prev => prev.map(a => ({ ...a, is_read: true })));
      toast?.showToast('All announcements marked as read', 'success');
    } catch {
      toast?.showToast('Failed to mark all as read', 'error');
    }
  };

  const openAnnouncement = (a: Announcement) => {
    setSelectedAnnouncement(a);
    handleMarkAsRead(a);
  };

  const unreadCount = useMemo(() => announcements.filter(a => !a.is_read).length, [announcements]);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(a => {
      if (activeTab === 'unread' && a.is_read) return false;
      if (activeTab === 'important' && a.priority === 'normal') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [announcements, activeTab, searchQuery]);

  return (
    <div className="page-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1>📬 Inbox & Announcements</h1>
            {unreadCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '12px',
                padding: '0.15rem 0.55rem',
                letterSpacing: '0.02em'
              }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <p>Official notices, registration deadlines, and university announcements.</p>
        </div>
        {unreadCount > 0 && (
          <button 
            className="btn-outline" 
            style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={handleMarkAllRead}
          >
            ✓ Mark All as Read
          </button>
        )}
      </div>

      {/* Search and Tabs Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        borderBottom: '2px solid var(--border)',
        paddingBottom: '2px'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
          {[
            { key: 'all', label: 'All Notices', count: announcements.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'important', label: 'Important / Urgent', count: announcements.filter(a => a.priority !== 'normal').length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                marginBottom: '-2px',
                padding: '0.6rem 0.9rem',
                fontFamily: 'Inter, sans-serif',
                fontWeight: activeTab === tab.key ? 700 : 500,
                fontSize: '0.875rem',
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                background: activeTab === tab.key ? 'var(--focus-yellow)' : '#f1f5f9',
                color: activeTab === tab.key ? 'var(--text-main)' : 'var(--text-muted)',
                borderRadius: '12px',
                padding: '0.1rem 0.45rem',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div style={{ width: '260px', minWidth: '200px' }}>
          <input
            type="text"
            placeholder="🔍 Search announcements..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.85rem',
              fontSize: '0.85rem',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: '#fff',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Announcements List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : filteredAnnouncements.length === 0 ? (
          <div className="empty-state">
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No Announcements Found</h3>
            <p style={{ margin: 0 }}>
              {searchQuery ? 'No results matched your search query.' : 
               activeTab === 'unread' ? 'You have read all your announcements!' : 
               'There are no active notices posted at this time.'}
            </p>
          </div>
        ) : (
          filteredAnnouncements.map(a => {
            const isUrgent = a.priority === 'urgent';
            const isImportant = a.priority === 'important';

            return (
              <div
                key={a.id}
                onClick={() => openAnnouncement(a)}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: isUrgent ? '1.5px solid #fecdd3' : isImportant ? '1.5px solid #fde68a' : '1px solid var(--border)',
                  borderLeft: isUrgent ? '5px solid #dc2626' : isImportant ? '5px solid #d97706' : !a.is_read ? '5px solid var(--primary)' : '1px solid var(--border)',
                  padding: '1.25rem 1.5rem',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {!a.is_read && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        display: 'inline-block'
                      }} />
                    )}
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      fontWeight: a.is_read ? 600 : 800,
                      color: 'var(--text-main)'
                    }}>
                      {a.title}
                    </h3>
                    {isUrgent && (
                      <span style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #fca5a5'
                      }}>
                        🚨 Urgent
                      </span>
                    )}
                    {isImportant && (
                      <span style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #fcd34d'
                      }}>
                        ⚠️ Important
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                <p style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  lineHeight: '1.55',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {a.content}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Posted by: <strong>{a.author_name || 'Administration'}</strong></span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Read Notice →</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Announcement Detail Modal */}
      <Modal
        isOpen={!!selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
        title={selectedAnnouncement?.title || 'Announcement'}
        size="md"
      >
        <div style={{ padding: '0.25rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sender: </span>
              <strong style={{ fontSize: '0.85rem' }}>{selectedAnnouncement?.author_name || 'Administration'}</strong>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {selectedAnnouncement && new Date(selectedAnnouncement.created_at).toLocaleString()}
            </span>
          </div>

          <div style={{
            fontSize: '0.95rem',
            lineHeight: '1.7',
            color: 'var(--text-main)',
            whiteSpace: 'pre-wrap',
            marginBottom: '1.5rem',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {selectedAnnouncement?.content}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setSelectedAnnouncement(null)}>
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AnnouncementsInbox;
