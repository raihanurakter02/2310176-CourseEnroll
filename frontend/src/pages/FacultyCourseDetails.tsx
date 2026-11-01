import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { ToastContext } from '../ToastContext';

interface Enrollment { id: number; student_id: number; grade: string | null; student: { name: string; email: string; }; }
interface ClassSession { id: number; date: string; topic: string | null; }
interface AttendanceRecord { id: number; enrollment_id: number; session: ClassSession; status: 'present' | 'absent' | 'late'; }

const FacultyCourseDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'roster' | 'attendance' | 'report'>('roster');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Grading State
  const [gradingStudent, setGradingStudent] = useState<Enrollment | null>(null);
  const [selectedGrade, setSelectedGrade] = useState('A');
  
  // Attendance State
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [attendanceRecords, setAttendanceRecords] = useState<Record<number, string>>({});
  
  // Report State
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [historyStudent, setHistoryStudent] = useState<Enrollment | null>(null);

  const toast = useContext(ToastContext);
  const navigate = useNavigate();

  const fetchRosterAndSessions = () => {
    setIsLoading(true);
    Promise.all([
      api.get(`/faculty/courses/${id}/roster`),
      api.get(`/courses/${id}/sessions`)
    ]).then(([rosterRes, sessionRes]) => {
      setEnrollments(rosterRes.data);
      setSessions(sessionRes.data);
      if (sessionRes.data.length > 0) setSelectedSessionId(sessionRes.data[0].id);
    }).catch(() => toast?.showToast('Failed to load course data', 'error'))
      .finally(() => setIsLoading(false));
  };

  const fetchSessionAttendance = () => {
    if (!selectedSessionId || enrollments.length === 0) return;
    api.get(`/faculty/courses/${id}/attendance?session_id=${selectedSessionId}`)
      .then(res => {
        const records: Record<number, string> = {};
        // Default everyone to present so submissions don't fail if unchanged
        enrollments.forEach(e => { records[e.id] = 'present'; });
        // Override with actual data from DB
        res.data.forEach((att: any) => { records[att.enrollment_id] = att.status; });
        setAttendanceRecords(records);
      })
      .catch(() => toast?.showToast('Failed to load attendance', 'error'));
  };

  const fetchAttendanceHistory = () => {
    api.get(`/faculty/courses/${id}/attendance/history`)
      .then(res => setAttendanceHistory(res.data))
      .catch(() => toast?.showToast('Failed to load attendance history', 'error'));
  };

  useEffect(() => { fetchRosterAndSessions(); }, [id]);
  
  useEffect(() => {
    if (activeTab === 'attendance') fetchSessionAttendance();
    else if (activeTab === 'report') fetchAttendanceHistory();
  }, [activeTab, selectedSessionId, enrollments.length]);

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
      toast?.showToast('Attendance saved for this session', 'success');
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to save attendance', 'error');
    } finally {
      setIsActionLoading(false);
    }
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

  const handleDateClick = (e: React.MouseEvent<HTMLInputElement>) => {
    try { (e.target as HTMLInputElement).showPicker(); } catch {}
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: '4rem' }}>Loading course data...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Course Management</h1>
          <p>Oversee your class roster, submit grades, and track official attendance.</p>
        </div>
        <button className="btn-outline" style={{ width: 'auto' }} onClick={() => navigate('/faculty/courses')}>← Back to Classes</button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '0.75rem' }}>
        <button className={`btn-outline ${activeTab === 'roster' ? 'active' : ''}`} style={{ width: 'auto', border: 'none', background: activeTab === 'roster' ? 'var(--accent-yellow)' : 'transparent', color: 'var(--text-main)' }} onClick={() => setActiveTab('roster')}>Roster & Grading</button>
        <button className={`btn-outline ${activeTab === 'attendance' ? 'active' : ''}`} style={{ width: 'auto', border: 'none', background: activeTab === 'attendance' ? 'var(--accent-yellow)' : 'transparent', color: 'var(--text-main)' }} onClick={() => setActiveTab('attendance')}>Session Attendance</button>
        <button className={`btn-outline ${activeTab === 'report' ? 'active' : ''}`} style={{ width: 'auto', border: 'none', background: activeTab === 'report' ? 'var(--accent-yellow)' : 'transparent', color: 'var(--text-main)' }} onClick={() => setActiveTab('report')}>Attendance Report</button>
      </div>

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
              {enrollments.map(enrollment => (
                <tr key={enrollment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>{enrollment.student.name}</td>
                  <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)' }}>{enrollment.student.email}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {enrollment.grade ? <span className="badge badge-success">Grade: {enrollment.grade}</span> : <span className="badge badge-warning">Pending</span>}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                    <button className="btn-outline" style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setGradingStudent(enrollment)}>Evaluate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          {sessions.length === 0 ? (
             <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>The Administrator has not scheduled any class sessions for this course yet.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: '400px' }}>
                  <label>Select Official Class Session:</label>
                  <select value={selectedSessionId} onChange={e => setSelectedSessionId(Number(e.target.value))} style={{ cursor: 'pointer' }}>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{new Date(s.date).toLocaleString()} {s.topic ? `- ${s.topic}` : ''}</option>
                    ))}
                  </select>
                </div>
                <button className="btn-primary" style={{ width: 'auto' }} onClick={handleAttendanceSubmit} disabled={isActionLoading}>
                  {isActionLoading ? 'Saving...' : 'Save Session Attendance'}
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1.5px solid var(--border)' }}>
                    <th style={{ padding: '1rem' }}>Student</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Present</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Late</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(enrollment => (
                    <tr key={enrollment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 700 }}>{enrollment.student.name}</td>
                      <td style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setAttendanceRecords(p => ({ ...p, [enrollment.id]: 'present' }))}>
                        <input type="radio" style={{ cursor: 'pointer' }} checked={attendanceRecords[enrollment.id] === 'present'} readOnly />
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setAttendanceRecords(p => ({ ...p, [enrollment.id]: 'late' }))}>
                        <input type="radio" style={{ cursor: 'pointer' }} checked={attendanceRecords[enrollment.id] === 'late'} readOnly />
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setAttendanceRecords(p => ({ ...p, [enrollment.id]: 'absent' }))}>
                        <input type="radio" style={{ cursor: 'pointer' }} checked={attendanceRecords[enrollment.id] === 'absent'} readOnly />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {activeTab === 'report' && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
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
              {enrollments.map(enroll => {
                const stats = getStudentStats(enroll.id);
                return (
                  <tr key={enroll.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>{enroll.student.name}</td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>{stats.present}</td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#92400e' }}>{stats.late}</td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#991b1b' }}>{stats.absent}</td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                      <span className={`badge ${stats.percentage >= 80 ? 'badge-success' : stats.percentage >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                        {stats.total > 0 ? `${stats.percentage}%` : 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <button className="btn-outline" style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setHistoryStudent(enroll)}>View History</button>
                    </td>
                  </tr>
                );
              })}
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
          <button type="submit" className="btn-primary" disabled={isActionLoading}>
            {isActionLoading ? 'Checking Grading Window...' : 'Confirm Evaluation'}
          </button>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={!!historyStudent} onClose={() => setHistoryStudent(null)} title="Attendance Record">
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