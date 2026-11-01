import React from 'react';
import { useNavigate } from 'react-router-dom';

const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Faculty Dashboard</h1>
          <p>Welcome to your portal. Manage your courses, class rosters, and official attendance here.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/faculty/courses')}>
          View Assigned Courses
        </button>
      </div>
      
      <div className="course-card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem' }}>Ready for the semester?</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
          Access your assigned classes to review your roster, submit official grades, and track class session attendance.
        </p>
        <button className="btn-outline" style={{ width: 'auto' }} onClick={() => navigate('/faculty/courses')}>
          Go to Course Management
        </button>
      </div>
    </div>
  );
};

export default FacultyDashboard; 