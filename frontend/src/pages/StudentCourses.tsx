import React, { useEffect, useState, useContext } from 'react';
import api, { getCachedData } from '../api';
import Modal from '../components/Modal';
import SkeletonCard from '../components/SkeletonCard';
import { ToastContext } from '../ToastContext';

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  description: string;
  credit: number;
  capacity: number;
  enrolled_count?: number;
  waitlist_count?: number;
  schedule_days?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
}

interface Enrollment {
  id: number;
  course_id: number;
  status: string;
}

const StudentCourses: React.FC = () => {
  const cachedCourses = getCachedData<Course[]>('/courses');
  const cachedEnrollments = getCachedData<Enrollment[]>('/enrollments/my');
  const [courses, setCourses] = useState<Course[]>(() => cachedCourses || []);
  const [myEnrollments, setMyEnrollments] = useState<Enrollment[]>(() => cachedEnrollments || []);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(() => !cachedCourses || cachedCourses.length === 0);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const toast = useContext(ToastContext);

  const fetchCatalogAndEnrollments = async () => {
    if (!getCachedData('/courses')) {
      setIsPageLoading(true);
    }
    try {
      const [coursesRes, enrollRes] = await Promise.all([
        api.get('/courses'),
        api.get('/enrollments/my')
      ]);
      setCourses(coursesRes.data);
      setMyEnrollments(enrollRes.data);
    } catch {
      toast?.showToast('Failed to load course catalog', 'error');
    } finally {
      setIsPageLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogAndEnrollments();
    const handleRefresh = () => fetchCatalogAndEnrollments();
    window.addEventListener('enrollments:refresh', handleRefresh);
    return () => window.removeEventListener('enrollments:refresh', handleRefresh);
  }, []);

  const handleEnroll = async () => {
    if (!selectedCourse) return;
    setIsActionLoading(true);

    const isFull = (selectedCourse.enrolled_count || 0) >= selectedCourse.capacity;

    try {
      await api.post('/enrollments', { course_id: selectedCourse.id });
      if (isFull) {
        toast?.showToast(`Added to automatic waitlist for ${selectedCourse.course_code}!`, 'info');
      } else {
        toast?.showToast(`Enrollment request submitted for ${selectedCourse.course_code}!`, 'success');
      }
      setSelectedCourse(null);
      fetchCatalogAndEnrollments();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Enrollment request failed', 'error');
      setSelectedCourse(null);
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredCourses = courses.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.course_code.toLowerCase().includes(q) ||
      c.course_name.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="page-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Course Catalog</h1>
          <p>Browse available university courses, review weekly schedules, and request registration or join the waitlist.</p>
        </div>
        <div style={{ minWidth: '260px' }}>
          <input
            type="text"
            placeholder="🔍 Search course name or code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ margin: 0 }}
          />
        </div>
      </div>

      <div className="course-grid">
        {isPageLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            {filteredCourses.map(course => {
              const existing = myEnrollments.find(e => e.course_id === course.id);
              const isFull = (course.enrolled_count || 0) >= course.capacity;

              return (
                <div key={course.id} className="course-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="badge-container" style={{ flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.65rem' }}>
                    <span className="badge badge-primary">{course.course_code}</span>
                    <span className="badge badge-success">{course.credit} Credits</span>
                    
                    {isFull && !existing && (
                      <span style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fde68a',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-sm)'
                      }}>
                        Full ({course.waitlist_count || 0} on Waitlist)
                      </span>
                    )}

                    {existing && (
                      <span
                        className={`badge ${
                          existing.status === 'approved'
                            ? 'badge-success'
                            : existing.status === 'rejected'
                            ? 'badge-danger'
                            : existing.status === 'waitlisted'
                            ? 'badge-warning'
                            : 'badge-warning'
                        }`}
                      >
                        {existing.status === 'waitlisted' ? '⏳ Waitlisted' : existing.status.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <h3 className="course-title" style={{ margin: '0 0 0.5rem 0' }}>{course.course_name}</h3>
                  
                  <p className="course-desc" style={{ flexGrow: 1, minHeight: '2.5rem', fontSize: '0.85rem' }}>
                    {course.description || 'Comprehensive university lecture course.'}
                  </p>

                  {/* Schedule & Location Pill */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.6rem 0.75rem',
                    marginBottom: '1rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span>📅 <strong>{course.schedule_days || 'Mon,Wed'}</strong></span>
                      <span>⏰ {course.start_time || '10:00'} - {course.end_time || '11:30'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>📍 {course.room || 'Hall 101'}</span>
                      <span style={{ fontWeight: 600, color: isFull ? '#dc2626' : 'var(--primary)' }}>
                        👥 {course.enrolled_count || 0} / {course.capacity} Seats
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    className={existing ? 'btn-outline' : isFull ? 'btn-outline' : 'btn-primary'}
                    style={{
                      width: '100%',
                      marginTop: 'auto',
                      borderColor: !existing && isFull ? '#d97706' : undefined,
                      color: !existing && isFull ? '#92400e' : undefined,
                      background: !existing && isFull ? '#fffbeb' : undefined,
                      fontWeight: 600
                    }}
                    disabled={!!existing}
                    onClick={() => setSelectedCourse(course)}
                  >
                    {existing
                      ? existing.status === 'approved'
                        ? 'Enrolled in Schedule'
                        : existing.status === 'waitlisted'
                        ? 'In Automatic Waitlist'
                        : `Request ${existing.status.charAt(0).toUpperCase() + existing.status.slice(1)}`
                      : isFull
                      ? 'Join Waitlist Queue'
                      : 'Request Enrollment'}
                  </button>
                </div>
              );
            })}

            {filteredCourses.length === 0 && (
              <div className="empty-state">
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No courses found</h3>
                <p style={{ margin: 0 }}>Try searching with a different course code or keyword.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!selectedCourse}
        onClose={() => setSelectedCourse(null)}
        title={
          selectedCourse && (selectedCourse.enrolled_count || 0) >= selectedCourse.capacity
            ? 'Join Course Waitlist'
            : 'Confirm Enrollment Request'
        }
      >
        {selectedCourse && (
          <div>
            <div style={{ marginBottom: '1.25rem', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 0.75rem 0' }}>
                Course: <strong>{selectedCourse.course_code} - {selectedCourse.course_name}</strong>
              </p>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Schedule: {selectedCourse.schedule_days} from {selectedCourse.start_time} to {selectedCourse.end_time} in {selectedCourse.room} ({selectedCourse.credit} Credits).
              </p>

              {(selectedCourse.enrolled_count || 0) >= selectedCourse.capacity ? (
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem',
                  color: '#92400e',
                  fontSize: '0.88rem'
                }}>
                  <strong>⚠️ Course is currently at capacity:</strong>
                  <p style={{ margin: '0.25rem 0 0 0' }}>
                    This course has reached its {selectedCourse.capacity} student seat limit. You will be placed in the automatic waitlist queue. If any enrolled student drops this section, you will be automatically promoted to enrolled!
                  </p>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  This request will be submitted to the administration for seat reservation and priority review.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-outline" style={{ width: 'auto' }} onClick={() => setSelectedCourse(null)} disabled={isActionLoading}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ width: 'auto' }}
                onClick={handleEnroll}
                disabled={isActionLoading}
              >
                {isActionLoading
                  ? 'Processing...'
                  : (selectedCourse.enrolled_count || 0) >= selectedCourse.capacity
                  ? 'Confirm Waitlist Spot'
                  : 'Submit Enrollment Request'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentCourses;
