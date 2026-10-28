import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
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
}

interface Enrollment {
  id: number;
  course_id: number;
  status: string;
}

const StudentCourses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<Enrollment[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const toast = useContext(ToastContext);

  const fetchCatalogAndEnrollments = async () => {
    setIsPageLoading(true);
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
  }, []);

  const handleEnroll = async () => {
    if (!selectedCourse) return;
    setIsActionLoading(true);

    try {
      await api.post('/enrollments', { course_id: selectedCourse.id });
      toast?.showToast(`Enrollment request submitted for ${selectedCourse.course_code}!`, 'success');
      setSelectedCourse(null);
      fetchCatalogAndEnrollments();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Enrollment request failed', 'error');
      setSelectedCourse(null);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Course Catalog</h1>
        <p>Browse and request enrollment for available university courses.</p>
      </div>

      <div className="course-grid">
        {isPageLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            {courses.map(course => {
              const existing = myEnrollments.find(e => e.course_id === course.id);
              return (
                <div key={course.id} className="course-card">
                  <div className="badge-container">
                    <span className="badge badge-primary">{course.course_code}</span>
                    <span className="badge badge-success">{course.credit} Credits</span>
                    {existing && (
                      <span
                        className={`badge ${
                          existing.status === 'approved'
                            ? 'badge-success'
                            : existing.status === 'rejected'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                      >
                        {existing.status}
                      </span>
                    )}
                  </div>
                  <h3 className="course-title" style={{ margin: 0 }}>{course.course_name}</h3>
                  <p className="course-desc" style={{ flexGrow: 1, marginTop: '0.5rem', minHeight: '2.5rem' }}>
                    {course.description || 'No description provided.'}
                  </p>
                  <p className="course-desc" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '1rem' }}>
                    Capacity: {course.capacity} Students
                  </p>
                  <button
                    className="btn-primary"
                    style={{ width: '100%' }}
                    disabled={!!existing}
                    onClick={() => setSelectedCourse(course)}
                  >
                    {existing
                      ? existing.status === 'approved'
                        ? 'Enrolled'
                        : `Request ${existing.status.charAt(0).toUpperCase() + existing.status.slice(1)}`
                      : 'Request Enrollment'}
                  </button>
                </div>
              );
            })}
            {courses.length === 0 && (
              <div className="empty-state">
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No courses available</h3>
                <p style={{ margin: 0 }}>Check back later for new catalog updates.</p>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={!!selectedCourse}
        onClose={() => setSelectedCourse(null)}
        title="Confirm Enrollment Request"
      >
        {selectedCourse && (
          <div>
            <p style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Are you sure you want to request enrollment in{' '}
              <strong>{selectedCourse.course_code} - {selectedCourse.course_name}</strong>? This request will be sent to the administration for capacity and priority review.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-outline" style={{ width: 'auto' }} onClick={() => setSelectedCourse(null)} disabled={isActionLoading}>
                Cancel
              </button>
              <button className="btn-primary" style={{ width: 'auto' }} onClick={handleEnroll} disabled={isActionLoading}>
                {isActionLoading ? 'Processing...' : 'Confirm Request'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentCourses;