import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../AuthContext';

const StudentDashboard: React.FC = () => {
  const auth = useContext(AuthContext);

  return (
    <div>
      <div className="page-header">
        <h1>Student Portal</h1>
        <p>Manage your academic journey, browse catalogs, and track active enrollments.</p>
      </div>

      <div className="course-grid">
        <div className="course-card" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)' }}>
          <span className="course-code">Catalog</span>
          <h3 className="course-title">Browse Courses</h3>
          <p className="course-desc">Explore available university courses, check capacities, and enroll instantly.</p>
          <Link to="/student/courses" style={{ textDecoration: 'none', marginTop: 'auto' }}>
            <button className="btn-primary">View Catalog →</button>
          </Link>
        </div>

        <div className="course-card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)' }}>
          <span className="course-code" style={{ background: '#d1fae5', color: '#059669' }}>Schedule</span>
          <h3 className="course-title">My Enrollments</h3>
          <p className="course-desc">View your active semester schedule and manage course drops if needed.</p>
          <Link to="/student/my-courses" style={{ textDecoration: 'none', marginTop: 'auto' }}>
            <button className="btn-primary" style={{ background: '#059669' }}>View Schedule →</button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;