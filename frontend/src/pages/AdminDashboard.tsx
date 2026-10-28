import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import api from '../api';

const AdminDashboard: React.FC = () => {
  const auth = useContext(AuthContext);
  const [stats, setStats] = useState({ courses: 0, students: 0, faculty: 0 });

  useEffect(() => {
    if (auth?.user) {
      Promise.all([api.get('/courses'), api.get('/users')])
        .then(([courseRes, userRes]) => {
          const allUsers = userRes.data;
          setStats({
            courses: courseRes.data.length,
            students: allUsers.filter((u: any) => u.role === 'student').length,
            faculty: allUsers.filter((u: any) => u.role === 'faculty').length,
          });
        })
        .catch(() => console.error("Failed to load metrics"));
    }
  }, [auth?.user]); // Removed toast from dependencies

  return (
    <div>
      <div className="page-header">
        <h1>Admin Control Center</h1>
        <p>Oversee university course catalogs, manage capacities, and assign faculty instructors.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Courses</p>
          <h2 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--primary)' }}>{stats.courses}</h2>
        </div>
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Registered Students</p>
          <h2 style={{ margin: 0, fontSize: '2.5rem', color: '#059669' }}>{stats.students}</h2>
        </div>
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Active Faculty</p>
          <h2 style={{ margin: 0, fontSize: '2.5rem', color: '#d97706' }}>{stats.faculty}</h2>
        </div>
      </div>

      <div className="course-grid">
        <div className="course-card" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)' }}>
          <span className="course-code">Registry</span>
          <h3 className="course-title">Manage Courses</h3>
          <p className="course-desc">Create new course offerings, update credit hours, and remove discontinued classes.</p>
          <Link to="/admin/courses" style={{ textDecoration: 'none', marginTop: 'auto' }}>
            <button className="btn-primary">Manage Catalog →</button>
          </Link>
        </div>

        <div className="course-card" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)' }}>
          <span className="course-code" style={{ background: '#fef3c7', color: '#d97706' }}>Assignments</span>
          <h3 className="course-title">Faculty Assignment</h3>
          <p className="course-desc">Assign registered faculty members to teach specific course sections.</p>
          <Link to="/admin/assignments" style={{ textDecoration: 'none', marginTop: 'auto' }}>
            <button className="btn-primary" style={{ background: '#d97706' }}>Manage Assignments →</button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;