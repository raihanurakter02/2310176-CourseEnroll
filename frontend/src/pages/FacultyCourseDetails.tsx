import React, { useEffect, useState, useContext, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { ToastContext } from '../ToastContext';

interface Enrollment {
  id: number;
  student_id: number;
  grade: string | null;
  student: {
    name: string;
    email: string;
  };
}

interface ClassSession {
  id: number;
  date: string;
  topic: string | null;
}

interface AttendanceRecord {
  id: number;
  enrollment_id: number;
  session: ClassSession;
  status: 'present' | 'absent' | 'late';
}

const FacultyCourseDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'roster' | 'attendance' | 'report'>('roster');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Grading state
  const [gradingStudent, setGradingStudent] = useState<Enrollment | null>(null);
  const [selectedGrade, setSelectedGrade] = useState('A');
  
  // Attendance taking state
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [attendanceRecords, setAttendanceRecords] = useState<Record<number, string>>({});
  
  // New session modal
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionData, setNewSessionData] = useState({
    date: new Date().toISOString().slice(0, 16),
    topic: '',
  });

  // History & reporting
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [historyStudent, setHistoryStudent] = useState<Enrollment | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  const toast = useContext(ToastContext);
  const navigate = useNavigate();

  const filteredEnrollments = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    if (!q) return enrollments;
    return enrollments.filter(e =>
      e.student.name.toLowerCase().includes(q) ||
      e.student.email.toLowerCase().includes(q)
    );
  }, [enrollments, studentSearch]);

  const fetchRosterAndSessions = () => {
    setIsLoading(true);
    Promise.all([
      api.get(`/faculty/courses/${id}/roster`),
      api.get(`/courses/${id}/sessions`)
    ]).then(([rosterRes, sessionRes]) => {
      setEnrollments(rosterRes.data || []);
      setSessions(sessionRes.data || []);
      if (sessionRes.data && sessionRes.data.length > 0) {
        setSelectedSessionId(sessionRes.data[0].id);
      }
    }).catch(() => toast?.showToast('Failed to load course data', 'error'))
      .finally(() => setIsLoading(false));
  };

  const fetchSessionAttendance = () => {
    if (!selectedSessionId || enrollments.length === 0) return;
    api.get(`/faculty/courses/${id}/attendance?session_id=${selectedSessionId}`)
      .then(res => {
        const records: Record<number, string> = {};
        enrollments.forEach(e => { records[e.id] = 'present'; });
        res.data.forEach((att: any) => { records[att.enrollment_id] = att.status; });
        setAttendanceRecords(records);
      })
      .catch(() => toast?.showToast('Failed to load attendance', 'error'));
  };

  const fetchAttendanceHistory = () => {
    api.get(`/faculty/courses/${id}/attendance/history`)
      .then(res => setAttendanceHistory(res.data || []))
      .catch(() => toast?.showToast('Failed to load attendance history', 'error'));
  };

  useEffect(() => { fetchRosterAndSessions(); }, [id]);
  
  useEffect(() => {
    if (activeTab === 'attendance') fetchSessionAttendance();
    else if (activeTab === 'report') fetchAttendanceHistory();
  }, [activeTab, selectedSessionId, enrollments.length]);

  // Bulk actions for attendance taking
  const markAllStatus = (status: 'present' | 'late' | 'absent') => {
    const updated: Record<number, string> = {};
    enrollments.forEach(e => { updated[e.id] = status; });
    setAttendanceRecords(updated);
  };

  // Compute live current session stats
  const currentSessionStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    const total = enrollments.length;

    enrollments.forEach(e => {
      const st = attendanceRecords[e.id] || 'present';
      if (st === 'present') present++;
      else if (st === 'late') late++;
      else if (st === 'absent') absent++;
    });

    const rate = total > 0 ? Math.round(((present + (late * 0.5)) / total) * 100) : 0;
    return { present, late, absent, total, rate };
  }, [enrollments, attendanceRecords]);

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingStudent) return;
    setIsActionLoading(true);
    try {
      await api.put(`/enrollments/${gradingStudent.id}/grade`, { grade: selectedGrade });
      toast?.showToast(`Grade assigned successfully`, 'success');
      setGradingStudent(null);
      fetchRosterAndSessions();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Grading failed. Ensure grading window is open.', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAttendanceSubmit = async () => {
    if (!selectedSessionId) return toast?.showToast('Please select a scheduled class session', 'error');
    setIsActionLoading(true);
    
    const records = Object.entries(attendanceRecords).map(([enrollment_id, status]) => ({ 
      enrollment_id: parseInt(enrollment_id), 
      status 
    }));

    try {
      await api.post(`/faculty/courses/${id}/attendance`, { class_session_id: selectedSessionId, records });
      toast?.showToast('Attendance saved successfully for this session', 'success');
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to save attendance', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionData.date) return toast?.showToast('Please specify session date and time', 'error');
    setIsActionLoading(true);
    try {
      const res = await api.post(`/courses/${id}/sessions`, newSessionData);
      toast?.showToast('Class session scheduled successfully', 'success');
      setIsNewSessionModalOpen(false);
      setNewSessionData({ date: new Date().toISOString().slice(0, 16), topic: '' });
      const updatedSessions = [...sessions, res.data];
      setSessions(updatedSessions);
      setSelectedSessionId(res.data.id);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to create session', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const exportAttendanceCSV = () => {
    if (enrollments.length === 0) return toast?.showToast('No roster data to export', 'info');
    
    const headers = ['Student ID', 'Student Name', 'Email', 'Present Count', 'Late Count', 'Absent Count', 'Total Sessions', 'Attendance %'];
    const rows = enrollments.map(e => {
      const stats = getStudentStats(e.id);
      return [
        e.student_id,
        `"${e.student.name.replace(/"/g, '""')}"`,
        e.student.email,
        stats.present,
        stats.late,
        stats.absent,
        stats.total,
        `${stats.percentage}%`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_Course_${id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast?.showToast('Attendance report exported to CSV', 'success');
  };

  const getStudentStats = (enrollmentId: number) => {
    const records = attendanceHistory.filter(r => r.enrollment_id === enrollmentId);
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const total = records.length;
    const percentage = total === 0 ? 0 : Math.round(((present + (late * 0.5)) / total) * 100);
    return { present, late, absent, total, percentage, records };
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading course data...</div>;

  return (
    <div className="page-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Class Management Portal</h1>
          <p>Oversee your class roster, submit grades, schedule sessions, and take daily attendance.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-outline" style={{ width: 'auto' }} onClick={() => navigate('/faculty/courses')}>
            ← Back to Classes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--border)', paddingBottom: '0.75rem' }}>
        <button 
          className={`btn-outline ${activeTab === 'roster' ? 'active' : ''}`} 
          style={{ width: 'auto', border: 'none', background: activeTab === 'roster' ? 'var(--accent-yellow)' : 'transparent', color: 'var(--text-main)', fontWeight: activeTab === 'roster' ? 700 : 500 }} 
          onClick={() => setActiveTab('roster')}
        >
          👥 Roster & Grading ({enrollments.length})
        </button>
        <button 
          className={`btn-outline ${activeTab === 'attendance' ? 'active' : ''}`} 
          style={{ width: 'auto', border: 'none', background: activeTab === 'attendance' ? 'var(--accent-yellow)' : 'transparent', color: 'var(--text-main)', fontWeight: activeTab === 'attendance' ? 700 : 500 }} 
          onClick={() => setActiveTab('attendance')}
        >
          📋 Session Attendance
        </button>
        <button 
          className={`btn-outline ${activeTab === 'report' ? 'active' : ''}`} 
          style={{ width: 'auto', border: 'none', background: activeTab === 'report' ? 'var(--accent-yellow)' : 'transparent', color: 'var(--text-main)', fontWeight: activeTab === 'report' ? 700 : 500 }} 
          onClick={() => setActiveTab('report')}
        >
          📊 Attendance Report & Analytics
        </button>
      </div>

      {/* Quick Search Toolbar for Enrolled Students */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--surface)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px', position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Search enrolled student by name or email..."
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
          />
        </div>
        {studentSearch && (
          <button 
            type="button" 
            className="btn-outline" 
            style={{ width: 'auto', padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
            onClick={() => setStudentSearch('')}
          >
            ✕ Clear
          </button>
        )}
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Showing <strong>{filteredEnrollments.length}</strong> of {enrollments.length} students
        </span>
      </div>

      {/* TAB 1: ROSTER & GRADING */}
      {activeTab === 'roster' && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1.5px solid var(--border)' }}>
                <th style={{ padding: '1rem 1.5rem' }}>Student Name</th>
                <th style={{ padding: '1rem 1.5rem' }}>Email Address</th>
                <th style={{ padding: '1rem 1.5rem' }}>Current Grade</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnrollments.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>{studentSearch ? 'No students match your search filter.' : 'No students enrolled in this course section yet.'}</td></tr>
              ) : (
                filteredEnrollments.map(enrollment => (
                  <tr key={enrollment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>{enrollment.student.name}</td>
                    <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)' }}>{enrollment.student.email}</td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      {enrollment.grade ? <span className="badge badge-success">Grade: {enrollment.grade}</span> : <span className="badge badge-warning">Pending</span>}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <button className="btn-outline" style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setGradingStudent(enrollment)}>
                        Evaluate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: ATTENDANCE TAKING */}
      {activeTab === 'attendance' && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          {/* Top Session Selector & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-main)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 360px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  Select Scheduled Class Session:
                </label>
                <select 
                  value={selectedSessionId} 
                  onChange={e => setSelectedSessionId(Number(e.target.value))} 
                  style={{ width: '100%', cursor: 'pointer', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                >
                  {sessions.length === 0 ? (
                    <option value="">No sessions scheduled yet</option>
                  ) : (
                    sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.date).toLocaleDateString()} {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {s.topic ? `- ${s.topic}` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button 
                type="button"
                className="btn-outline" 
                style={{ width: 'auto', marginTop: '1.4rem', whiteSpace: 'nowrap' }}
                onClick={() => setIsNewSessionModalOpen(true)}
              >
                + New Session
              </button>
            </div>

            <button 
              type="button"
              className="btn-primary" 
              style={{ width: 'auto', minWidth: '180px' }} 
              onClick={handleAttendanceSubmit} 
              disabled={isActionLoading || !selectedSessionId}
            >
              {isActionLoading ? 'Saving...' : '💾 Save Attendance'}
            </button>
          </div>

          {/* Quick Mark Toolbar & Live Counters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Quick Actions:</span>
              <button type="button" className="btn-outline" style={{ width: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.78rem' }} onClick={() => markAllStatus('present')}>
                ✅ Mark All Present
              </button>
              <button type="button" className="btn-outline" style={{ width: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.78rem' }} onClick={() => markAllStatus('late')}>
                ⚠️ Mark All Late
              </button>
              <button type="button" className="btn-outline" style={{ width: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.78rem' }} onClick={() => markAllStatus('absent')}>
                ❌ Mark All Absent
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600 }}>Total: {currentSessionStats.total}</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>🟢 Present: {currentSessionStats.present}</span>
              <span style={{ color: '#d97706', fontWeight: 600 }}>🟡 Late: {currentSessionStats.late}</span>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>🔴 Absent: {currentSessionStats.absent}</span>
              <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>Rate: {currentSessionStats.rate}%</span>
            </div>
          </div>

          {/* Attendance Table */}
          {sessions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No class sessions scheduled yet. Click <strong>"+ New Session"</strong> above to schedule today's lecture.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1.5px solid var(--border)' }}>
                  <th style={{ padding: '1rem' }}>Student Name</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Present (1.0)</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Late (0.5)</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Absent (0.0)</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnrollments.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{studentSearch ? 'No students match your search filter.' : 'No students found.'}</td></tr>
                ) : (
                  filteredEnrollments.map(enrollment => {
                    const currentStatus = attendanceRecords[enrollment.id] || 'present';
                    return (
                      <tr key={enrollment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem', fontWeight: 700 }}>
                          {enrollment.student.name}
                          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>{enrollment.student.email}</span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setAttendanceRecords(p => ({ ...p, [enrollment.id]: 'present' }))}>
                          <input type="radio" name={`att-${enrollment.id}`} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} checked={currentStatus === 'present'} onChange={() => setAttendanceRecords(p => ({ ...p, [enrollment.id]: 'present' }))} />
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setAttendanceRecords(p => ({ ...p, [enrollment.id]: 'late' }))}>
                          <input type="radio" name={`att-${enrollment.id}`} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} checked={currentStatus === 'late'} onChange={() => setAttendanceRecords(p => ({ ...p, [enrollment.id]: 'late' }))} />
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setAttendanceRecords(p => ({ ...p, [enrollment.id]: 'absent' }))}>
                          <input type="radio" name={`att-${enrollment.id}`} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} checked={currentStatus === 'absent'} onChange={() => setAttendanceRecords(p => ({ ...p, [enrollment.id]: 'absent' }))} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 3: ATTENDANCE REPORT & ANALYTICS */}
      {activeTab === 'report' && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Cumulative Semester Attendance Record</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Aggregated attendance statistics across all completed class sessions.</p>
            </div>
            <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={exportAttendanceCSV}>
              📥 Export to CSV
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1.5px solid var(--border)' }}>
                <th style={{ padding: '1rem 1.5rem' }}>Student Name</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Present</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Late</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Absent</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Attendance %</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnrollments.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{studentSearch ? 'No students match your search filter.' : 'No student records available.'}</td></tr>
              ) : (
                filteredEnrollments.map(enroll => {
                  const stats = getStudentStats(enroll.id);
                  return (
                    <tr key={enroll.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>
                        {enroll.student.name}
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>{enroll.student.email}</span>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{stats.present}</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>{stats.late}</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{stats.absent}</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <span className={`badge ${stats.percentage >= 80 ? 'badge-success' : stats.percentage >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                          {stats.total > 0 ? `${stats.percentage}%` : 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                        <button className="btn-outline" style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setHistoryStudent(enroll)}>
                          View History
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Grading Modal */}
      <Modal isOpen={!!gradingStudent} onClose={() => setGradingStudent(null)} title="Evaluate Student">
        <form onSubmit={handleGradeSubmit}>
          <p style={{ marginBottom: '1rem' }}>Assigning final grade for <strong>{gradingStudent?.student.name}</strong>.</p>
          <div className="form-group">
            <label>Select Official Grade</label>
            <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)} style={{ cursor: 'pointer' }}>
              <option value="A">A</option><option value="A-">A-</option><option value="B+">B+</option>
              <option value="B">B</option><option value="B-">B-</option><option value="C+">C+</option>
              <option value="C">C</option><option value="D">D</option><option value="F">F</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setGradingStudent(null)} disabled={isActionLoading}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={isActionLoading}>{isActionLoading ? 'Saving...' : 'Submit Grade'}</button>
          </div>
        </form>
      </Modal>

      {/* Create New Session Modal */}
      <Modal isOpen={isNewSessionModalOpen} onClose={() => setIsNewSessionModalOpen(false)} title="Schedule New Class Session">
        <form onSubmit={handleCreateSession}>
          <div className="form-group">
            <label>Session Date & Time</label>
            <input 
              type="datetime-local" 
              required
              value={newSessionData.date}
              onChange={e => setNewSessionData({ ...newSessionData, date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Lecture Topic / Agenda</label>
            <input 
              type="text" 
              placeholder="e.g., Chapter 4: Relational Algebra & Query Optimization"
              value={newSessionData.topic}
              onChange={e => setNewSessionData({ ...newSessionData, topic: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setIsNewSessionModalOpen(false)} disabled={isActionLoading}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={isActionLoading}>{isActionLoading ? 'Scheduling...' : 'Schedule Session'}</button>
          </div>
        </form>
      </Modal>

      {/* Historical Attendance Modal */}
      <Modal isOpen={!!historyStudent} onClose={() => setHistoryStudent(null)} title="Student Attendance Record">
        {historyStudent && (() => {
          const stats = getStudentStats(historyStudent.id);
          return (
            <div>
              <p style={{ marginBottom: '1rem' }}>Historical attendance record for <strong>{historyStudent.student.name}</strong>.</p>
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Session Date</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Topic</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.records.length > 0 ? stats.records.map(record => (
                      <tr key={record.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{new Date(record.session?.date).toLocaleDateString()}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{record.session?.topic || '--'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}><span className={`badge ${record.status === 'present' ? 'badge-success' : record.status === 'late' ? 'badge-warning' : 'badge-danger'}`}>{record.status}</span></td>
                      </tr>
                    )) : <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No attendance recorded.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default FacultyCourseDetails;