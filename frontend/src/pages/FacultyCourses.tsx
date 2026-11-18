import React, { useEffect, useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getCachedData } from '../api';
import SkeletonCard from '../components/SkeletonCard';
import SearchInput from '../components/SearchInput';
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
  const cachedCourses = getCachedData<Course[]>('/faculty/courses');
  const [courses, setCourses] = useState<Course[]>(() => cachedCourses || []);
  const [isPageLoading, setIsPageLoading] = useState(() => !cachedCourses || cachedCourses.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useContext(ToastContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!cachedCourses) {
      setIsPageLoading(true);
    }
    api.get('/faculty/courses')
      .then(res => setCourses(res.data))
      .catch((err: any) => toast?.showToast(err.response?.data?.detail || 'Failed to load assigned classes', 'error'))
      .finally(() => setIsPageLoading(false));
  }, [toast]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter(c =>
      c.course_code.toLowerCase().includes(q) ||
      c.course_name.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  }, [courses, searchQuery]);

  return (
    <div>
      <div className="page-header">
        <h1>My Assigned Classes</h1>
        <p>View your teaching schedule and access student enrollment rosters.</p>
      </div>

      {courses.length > 0 && (
        <div className="premium-filter-bar">
          <div className="premium-filter-controls">
            <SearchInput
              placeholder="Search classes by code, name, or description..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
            {searchQuery && (
              <button
                type="button"
                className="premium-reset-btn"
                onClick={() => setSearchQuery('')}
              >
                ✕ Clear Search
              </button>
            )}
          </div>
          <div className="premium-count-badge">
            <span>Classes:</span>
            <strong>{filteredCourses.length}</strong> of {courses.length}
          </div>
        </div>
      )}

      <div className="course-grid">
        {isPageLoading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : filteredCourses.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📚</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
              {courses.length === 0 ? 'No classes assigned yet' : 'No matching classes found'}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              {courses.length === 0 ? 'Your assigned courses will appear here once the administrator assigns you.' : 'Try a different search keyword.'}
            </p>
          </div>
        ) : (
          <>
            {filteredCourses.map(course => (
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