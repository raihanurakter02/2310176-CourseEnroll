import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
import SkeletonCard from '../components/SkeletonCard';
import { ToastContext } from '../ToastContext';

interface Enrollment {
  id: number;
  student_id: number;
  course_id: number;
  status: string;
  student?: { name: string; email: string };
  course?: { course_code: string; course_name: string; capacity: number };
}

const AdminApprovals: React.FC = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const toast = useContext(ToastContext);

  const fetchEnrollments = async () => {
    setIsPageLoading(true);
    try {
      const [enrollRes, usersRes, coursesRes] = await Promise.all([
        api.get('/enrollments'),
        api.get('/users'),
        api.get('/courses')
      ]);
      
      const enriched = enrollRes.data
        .filter((e: any) => e.status === 'pending')
        .map((e: any) => ({
          ...e,
          student: usersRes.data.find((u: any) => u.id === e.student_id),
          course: coursesRes.data.find((c: any) => c.id === e.course_id)
        }));
      setEnrollments(enriched);
    } catch {
      toast?.showToast('Failed to load pending requests', 'error');
    } finally {
      setIsPageLoading(false);
    }
  };

  useEffect(() => { fetchEnrollments(); }, []);

  const handleStatusUpdate = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await api.put(`/enrollments/${id}/status`, { status });
      toast?.showToast(`Enrollment ${status} successfully`, 'success');
      fetchEnrollments();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || `Failed to ${status} enrollment`, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Enrollment Approvals</h1>
        <p>Review and process pending student course registrations.</p>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <th style={{ padding: '1rem 1.5rem' }}>Student</th>
              <th style={{ padding: '1rem 1.5rem' }}>Course</th>
              <th style={{ padding: '1rem 1.5rem' }}>Status</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPageLoading ? (
              <tr><td colSpan={4} style={{ padding: '2rem' }}><SkeletonCard /></td></tr>
            ) : enrollments.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No pending requests.</td></tr>
            ) : (
              enrollments.map(enrollment => (
                <tr key={enrollment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1.25rem 1.5rem' }}>{enrollment.student?.name}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>{enrollment.course?.course_code} - {enrollment.course?.course_name}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}><span className="badge badge-warning">{enrollment.status}</span></td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn-primary" style={{ padding: '0.4rem 0.8rem', background: '#059669' }} onClick={() => handleStatusUpdate(enrollment.id, 'approved')}>Approve</button>
                    <button className="btn-outline" style={{ padding: '0.4rem 0.8rem', color: '#dc2626' }} onClick={() => handleStatusUpdate(enrollment.id, 'rejected')}>Reject</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminApprovals;