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
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'waitlist'>('all');
  const [creditFilter, setCreditFilter] = useState<string>('all');
  
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
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      c.course_code.toLowerCase().includes(q) ||
      c.course_name.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.room && c.room.toLowerCase().includes(q))
    );

    const isFull = (c.enrolled_count || 0) >= c.capacity;
    const matchesAvailability =
      availabilityFilter === 'all' ||
      (availabilityFilter === 'available' && !isFull) ||
      (availabilityFilter === 'waitlist' && isFull);

    const matchesCredit =
      creditFilter === 'all' || c.credit.toString() === creditFilter;

    return matchesSearch && matchesAvailability && matchesCredit;
  });

  return (
    <div className="page-fade-in">
      <div className="page-header">
        <h1>Course Catalog</h1>
        <p>Browse available university courses, review weekly schedules, and request registration or join the waitlist.</p>
      </div>

      {/* Search and Filters Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--surface)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Search course code, title, topic or room..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.9rem', margin: 0 }}
          />
        </div>

        <select
          value={availabilityFilter}
          onChange={e => setAvailabilityFilter(e.target.value as any)}
          style={{ width: 'auto', minWidth: '150px', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.875rem', margin: 0, cursor: 'pointer' }}
        >
          <option value="all">All Availability</option>
          <option value="available">🟢 Seats Available</option>
          <option value="waitlist">⏳ Waitlist Only</option>
        </select>

        <select
          value={creditFilter}
          onChange={e => setCreditFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '120px', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.875rem', margin: 0, cursor: 'pointer' }}
        >
          <option value="all">All Credits</option>
          <option value="1">1 Credit</option>
          <option value="2">2 Credits</option>
          <option value="3">3 Credits</option>
          <option value="4">4 Credits</option>
        </select>

        {(searchQuery || availabilityFilter !== 'all' || creditFilter !== 'all') && (
          <button
            type="button"
            className="btn-outline"
            style={{ width: 'auto', padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
            onClick={() => {
              setSearchQuery('');
              setAvailabilityFilter('all');
              setCreditFilter('all');
            }}
          >
            ✕ Reset
          </button>
        )}

        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          Showing <strong>{filteredCourses.length}</strong> of {courses.length} courses
        </span>
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
                <p style={{ margin: '0 0 1rem 0' }}>No courses match your current search and filter criteria.</p>
                {(searchQuery || availabilityFilter !== 'all' || creditFilter !== 'all') && (
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ width: 'auto' }}
                    onClick={() => {
                      setSearchQuery('');
                      setAvailabilityFilter('all');
                      setCreditFilter('all');
                    }}
                  >
                    Clear All Filters
                  </button>
                )}
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
