import React, { useState, useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, AuthContext } from './AuthContext';
import { ToastProvider, ToastContext } from './ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import api from './api';
import { useRealtimeNotifications } from './useRealtimeNotifications';

// Public Pages
import Login from './pages/Login';

// Student Pages
import StudentDashboard from './pages/StudentDashboard';
import StudentCourses from './pages/StudentCourses';
import StudentMyCourses from './pages/StudentMyCourses';
import ScheduleTimetable from './pages/ScheduleTimetable';

// Faculty Pages
import FacultyDashboard from './pages/FacultyDashboard';
import FacultyCourses from './pages/FacultyCourses';
import FacultyCourseDetails from './pages/FacultyCourseDetails';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import AdminCourses from './pages/AdminCourses';
import AdminAssignments from './pages/AdminAssignments';
import AdminUsers from './pages/AdminUsers';
import AdminSemesters from './pages/AdminSemesters';
import AdminApprovals from './pages/AdminApprovals';
import AdminSecurity from './pages/AdminSecurity';
import AdminAnnouncements from './pages/AdminAnnouncements';

// Shared Inbox, Groups & Profile
import AnnouncementsInbox from './pages/AnnouncementsInbox';
import GroupsPage from './pages/GroupsPage';
import ProfilePage from './pages/ProfilePage';

