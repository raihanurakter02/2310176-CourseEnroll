import React, { useEffect, useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import SkeletonCard from '../components/SkeletonCard';
import { ToastContext } from '../ToastContext';

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  credit: number;
  schedule_days?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
}

interface Enrollment {
  id: number;
  course_id: number;
  status: string;
  grade?: string | null;
  course?: Course; 
}

type FilterTab = 'all' | 'approved' | 'waitlisted' | 'pending' | 'rejected';

const StudentMyCourses: React.FC = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedAction, setSelectedAction] = useState<Enrollment | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  const toast = useContext(ToastContext);
  const navigate = useNavigate();

  const fetchData = async () => {
    setIsPageLoading(true);
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
  };

  useEffect(() => {
    fetchData();
    const handleRefresh = () => fetchData();
    window.addEventListener('enrollments:refresh', handleRefresh);
    return () => window.removeEventListener('enrollments:refresh', handleRefresh);
  }, []);

  const counts = useMemo(() => ({
    all: enrollments.length,
    approved: enrollments.filter(e => e.status === 'approved').length,
    waitlisted: enrollments.filter(e => e.status === 'waitlisted').length,
    pending: enrollments.filter(e => e.status === 'pending').length,
    rejected: enrollments.filter(e => e.status === 'rejected').length,
  }), [enrollments]);

  const filteredEnrollments = useMemo(() => {
    if (activeFilter === 'all') return enrollments;
    return enrollments.filter(e => e.status === activeFilter);
  }, [enrollments, activeFilter]);

  const handleAction = async () => {
    if (!selectedAction) return;
    setIsActionLoading(true);
    
    const isRejected = selectedAction.status === 'rejected';
    const isPending = selectedAction.status === 'pending';
    const isWaitlisted = selectedAction.status === 'waitlisted';
    
    try {
      await api.delete(`/enrollments/${selectedAction.id}`);
      if (isRejected) {
        toast?.showToast('Rejected request dismissed from your schedule', 'info');
      } else if (isWaitlisted) {
        toast?.showToast('Removed from waitlist queue', 'info');
      } else if (isPending) {
        toast?.showToast('Enrollment request cancelled', 'info');
      } else {
        toast?.showToast('Course dropped successfully', 'success');
      }
      setSelectedAction(null);
      fetchData();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Action failed', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const selectedCourseDetails = selectedAction 
    ? (selectedAction.course || courses.find(c => c.id === selectedAction.course_id)) 
    : null;

  return (
    <div className="page-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>My Enrollments</h1>
          <p>Manage your current academic schedule, active classes, waitlist positions, and registration requests.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-outline" style={{ width: 'auto' }} onClick={() => navigate('/student/schedule')}>
            📅 View Schedule Matrix
          </button>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/student/courses')}>
            + Enroll More Courses
          </button>
        </div>
      </div>

      {/* Rejection Notice Banner */}
      {counts.rejected > 0 && activeFilter === 'all' && (
        <div style={{
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
            <div>
              <strong style={{ color: '#9f1239', fontSize: '0.9rem' }}>Notice: You have {counts.rejected} declined course request{counts.rejected > 1 ? 's' : ''}</strong>
              <p style={{ margin: '0.1rem 0 0 0', color: '#be123c', fontSize: '0.82rem' }}>
                You can dismiss declined records below or filter by "Rejected" to clear them.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveFilter('rejected')}
            style={{
              background: '#f43f5e',
              color: '#fff',
              border: 'none',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Review Rejected ({counts.rejected})
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '2px solid var(--border)',
        marginBottom: '1.75rem',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {[
          { key: 'all', label: 'All Records', count: counts.all },
          { key: 'approved', label: 'Enrolled (Active)', count: counts.approved },
          { key: 'waitlisted', label: 'Waitlisted', count: counts.waitlisted },
          { key: 'pending', label: 'Pending Review', count: counts.pending },
          { key: 'rejected', label: 'Rejected', count: counts.rejected },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key as FilterTab)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeFilter === tab.key ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              marginBottom: '-2px',
              padding: '0.6rem 0.9rem',
              fontFamily: 'Inter, sans-serif',
              fontWeight: activeFilter === tab.key ? 700 : 500,
              fontSize: '0.875rem',
              color: activeFilter === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'color 0.15s, border-color 0.15s'
            }}
          >
            <span>{tab.label}</span>
            <span style={{
              background: activeFilter === tab.key ? 'var(--focus-yellow)' : '#f1f5f9',
              color: activeFilter === tab.key ? 'var(--text-main)' : 'var(--text-muted)',
              borderRadius: '12px',
              padding: '0.1rem 0.45rem',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="course-grid">
        {isPageLoading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            {filteredEnrollments.map(enrollment => {
              const courseDetails = enrollment.course || courses.find(c => c.id === enrollment.course_id);
              if (!courseDetails) return null;

              const isApproved = enrollment.status === 'approved';
              const isRejected = enrollment.status === 'rejected';
              const isWaitlisted = enrollment.status === 'waitlisted';
              const isPending = enrollment.status === 'pending';

              return (
                <div 
                  key={enrollment.id} 
                  className="course-card"
                  style={{
                    borderLeft: isRejected 
                      ? '4px solid #ef4444' 
                      : isApproved 
                      ? '4px solid #10b981' 
                      : isWaitlisted 
                      ? '4px solid #f59e0b' 
                      : '4px solid #3b82f6',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div className="badge-container" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-primary">{courseDetails.course_code}</span>
                    <span className={`badge ${
                      isApproved 
                        ? 'badge-success' 
                        : isRejected 
                        ? 'badge-danger' 
                        : 'badge-warning'
                    }`}>
                      {isApproved ? 'Enrolled' : isWaitlisted ? '⏳ Waitlisted' : isRejected ? 'Declined' : 'Pending'}
                    </span>
                  </div>
                  
                  <h3 className="course-title" style={{ margin: '0.5rem 0' }}>
                    {courseDetails.course_name}
                  </h3>
                  
                  <p className="course-desc" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    Credits: <strong>{courseDetails.credit}</strong>
                    {enrollment.grade && (
                      <span style={{ marginLeft: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>
                        • Grade: {enrollment.grade}
                      </span>
                    )}
                  </p>

                  {/* Schedule Details */}
                  {courseDetails.schedule_days && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      📅 {courseDetails.schedule_days} • ⏰ {courseDetails.start_time} - {courseDetails.end_time} • 📍 {courseDetails.room}
                    </div>
                  )}

                  {isWaitlisted && (
                    <div style={{
                      background: '#fffbeb',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8rem',
                      color: '#92400e',
                      marginBottom: '1rem',
                      border: '1px solid #fde68a'
                    }}>
                      ⏳ <strong>Waitlist Active:</strong> You are queued for this full class. If an approved student drops, you will be automatically enrolled!
                    </div>
                  )}

                  {isRejected && (
                    <div style={{
                      background: '#fff1f2',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8rem',
                      color: '#9f1239',
                      marginBottom: '1rem'
                    }}>
                      ⚠️ Application was not approved. Dismiss this card to keep your schedule organized.
                    </div>
                  )}

                  {isPending && (
                    <div style={{
                      background: '#eff6ff',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8rem',
                      color: '#1e40af',
                      marginBottom: '1rem'
                    }}>
                      ⏳ Awaiting administrator approval.
                    </div>
                  )}
                  
                  <button 
                    className="btn-outline" 
                    style={{ 
                      marginTop: 'auto', 
                      color: isRejected ? '#9f1239' : isWaitlisted ? '#92400e' : isPending ? '#475569' : '#dc2626',
                      borderColor: isRejected ? '#fca5a5' : isWaitlisted ? '#fde68a' : isPending ? 'var(--border)' : '#fca5a5' 
                    }}
                    onClick={() => setSelectedAction(enrollment)}
                  >
                    {isApproved 
                      ? 'Drop Course' 
                      : isWaitlisted 
                      ? 'Leave Waitlist' 
                      : isPending 
                      ? 'Cancel Request' 
                      : '✕ Dismiss Record'}
                  </button>
                </div>
              );
            })}

            {filteredEnrollments.length === 0 && (
              <div className="empty-state">
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
                  {activeFilter === 'rejected' ? 'No Rejected Enrollments' :
                   activeFilter === 'waitlisted' ? 'No Courses on Waitlist' :
                   activeFilter === 'approved' ? 'No Active Approved Classes' :
                   activeFilter === 'pending' ? 'No Pending Requests' : 'No Enrollments Found'}
                </h3>
                <p style={{ margin: '0 0 1.25rem 0' }}>
                  {activeFilter === 'all' 
                    ? 'You have not registered for any courses yet.' 
                    : `You do not have any courses in the ${activeFilter} state.`}
                </p>
                <button className="btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/student/courses')}>
                  Explore Course Catalog
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal 
        isOpen={!!selectedAction} 
        onClose={() => setSelectedAction(null)} 
        title={
          selectedAction?.status === 'rejected' ? 'Dismiss Rejected Request' :
          selectedAction?.status === 'waitlisted' ? 'Leave Waitlist Queue' :
          selectedAction?.status === 'pending' ? 'Cancel Application Request' : 'Confirm Course Drop'
        }
        size="sm"
      >
        <div style={{ padding: '0.25rem 0' }}>
          <p style={{ marginBottom: '1.5rem', lineHeight: '1.6', color: 'var(--text-main)', fontSize: '0.9rem' }}>
            {selectedAction?.status === 'rejected' ? (
              <>Are you sure you want to dismiss the rejected request for <strong>{selectedCourseDetails?.course_code} - {selectedCourseDetails?.course_name}</strong>? It will be removed from your list.</>
            ) : selectedAction?.status === 'waitlisted' ? (
              <>Are you sure you want to give up your waitlist spot for <strong>{selectedCourseDetails?.course_code} - {selectedCourseDetails?.course_name}</strong>? You will lose your priority queue position.</>
            ) : selectedAction?.status === 'pending' ? (
              <>Cancel your pending application request for <strong>{selectedCourseDetails?.course_code} - {selectedCourseDetails?.course_name}</strong>? You can apply again anytime.</>
            ) : (
              <>Are you sure you want to drop <strong>{selectedCourseDetails?.course_code} - {selectedCourseDetails?.course_name}</strong>? This action will remove it from your active class schedule.</>
            )}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button 
              className="btn-outline" 
              style={{ width: 'auto' }} 
              onClick={() => setSelectedAction(null)}
              disabled={isActionLoading}
            >
              Back
            </button>
            <button 
              className="btn-primary" 
              style={{ 
                width: 'auto', 
                background: selectedAction?.status === 'rejected' ? '#64748b' : selectedAction?.status === 'waitlisted' ? '#d97706' : '#dc2626',
                borderColor: selectedAction?.status === 'rejected' ? '#64748b' : selectedAction?.status === 'waitlisted' ? '#d97706' : '#dc2626'
              }} 
              onClick={handleAction}
              disabled={isActionLoading}
            >
              {isActionLoading ? 'Processing...' : 
               selectedAction?.status === 'rejected' ? 'Dismiss' :
               selectedAction?.status === 'waitlisted' ? 'Leave Waitlist' :
               selectedAction?.status === 'pending' ? 'Cancel Request' : 'Drop Course'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudentMyCourses;
