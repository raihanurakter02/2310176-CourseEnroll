import React, { useState, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, AuthContext } from './AuthContext';
import { ToastProvider } from './ToastContext';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import Login from './pages/Login';

// Student Pages
import StudentDashboard from './pages/StudentDashboard';
import StudentCourses from './pages/StudentCourses';
import StudentMyCourses from './pages/StudentMyCourses';

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

const Sidebar: React.FC<{ isOpen: boolean; closeSidebar: () => void }> = ({ isOpen, closeSidebar }) => {
  const auth = useContext(AuthContext);
  const location = useLocation();

  if (!auth?.user) return null;

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
            </>
          )}
          
          {auth.user.role === 'faculty' && (
            <>
              <Link to="/faculty/dashboard" onClick={closeSidebar} className={location.pathname.includes('dashboard') ? 'active' : ''}>Dashboard</Link>
              <Link to="/faculty/courses" onClick={closeSidebar} className={location.pathname.includes('courses') ? 'active' : ''}>My Classes</Link>
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
            </>
          )}
        </div>
        <div className="sidebar-footer">
          <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
            <strong>{auth.user.name}</strong><br/>
            <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{auth.user.role}</span>
          </div>
          <button className="btn-outline" onClick={() => { closeSidebar(); auth.logout(); }}>Sign Out</button>
        </div>
      </aside>
    </>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useContext(AuthContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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
              
              {/* Faculty Protected Routes */}
              <Route path="/faculty/dashboard" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
              <Route path="/faculty/courses" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyCourses /></ProtectedRoute>} />
              <Route path="/faculty/courses/:id" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyCourseDetails /></ProtectedRoute>} />
              
              {/* Admin Protected Routes */}
              <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/semesters" element={<ProtectedRoute allowedRoles={['admin']}><AdminSemesters /></ProtectedRoute>} />
              <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={['admin']}><AdminApprovals /></ProtectedRoute>} />
              <Route path="/admin/courses" element={<ProtectedRoute allowedRoles={['admin']}><AdminCourses /></ProtectedRoute>} />
              <Route path="/admin/assignments" element={<ProtectedRoute allowedRoles={['admin']}><AdminAssignments /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />

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