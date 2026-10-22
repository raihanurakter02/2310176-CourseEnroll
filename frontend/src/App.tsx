import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import Register from './pages/Register';
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

const Navigation: React.FC = () => {
  const auth = useContext(AuthContext);
  return (
    <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc', marginBottom: '1rem' }}>
      {!auth?.user ? (
        <>
          <Link to="/login">Login</Link> | <Link to="/register">Register</Link>
        </>
      ) : (
        <>
          <span style={{ marginRight: '1rem', fontWeight: 'bold' }}>Role: {auth.user.role}</span>
          
          {auth.user.role === 'student' && (
            <>
              <Link to="/student/dashboard" style={{ marginRight: '1rem' }}>Dashboard</Link>
              <Link to="/student/courses" style={{ marginRight: '1rem' }}>Browse Courses</Link>
              <Link to="/student/my-courses" style={{ marginRight: '1rem' }}>My Enrollments</Link>
            </>
          )}
          
          {auth.user.role === 'faculty' && (
            <>
              <Link to="/faculty/dashboard" style={{ marginRight: '1rem' }}>Dashboard</Link>
              <Link to="/faculty/courses" style={{ marginRight: '1rem' }}>My Assigned Courses</Link>
            </>
          )}

          {auth.user.role === 'admin' && (
            <>
              <Link to="/admin/dashboard" style={{ marginRight: '1rem' }}>Dashboard</Link>
              <Link to="/admin/courses" style={{ marginRight: '1rem' }}>Manage Courses</Link>
              <Link to="/admin/assignments" style={{ marginRight: '1rem' }}>Assignments</Link>
            </>
          )}
          
          <button onClick={auth.logout}>Logout</button>
        </>
      )}
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Navigation />
        <div style={{ padding: '1rem' }}>
          <Routes>
            {/* Public Routes */}
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            
            {/* Student Protected Routes */}
            <Route path="/student/dashboard" element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/student/courses" element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentCourses />
              </ProtectedRoute>
            } />
            <Route path="/student/my-courses" element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentMyCourses />
              </ProtectedRoute>
            } />
            
            {/* Faculty Protected Routes */}
            <Route path="/faculty/dashboard" element={
              <ProtectedRoute allowedRoles={['faculty']}>
                <FacultyDashboard />
              </ProtectedRoute>
            } />
            <Route path="/faculty/courses" element={
              <ProtectedRoute allowedRoles={['faculty']}>
                <FacultyCourses />
              </ProtectedRoute>
            } />
            <Route path="/faculty/courses/:id" element={
              <ProtectedRoute allowedRoles={['faculty']}>
                <FacultyCourseDetails />
              </ProtectedRoute>
            } />
            
            {/* Admin Protected Routes */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/courses" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminCourses />
              </ProtectedRoute>
            } />
            <Route path="/admin/assignments" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAssignments />
              </ProtectedRoute>
            } />

            {/* Default Routes */}
            <Route path="/" element={<h2>Welcome to CourseEnroll</h2>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;