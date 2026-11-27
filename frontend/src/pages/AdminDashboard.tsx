import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import api, { getCachedData } from '../api';

const AdminDashboard: React.FC = () => {
  const auth = useContext(AuthContext);
  const [stats, setStats] = useState(() => {
    const cachedCourses = getCachedData<any[]>('/courses') || [];
    const cachedUsers = getCachedData<any[]>('/users') || [];
    return {
      courses: cachedCourses.length,
      students: cachedUsers.filter((u: any) => u.role === 'student').length,
      faculty: cachedUsers.filter((u: any) => u.role === 'faculty').length,
      totalUsers: cachedUsers.length,
      bannedUsers: 0,
      enrollments: 0,
      groups: 0,
      newUsers7d: 0,
    };
  });

  useEffect(() => {
    if (auth?.user) {
      Promise.all([api.get('/courses'), api.get('/users'), api.get('/admin/security/stats')])
        .then(([courseRes, userRes, secRes]) => {
          const allUsers = userRes.data;
          const sec = secRes.data || {};
          setStats({
            courses: sec.total_courses ?? courseRes.data.length,
            students: allUsers.filter((u: any) => u.role === 'student').length,
            faculty: allUsers.filter((u: any) => u.role === 'faculty').length,
            totalUsers: sec.total_users ?? allUsers.length,
            bannedUsers: sec.banned_users ?? 0,
            enrollments: sec.total_enrollments ?? 0,
            groups: sec.total_groups ?? 0,
            newUsers7d: sec.new_users_7d ?? 0,
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
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Users (7d New)</p>
          <h2 style={{ margin: 0, fontSize: '2.5rem', color: '#2563eb' }}>{stats.totalUsers} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>(+{stats.newUsers7d})</span></h2>
        </div>
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Banned Users</p>
          <h2 style={{ margin: 0, fontSize: '2.5rem', color: '#dc2626' }}>{stats.bannedUsers}</h2>
        </div>
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Enrollments / Groups</p>
          <h2 style={{ margin: 0, fontSize: '2.5rem', color: '#7c3aed' }}>{stats.enrollments} / {stats.groups}</h2>
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

        <div className="course-card" style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #ffffff 100%)' }}>
          <span className="course-code" style={{ background: '#fee2e2', color: '#dc2626' }}>Security & Audit</span>
          <h3 className="course-title">Security Center</h3>
          <p className="course-desc">Track active devices, audit login events, ban malicious users, and control system sessions.</p>
          <Link to="/admin/security" style={{ textDecoration: 'none', marginTop: 'auto' }}>
            <button className="btn-primary" style={{ background: '#dc2626' }}>Open Security Center →</button>
          </Link>
        </div>

        <div className="course-card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)' }}>
          <span className="course-code" style={{ background: '#d1fae5', color: '#065f46' }}>Communications</span>
          <h3 className="course-title">Announcements & Alerts</h3>
          <p className="course-desc">Broadcast emergency notices, registration deadlines, and messages directly to student and faculty inboxes.</p>
          <Link to="/admin/announcements" style={{ textDecoration: 'none', marginTop: 'auto' }}>
            <button className="btn-primary" style={{ background: '#059669' }}>Manage Notices →</button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;