const Sidebar: React.FC<{ isOpen: boolean; closeSidebar: () => void }> = ({ isOpen, closeSidebar }) => {
  const auth = useContext(AuthContext);
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const fetchUnread = () => {
      if (auth?.user) {
        api.get('/announcements/unread-count')
          .then(res => setUnreadCount(res.data?.unread_count || 0))
          .catch(() => {});
      }
    };
    fetchUnread();
    window.addEventListener('announcements:refresh', fetchUnread);
    return () => window.removeEventListener('announcements:refresh', fetchUnread);
  }, [auth?.user, location.pathname]);

  if (!auth?.user) return null;

  const initials = auth.user.name
    ? auth.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const roleTheme = auth.user.role === 'admin' 
    ? { bg: '#fee2e2', text: '#991b1b', border: '#fecaca', label: 'Admin' }
    : auth.user.role === 'faculty'
    ? { bg: '#fef3c7', text: '#92400e', border: '#fde68a', label: 'Faculty' }
    : { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0', label: 'Student' };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={closeSidebar}></div>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          📚 CourseEnroll
        </div>
        <div className="sidebar-nav">
          {auth.user.role === 'student' && (
            <>
              <Link to="/student/dashboard" onClick={closeSidebar} className={location.pathname.includes('dashboard') ? 'active' : ''}>Dashboard</Link>
              <Link to="/student/courses" onClick={closeSidebar} className={location.pathname === '/student/courses' ? 'active' : ''}>Course Catalog</Link>
              <Link to="/student/my-courses" onClick={closeSidebar} className={location.pathname.includes('my-courses') ? 'active' : ''}>My Enrollments</Link>
              <Link to="/student/schedule" onClick={closeSidebar} className={location.pathname.includes('schedule') ? 'active' : ''}>📅 Weekly Schedule</Link>
              <Link to="/student/inbox" onClick={closeSidebar} className={location.pathname.includes('inbox') ? 'active' : ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📬 Inbox</span>
                {unreadCount > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '10px',
                    padding: '0.1rem 0.45rem',
                    lineHeight: '1.2'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            </>
          )}
          
          {auth.user.role === 'faculty' && (
            <>
              <Link to="/faculty/dashboard" onClick={closeSidebar} className={location.pathname.includes('dashboard') ? 'active' : ''}>Dashboard</Link>
              <Link to="/faculty/courses" onClick={closeSidebar} className={location.pathname.includes('courses') ? 'active' : ''}>My Classes</Link>
              <Link to="/faculty/schedule" onClick={closeSidebar} className={location.pathname.includes('schedule') ? 'active' : ''}>📅 Teaching Schedule</Link>
              <Link to="/faculty/inbox" onClick={closeSidebar} className={location.pathname.includes('inbox') ? 'active' : ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📬 Inbox</span>
                {unreadCount > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '10px',
                    padding: '0.1rem 0.45rem',
                    lineHeight: '1.2'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            </>
          )}

          {auth.user.role === 'admin' && (
            <>
              <Link to="/admin/dashboard" onClick={closeSidebar} className={location.pathname.includes('dashboard') ? 'active' : ''}>Dashboard</Link>
              <Link to="/admin/semesters" onClick={closeSidebar} className={location.pathname.includes('semesters') ? 'active' : ''}>Semesters</Link>
              <Link to="/admin/approvals" onClick={closeSidebar} className={location.pathname.includes('approvals') ? 'active' : ''}>Approvals</Link>
              <Link to="/admin/courses" onClick={closeSidebar} className={location.pathname.includes('courses') ? 'active' : ''}>Manage Courses</Link>
              <Link to="/admin/assignments" onClick={closeSidebar} className={location.pathname.includes('assignments') ? 'active' : ''}>Assignments</Link>
              <Link to="/admin/users" onClick={closeSidebar} className={location.pathname.includes('users') ? 'active' : ''}>User Management</Link>
              <Link to="/admin/announcements" onClick={closeSidebar} className={location.pathname.includes('announcements') ? 'active' : ''}>📢 Announcements</Link>
              <Link to="/admin/security" onClick={closeSidebar} className={location.pathname.includes('security') ? 'active' : ''}>🔒 Security Center</Link>
            </>
          )}

          <Link to="/groups" onClick={closeSidebar} className={location.pathname.startsWith('/groups') ? 'active' : ''}>👥 Study Groups</Link>
          <Link to="/profile" onClick={closeSidebar} className={location.pathname.startsWith('/profile') ? 'active' : ''}>⚙️ Profile & Sessions</Link>
        </div>

        {/* Enhanced User Profile Card */}
        <div className="sidebar-footer" style={{ padding: '0.85rem 0 0 0', borderTop: '1px solid var(--border)' }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.85rem',
            marginBottom: '0.75rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.65rem' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #1d4a3e 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  letterSpacing: '0.03em'
                }}>
                  {initials}
                </div>
                <span style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid #fff'
                }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: 'var(--text-main)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.25
                }}>
                  {auth.user.name}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: '0.1rem'
                }}>
                  {auth.user.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                background: roleTheme.bg,
                color: roleTheme.text,
                border: `1px solid ${roleTheme.border}`,
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                {roleTheme.label}
              </span>
              <span style={{ fontSize: '0.725rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                Active
              </span>
            </div>
          </div>

          <button 
            className="btn-outline" 
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              color: '#dc2626',
              borderColor: '#fca5a5',
              background: '#fff',
              borderRadius: 'var(--radius-md)',
              transition: 'all 0.15s ease'
            }}
            onClick={() => { closeSidebar(); auth.logout(); }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#dc2626';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#fff';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#fca5a5';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useContext(AuthContext);
  const toast = useContext(ToastContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Realtime instant WebSocket notifications
  useRealtimeNotifications(auth?.user?.id, auth?.user?.role, toast);

  if (auth?.loading) return <div className="auth-container">Loading session...</div>;

  if (!auth?.user) return <>{children}</>;

  return (
    <div className="dashboard-layout">
      <div className="mobile-header">
        <h2 className="mobile-brand">📚 CourseEnroll</h2>
        <button className="hamburger-btn" onClick={() => setIsSidebarOpen(true)}>
          ☰
        </button>
      </div>

      <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setIsSidebarOpen(false)} />
      
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Layout>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              
              {/* Student Protected Routes */}
              <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/student/courses" element={<ProtectedRoute allowedRoles={['student']}><StudentCourses /></ProtectedRoute>} />
              <Route path="/student/my-courses" element={<ProtectedRoute allowedRoles={['student']}><StudentMyCourses /></ProtectedRoute>} />
              <Route path="/student/schedule" element={<ProtectedRoute allowedRoles={['student']}><ScheduleTimetable /></ProtectedRoute>} />
              <Route path="/student/inbox" element={<ProtectedRoute allowedRoles={['student']}><AnnouncementsInbox /></ProtectedRoute>} />
              
              {/* Faculty Protected Routes */}
              <Route path="/faculty/dashboard" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
              <Route path="/faculty/courses" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyCourses /></ProtectedRoute>} />
              <Route path="/faculty/courses/:id" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyCourseDetails /></ProtectedRoute>} />
              <Route path="/faculty/schedule" element={<ProtectedRoute allowedRoles={['faculty']}><ScheduleTimetable /></ProtectedRoute>} />
              <Route path="/faculty/inbox" element={<ProtectedRoute allowedRoles={['faculty']}><AnnouncementsInbox /></ProtectedRoute>} />
              
              {/* Admin Protected Routes */}
              <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/semesters" element={<ProtectedRoute allowedRoles={['admin']}><AdminSemesters /></ProtectedRoute>} />
              <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={['admin']}><AdminApprovals /></ProtectedRoute>} />
              <Route path="/admin/courses" element={<ProtectedRoute allowedRoles={['admin']}><AdminCourses /></ProtectedRoute>} />
              <Route path="/admin/assignments" element={<ProtectedRoute allowedRoles={['admin']}><AdminAssignments /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnnouncements /></ProtectedRoute>} />
              <Route path="/admin/security" element={<ProtectedRoute allowedRoles={['admin']}><AdminSecurity /></ProtectedRoute>} />

              {/* Shared Authenticated Routes */}
              <Route path="/groups" element={<ProtectedRoute allowedRoles={['student', 'faculty', 'admin']}><GroupsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute allowedRoles={['student', 'faculty', 'admin']}><ProfilePage /></ProtectedRoute>} />

              {/* Default catch-all routes */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Layout>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;