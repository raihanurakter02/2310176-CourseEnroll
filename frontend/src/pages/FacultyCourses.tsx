import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import SkeletonCard from '../components/SkeletonCard';
import { ToastContext } from '../ToastContext';

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  description: string;
  credit: number;
  capacity: number;
}

const FacultyCourses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const toast = useContext(ToastContext);
  const navigate = useNavigate();

  useEffect(() => {
    setTimeout(() => {
      api.get('/faculty/courses')
        .then(res => setCourses(res.data))
        .catch((err: any) => toast?.showToast(err.response?.data?.detail || 'Failed to load assigned classes', 'error'))
        .finally(() => setIsPageLoading(false));
    }, 600);
  }, [toast]);

  return (
    <div>
      <div className="page-header">
        <h1>My Assigned Classes</h1>
        <p>View your teaching schedule and access student enrollment rosters.</p>
      </div>

      <div className="course-grid">
        {isPageLoading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            {courses.map(course => (
              <div key={course.id} className="course-card">
                <div className="badge-container">
                  <span className="badge badge-primary">{course.course_code}</span>
                  <span className="badge badge-success">{course.credit} Credits</span>
                </div>
                
                <h3 className="course-title">{course.course_name}</h3>
                <p className="course-desc">
                  {course.description || 'No description provided for this course.'}
                </p>
                
                <button 
                  className="btn-primary" 
                  style={{ marginTop: 'auto' }}
                  onClick={() => navigate(`/faculty/courses/${course.id}`)}
                >
                  Manage Roster & Grades →
                </button>
              </div>
            ))}

            {courses.length === 0 && (
              <div className="empty-state">
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No Classes Assigned</h3>
                <p style={{ margin: 0 }}>You currently have not been assigned to any courses by the administration.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FacultyCourses;