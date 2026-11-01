import React from 'react';
import { useNavigate } from 'react-router-dom';

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Student Dashboard</h1>
          <p>Welcome to your portal. Browse courses, manage enrollments, and track your academic progress.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/student/courses')}>
          View Course Catalog
        </button>
      </div>
      
      <div className="course-card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem' }}>Ready to enroll?</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
          Explore available classes for the active semester and submit your enrollment requests.
        </p>
        <button className="btn-outline" style={{ width: 'auto' }} onClick={() => navigate('/student/courses')}>
          Browse Catalog
        </button>
      </div>
    </div>
  );
};

export default StudentDashboard;