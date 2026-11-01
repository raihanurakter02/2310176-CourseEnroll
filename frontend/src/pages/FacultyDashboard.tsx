import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../AuthContext';

const FacultyDashboard: React.FC = () => {
  const auth = useContext(AuthContext);

  return (
    <div>
      <div className="page-header">
        <h1>Faculty Portal</h1>
        <p>Manage your assigned classes, review student lists, and oversee course rosters.</p>
      </div>

      <div className="course-grid">
        <div className="course-card" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)' }}>
          <span className="course-code">Classes</span>
          <h3 className="course-title">Assigned Classes</h3>
          <p className="course-desc">View all courses assigned to you by the administration and access student rosters.</p>
          <Link to="/faculty/courses" style={{ textDecoration: 'none', marginTop: 'auto' }}>
            <button className="btn-primary">View My Classes →</button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;