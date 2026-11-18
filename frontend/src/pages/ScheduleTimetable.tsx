import React, { useEffect, useState, useContext, useMemo } from 'react';
import api, { getCachedData } from '../api';
import { AuthContext } from '../AuthContext';
import { ToastContext } from '../ToastContext';
import SkeletonCard from '../components/SkeletonCard';

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  credit: number;
  capacity?: number;
  schedule_days?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  faculty_id?: number;
}

interface Enrollment {
  id: number;
  course_id: number;
  status: string;
  grade?: string | null;
  course?: Course;
}

interface Conflict {
  day: string;
  courseA: Course;
  courseB: Course;
}

const DAYS_OF_WEEK = [
  { key: 'Sun', label: 'Sunday' },
  { key: 'Mon', label: 'Monday' },
  { key: 'Tue', label: 'Tuesday' },
  { key: 'Wed', label: 'Wednesday' },
  { key: 'Thu', label: 'Thursday' },
];

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

// Helper to convert "HH:MM" to minutes from midnight
const timeToMinutes = (timeStr?: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

// Pastel card color palette for distinct courses
const COURSE_COLORS = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', pill: '#3b82f6', pillText: '#ffffff' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', pill: '#10b981', pillText: '#ffffff' },
  { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', pill: '#8b5cf6', pillText: '#ffffff' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', pill: '#f97316', pillText: '#ffffff' },
  { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d', pill: '#ec4899', pillText: '#ffffff' },
  { bg: '#ecfeff', border: '#a5f3fc', text: '#155e75', pill: '#06b6d4', pillText: '#ffffff' },
];

const ScheduleTimetable: React.FC = () => {
  const auth = useContext(AuthContext);
  const toast = useContext(ToastContext);

  const isStudent = auth?.user?.role === 'student';
  const cachedCourses = isStudent ? getCachedData<Course[]>('/courses') : getCachedData<Course[]>('/faculty/courses');
  const cachedEnrollments = getCachedData<Enrollment[]>('/enrollments/my');

  const [courses, setCourses] = useState<Course[]>(() => cachedCourses || []);
  const [enrollments, setEnrollments] = useState<Enrollment[]>(() => cachedEnrollments || []);
  const [isLoading, setIsLoading] = useState(() => !cachedCourses || cachedCourses.length === 0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchData = async () => {
    if (!cachedCourses) {
      setIsLoading(true);
    }
    try {
      if (isStudent) {
        const [enrollRes, courseRes] = await Promise.all([
          api.get('/enrollments/my'),
          api.get('/courses')
        ]);
        setEnrollments(enrollRes.data);
        setCourses(courseRes.data);
      } else {
        const facultyRes = await api.get('/faculty/courses');
        setCourses(facultyRes.data);
      }
    } catch {
      toast?.showToast('Failed to load schedule data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleRefresh = () => fetchData();
    window.addEventListener('enrollments:refresh', handleRefresh);
    return () => window.removeEventListener('enrollments:refresh', handleRefresh);
  }, []);

  // Filter approved active courses for the student
  const activeCourses: Course[] = useMemo(() => {
    if (isStudent) {
      const approvedIds = new Set(
        enrollments
          .filter(e => e.status === 'approved')
          .map(e => e.course_id)
      );
      return courses.filter(c => approvedIds.has(c.id));
    }
    return courses;
  }, [isStudent, enrollments, courses]);

  // Total enrolled credits
  const totalCredits = useMemo(() => {
    return activeCourses.reduce((sum, c) => sum + (c.credit || 0), 0);
  }, [activeCourses]);

  // Detect time conflicts across active courses
  const conflicts: Conflict[] = useMemo(() => {
    const list: Conflict[] = [];
    for (let i = 0; i < activeCourses.length; i++) {
      for (let j = i + 1; j < activeCourses.length; j++) {
        const c1 = activeCourses[i];
        const c2 = activeCourses[j];

        const days1 = (c1.schedule_days || '').split(',').map(d => d.trim().toLowerCase());
        const days2 = (c2.schedule_days || '').split(',').map(d => d.trim().toLowerCase());
        const commonDays = days1.filter(d => days2.includes(d));

        if (commonDays.length > 0) {
          const start1 = timeToMinutes(c1.start_time);
          const end1 = timeToMinutes(c1.end_time);
          const start2 = timeToMinutes(c2.start_time);
          const end2 = timeToMinutes(c2.end_time);

          // Overlap check: start1 < end2 && start2 < end1
          if (start1 < end2 && start2 < end1) {
            commonDays.forEach(day => {
              list.push({ day, courseA: c1, courseB: c2 });
            });
          }
        }
      }
    }
    return list;
  }, [activeCourses]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-fade-in schedule-page-container">
      {/* Action Header */}
      <div className="page-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>{isStudent ? 'Weekly Academic Schedule' : 'Faculty Teaching Schedule'}</h1>
          <p>
            {isStudent
              ? 'View your registered weekly timetable, inspect classroom locations, and print official verification slip.'
              : 'View your weekly classroom lecture timetable, assigned rooms, and lecture hours.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.2rem' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.35rem 0.75rem',
                border: 'none',
                background: viewMode === 'grid' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              📅 Grid View
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.35rem 0.75rem',
                border: 'none',
                background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              📋 List View
            </button>
          </div>

          <button
            className="btn-primary"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={handlePrint}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Verification Slip
          </button>
        </div>
      </div>

      {/* Summary KPI Badges (No Print) */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
            📚
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ENROLLED COURSES</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{activeCourses.length}</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
            ⚡
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>REGISTERED CREDITS</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#065f46' }}>{totalCredits} Credits</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
            🛡️
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACADEMIC STATUS</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#92400e' }}>
              {totalCredits >= 12 ? 'Full-Time Student' : totalCredits > 0 ? 'Part-Time Student' : 'Not Registered'}
            </div>
          </div>
        </div>
      </div>

      {/* Conflict Alert Banner */}
      {conflicts.length > 0 && (
        <div className="no-print" style={{
          background: '#fef2f2',
          border: '1px solid #f87171',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <div>
            <strong style={{ color: '#991b1b', fontSize: '0.95rem' }}>Schedule Time Conflict Detected!</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#b91c1c', fontSize: '0.88rem' }}>
              The following courses share overlapping hours on your timetable. Please adjust your registration:
            </p>
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem', color: '#991b1b', fontSize: '0.85rem' }}>
              {conflicts.map((c, i) => (
                <li key={i}>
                  <strong>{c.day.toUpperCase()}</strong>: {c.courseA.course_code} ({c.courseA.start_time} - {c.courseA.end_time}) conflicts with {c.courseB.course_code} ({c.courseB.start_time} - {c.courseB.end_time}).
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* MAIN TIMETABLE GRID (No Print) */}
      {isLoading ? (
        <div className="course-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : activeCourses.length === 0 ? (
        <div className="empty-state no-print">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
          <h3>No approved courses scheduled</h3>
          <p>Once your course enrollments are approved by administration, your weekly class schedule will appear here.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="no-print" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflowX: 'auto',
          padding: '1.25rem'
        }}>
          <div style={{ minWidth: '780px' }}>
            {/* Days Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '70px repeat(5, 1fr)',
              gap: '0.5rem',
              borderBottom: '2px solid var(--border)',
              paddingBottom: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              <div>Time</div>
              {DAYS_OF_WEEK.map(d => (
                <div key={d.key} style={{ padding: '0.25rem' }}>
                  {d.label}
                </div>
              ))}
            </div>

            {/* Timetable Rows */}
            <div style={{ position: 'relative', marginTop: '0.5rem' }}>
              {TIME_SLOTS.map((slot) => {
                const slotMinutes = timeToMinutes(slot);
                const nextSlotMinutes = slotMinutes + 60;

                return (
                  <div
                    key={slot}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px repeat(5, 1fr)',
                      gap: '0.5rem',
                      minHeight: '75px',
                      borderBottom: '1px dashed var(--border)',
                      alignItems: 'stretch'
                    }}
                  >
                    {/* Time Label */}
                    <div style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      paddingTop: '0.25rem',
                      textAlign: 'center'
                    }}>
                      {slot}
                    </div>

                    {/* Day Cells */}
                    {DAYS_OF_WEEK.map((d) => {
                      // Find courses that occur on this day and start within this time bracket
                      const matchingCourses = activeCourses.filter(c => {
                        const days = (c.schedule_days || '').split(',').map(s => s.trim().toLowerCase());
                        if (!days.includes(d.key.toLowerCase())) return false;
                        const start = timeToMinutes(c.start_time);
                        return start >= slotMinutes && start < nextSlotMinutes;
                      });

                      return (
                        <div key={d.key} style={{ padding: '0.2rem', position: 'relative' }}>
                          {matchingCourses.map((c, idx) => {
                            const color = COURSE_COLORS[c.id % COURSE_COLORS.length];
                            const isConflicted = conflicts.some(
                              cf => cf.day.toLowerCase() === d.key.toLowerCase() && (cf.courseA.id === c.id || cf.courseB.id === c.id)
                            );

                            return (
                              <div
                                key={c.id || idx}
                                style={{
                                  background: isConflicted ? '#fef2f2' : color.bg,
                                  border: `1px solid ${isConflicted ? '#ef4444' : color.border}`,
                                  borderRadius: 'var(--radius-md)',
                                  padding: '0.5rem 0.65rem',
                                  marginBottom: '0.35rem',
                                  boxShadow: 'var(--shadow-sm)',
                                  transition: 'transform 0.15s ease',
                                  cursor: 'default'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                  <span style={{
                                    background: isConflicted ? '#dc2626' : color.pill,
                                    color: color.pillText,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px'
                                  }}>
                                    {c.course_code}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: color.text }}>
                                    {c.start_time} - {c.end_time}
                                  </span>
                                </div>
                                <div style={{
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  color: 'var(--text-main)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {c.course_name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                  📍 {c.room || 'Room TBA'} • {c.credit} Credits
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="table-responsive no-print">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Course Name</th>
                <th>Schedule Days</th>
                <th>Lecture Hours</th>
                <th>Room / Venue</th>
                <th>Credits</th>
              </tr>
            </thead>
            <tbody>
              {activeCourses.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.course_code}</strong></td>
                  <td>{c.course_name}</td>
                  <td>
                    <span className="badge badge-primary">{c.schedule_days || 'Mon,Wed'}</span>
                  </td>
                  <td>{c.start_time} - {c.end_time}</td>
                  <td>📍 {c.room || 'Hall 101'}</td>
                  <td>{c.credit} Credits</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          OFFICIAL VERIFICATION SLIP (Visible in Print or PDF Export)
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="print-only verification-slip" style={{ display: 'none' }}>
        <div style={{ borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>CourseEnroll University</h1>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.95rem', color: '#444' }}>
              Office of the University Registrar • Academic Records & Registration
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, border: '1px solid #000', padding: '0.25rem 0.75rem' }}>
              OFFICIAL VERIFICATION SLIP
            </div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: '#666' }}>
              Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Student Identification */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f9f9f9', padding: '1rem', border: '1px solid #ddd', marginBottom: '1.5rem' }}>
          <div>
            <div><strong>Student Name:</strong> {auth?.user?.name}</div>
            <div><strong>Student Email:</strong> {auth?.user?.email}</div>
            <div><strong>Account ID:</strong> STD-{auth?.user?.id?.toString().padStart(6, '0')}</div>
          </div>
          <div>
            <div><strong>Academic Term:</strong> Active Semester 2026-2027</div>
            <div><strong>Registration Status:</strong> Fully Registered (In Good Standing)</div>
            <div><strong>Total Enrolled Credits:</strong> {totalCredits} Credit Hours</div>
          </div>
        </div>

        {/* Course Schedule Table */}
        <h3 style={{ borderBottom: '1px solid #000', paddingBottom: '0.35rem', marginBottom: '0.75rem' }}>
          Certified Registered Course Schedule
        </h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
          <thead>
            <tr style={{ background: '#eee', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem', border: '1px solid #ccc' }}>Course Code</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ccc' }}>Course Title</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ccc' }}>Credits</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ccc' }}>Schedule Days</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ccc' }}>Time Slot</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ccc' }}>Location / Room</th>
            </tr>
          </thead>
          <tbody>
            {activeCourses.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: '0.5rem', border: '1px solid #ccc', fontWeight: 'bold' }}>{c.course_code}</td>
                <td style={{ padding: '0.5rem', border: '1px solid #ccc' }}>{c.course_name}</td>
                <td style={{ padding: '0.5rem', border: '1px solid #ccc' }}>{c.credit}</td>
                <td style={{ padding: '0.5rem', border: '1px solid #ccc' }}>{c.schedule_days}</td>
                <td style={{ padding: '0.5rem', border: '1px solid #ccc' }}>{c.start_time} - {c.end_time}</td>
                <td style={{ padding: '0.5rem', border: '1px solid #ccc' }}>{c.room}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legal Certification and Signatures */}
        <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
          <div>
            <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem', fontSize: '0.85rem' }}>
              Student Signature
            </div>
            <div style={{ fontSize: '0.75rem', color: '#777', marginTop: '0.2rem' }}>
              I certify that this schedule reflects my approved course enrollments.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem', fontSize: '0.85rem' }}>
              Registrar / Academic Records Officer
            </div>
            <div style={{ fontSize: '0.75rem', color: '#777', marginTop: '0.2rem' }}>
              Official University Seal & Electronic Verification
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#888', borderTop: '1px dotted #ccc', paddingTop: '0.75rem' }}>
          This document is generated directly from the CourseEnroll Student Information System and serves as certified proof of enrollment.
        </div>
      </div>
    </div>
  );
};

export default ScheduleTimetable;
