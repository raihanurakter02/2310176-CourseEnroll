import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import SkeletonCard from '../components/SkeletonCard';
import { ToastContext } from '../ToastContext';

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  credit: number;
}

interface Enrollment {
  id: number;
  course_id: number;
  status: string;
  course?: Course; 
}

const StudentMyCourses: React.FC = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedDrop, setSelectedDrop] = useState<Enrollment | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const toast = useContext(ToastContext);

  const fetchData = () => {
    setIsPageLoading(true);
    setTimeout(async () => {
      try {
        const [enrollRes, courseRes] = await Promise.all([
          api.get('/enrollments/my'),
          api.get('/courses')
        ]);
        setEnrollments(enrollRes.data);
        setCourses(courseRes.data);
      } catch {
        toast?.showToast('Failed to load your enrollments', 'error');
      } finally {
        setIsPageLoading(false);
      }
    }, 600);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDropCourse = async () => {
    if (!selectedDrop) return;
    setIsActionLoading(true);
    
    try {
      await api.delete(`/enrollments/${selectedDrop.id}`);
      toast?.showToast('Course dropped successfully', 'success');
      setSelectedDrop(null);
      fetchData();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to drop course', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>My Enrollments</h1>
        <p>Manage your current academic schedule and active courses.</p>
      </div>

      <div className="course-grid">
        {isPageLoading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            {enrollments.map(enrollment => {
              const courseDetails = enrollment.course || courses.find(c => c.id === enrollment.course_id);
              if (!courseDetails) return null;

              return (
                <div key={enrollment.id} className="course-card">
                  <div className="badge-container">
                    <span className="badge badge-primary">{courseDetails.course_code}</span>
                    <span className={`badge ${enrollment.status === 'approved' ? 'badge-success' : enrollment.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                      {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
                    </span>
                  </div>
                  
                  <h3 className="course-title" style={{ margin: '0.5rem 0' }}>
                    {courseDetails.course_name}
                  </h3>
                  
                  <p className="course-desc">
                    Credits: <strong>{courseDetails.credit}</strong>
                  </p>
                  
                  <button 
                    className="btn-outline" 
                    style={{ marginTop: 'auto', color: 'var(--text-main)', borderColor: '#fca5a5' }}
                    onClick={() => setSelectedDrop(enrollment)}
                  >
                    Drop Course
                  </button>
                </div>
              );
            })}

            {enrollments.length === 0 && (
              <div className="empty-state">
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No Active Enrollments</h3>
                <p style={{ margin: 0 }}>You have not requested any courses yet. Visit the Course Catalog to apply.</p>
              </div>
            )}
          </>
        )}
      </div>

      <Modal 
        isOpen={!!selectedDrop} 
        onClose={() => setSelectedDrop(null)} 
        title="Confirm Drop"
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ marginBottom: '1.5rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
            Are you sure you want to drop this course? This action will remove it from your active schedule immediately.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => setSelectedDrop(null)} disabled={isActionLoading}>Cancel</button>
            <button className="btn-primary" style={{ background: '#ef4444' }} onClick={handleDropCourse} disabled={isActionLoading}>
              {isActionLoading ? 'Processing...' : 'Confirm Drop'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudentMyCourses;