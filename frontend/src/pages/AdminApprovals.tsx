import React, { useEffect, useState, useContext, useMemo } from 'react';
import api, { getCachedData } from '../api';
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
  const cachedEnrollments = getCachedData<Enrollment[]>('/enrollments');
  const [enrollments, setEnrollments] = useState<Enrollment[]>(() => {
    if (!cachedEnrollments) return [];
    const cachedUsers = getCachedData<any[]>('/users') || [];
    const cachedCourses = getCachedData<any[]>('/courses') || [];
    return cachedEnrollments
      .filter((e: any) => e.status === 'pending')
      .map((e: any) => ({
        ...e,
        student: cachedUsers.find((u: any) => u.id === e.student_id),
        course: cachedCourses.find((c: any) => c.id === e.course_id)
      }));
  });
  const [isPageLoading, setIsPageLoading] = useState(() => !cachedEnrollments);
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const toast = useContext(ToastContext);

  const fetchEnrollments = async () => {
    if (!cachedEnrollments) {
      setIsPageLoading(true);
    }
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

  const uniqueCourses = useMemo(() => {
    const map = new Map<number, string>();
    enrollments.forEach(e => {
      if (e.course) map.set(e.course_id, e.course.course_code);
    });
    return Array.from(map.entries());
  }, [enrollments]);

  const filteredEnrollments = useMemo(() => {
    return enrollments.filter(e => {
      const q = searchQuery.toLowerCase().trim();
      const studentName = e.student?.name?.toLowerCase() || '';
      const studentEmail = e.student?.email?.toLowerCase() || '';
      const courseCode = e.course?.course_code?.toLowerCase() || '';
      const courseName = e.course?.course_name?.toLowerCase() || '';

      const matchesSearch = !q ||
        studentName.includes(q) ||
        studentEmail.includes(q) ||
        courseCode.includes(q) ||
        courseName.includes(q);

      const matchesCourse = courseFilter === 'all' || String(e.course_id) === courseFilter;
      return matchesSearch && matchesCourse;
    });
  }, [enrollments, searchQuery, courseFilter]);

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

      {/* Search & Filter Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
        background: 'var(--surface)',
        padding: '0.85rem 1.25rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, minWidth: '280px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
            <input
              type="text"
              placeholder="Search by student name, email, or course..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.4rem', width: '100%', borderRadius: 'var(--radius-md)' }}
            />
          </div>

          <select
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
            style={{ width: 'auto', padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-md)', minWidth: '140px' }}
          >
            <option value="all">All Courses</option>
            {uniqueCourses.map(([cid, code]) => (
              <option key={cid} value={String(cid)}>{code}</option>
            ))}
          </select>

          {(searchQuery || courseFilter !== 'all') && (
            <button
              className="btn-outline"
              style={{ width: 'auto', padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
              onClick={() => { setSearchQuery(''); setCourseFilter('all'); }}
            >
              Reset
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          Showing <strong>{filteredEnrollments.length}</strong> of {enrollments.length} pending
        </div>
      </div>

      <div className="table-scroll" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
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
            ) : filteredEnrollments.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📋</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>No matching pending requests</div>
                  <div style={{ fontSize: '0.875rem' }}>Try clearing filters or search keywords.</div>
                </td>
              </tr>
            ) : (
              filteredEnrollments.map(enrollment => (
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