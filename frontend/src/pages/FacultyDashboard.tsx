import React from 'react';
import { useNavigate } from 'react-router-dom';

const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="page-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Faculty Dashboard</h1>
          <p>Welcome to your portal. Manage assigned courses, class rosters, grades, and attendance.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-outline" style={{ width: 'auto' }} onClick={() => navigate('/faculty/schedule')}>
            📅 Teaching Schedule
          </button>
          <button className="btn-outline" style={{ width: 'auto' }} onClick={() => navigate('/faculty/inbox')}>
            📬 Inbox
          </button>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/faculty/courses')}>
            Manage Classes →
          </button>
        </div>
      </div>
      
      <div className="course-grid" style={{ marginTop: '1.5rem' }}>
        <div className="course-card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)' }}>
          <span className="course-code" style={{ background: '#dbeafe', color: '#1e40af' }}>Schedule</span>
          <h3 className="course-title">Teaching Timetable Matrix</h3>
          <p className="course-desc">View your assigned lecture schedule (Sun–Thu), verify classroom venues, and print certified teaching slips.</p>
          <button className="btn-primary" style={{ marginTop: 'auto' }} onClick={() => navigate('/faculty/schedule')}>
            Open Timetable →
          </button>
        </div>

        <div className="course-card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)' }}>
          <span className="course-code" style={{ background: '#d1fae5', color: '#065f46' }}>Instruction</span>
          <h3 className="course-title">My Assigned Classes</h3>
          <p className="course-desc">Review your student rosters, manage class sessions, record daily attendance, and assign semester grades.</p>
          <button className="btn-outline" style={{ marginTop: 'auto' }} onClick={() => navigate('/faculty/courses')}>
            Open My Classes →
          </button>
        </div>

        <div className="course-card" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)' }}>
          <span className="course-code" style={{ background: '#fef3c7', color: '#92400e' }}>Notices</span>
          <h3 className="course-title">Faculty Announcements</h3>
          <p className="course-desc">View administrative directives, grading window deadlines, and official university communications.</p>
          <button className="btn-outline" style={{ marginTop: 'auto' }} onClick={() => navigate('/faculty/inbox')}>
            View Faculty Notices →
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;