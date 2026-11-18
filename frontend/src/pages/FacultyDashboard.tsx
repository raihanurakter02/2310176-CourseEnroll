import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import SkeletonCard from '../components/SkeletonCard';

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  credit: number;
  capacity: number;
  schedule_days?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
const DAY_LABELS: Record<string, string> = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
};

const COURSE_COLORS = [
  { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', badge: '#dbeafe' },
  { bg: '#f0fdf4', border: '#22c55e', text: '#15803d', badge: '#dcfce7' },
  { bg: '#faf5ff', border: '#a855f7', text: '#6b21a8', badge: '#f3e8ff' },
  { bg: '#fff7ed', border: '#f97316', text: '#c2410c', badge: '#ffedd5' },
  { bg: '#fdf2f8', border: '#ec4899', text: '#be185d', badge: '#fce7f3' },
];

const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    api.get('/faculty/courses')
      .then(res => setCourses(res.data || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Compute workload metrics
  const metrics = useMemo(() => {
    const totalCourses = courses.length;
    const totalCredits = courses.reduce((sum, c) => sum + (c.credit || 3), 0);
    
    // Estimate weekly lecture sessions
    let weeklySessions = 0;
    courses.forEach(c => {
      if (c.schedule_days) {
        const dCount = c.schedule_days.split(',').filter(Boolean).length;
        weeklySessions += dCount;
      }
    });

    const weeklyHours = (weeklySessions * 1.5).toFixed(1);

    return { totalCourses, totalCredits, weeklySessions, weeklyHours };
  }, [courses]);

  // Color mapping per course
  const courseColorMap = useMemo(() => {
    const map = new Map<number, typeof COURSE_COLORS[0]>();
    courses.forEach((c, idx) => {
      map.set(c.id, COURSE_COLORS[idx % COURSE_COLORS.length]);
    });
    return map;
  }, [courses]);

  // Group lectures by day for the weekly schedule graph
  const scheduleByDay = useMemo(() => {
    const daysMap: Record<string, Course[]> = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [] };
    courses.forEach(c => {
      if (c.schedule_days) {
        c.schedule_days.split(',').map(s => s.trim()).forEach(d => {
          if (daysMap[d]) {
            daysMap[d].push(c);
          }
        });
      }
    });

    // Sort each day chronologically by start_time
    Object.keys(daysMap).forEach(d => {
      daysMap[d].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    });

    return daysMap;
  }, [courses]);

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Faculty Instruction Portal 👨‍🏫</h1>
          <p>Manage your assigned academic sections, weekly lecture timetable, and student attendance records.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-outline" style={{ width: 'auto' }} onClick={() => navigate('/faculty/schedule')}>
            📅 Full Timetable
          </button>
          <button className="btn-outline" style={{ width: 'auto' }} onClick={() => navigate('/faculty/inbox')}>
            📬 Inbox
          </button>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/faculty/courses')}>
            Manage Classes →
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem', marginTop: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>📚</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {isLoading ? '...' : metrics.totalCourses}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Assigned Course Sections</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>🎓</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em' }}>
            {isLoading ? '...' : metrics.totalCredits}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Teaching Credit Hours</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>⏱️</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#16a34a', letterSpacing: '-0.02em' }}>
            {isLoading ? '...' : `${metrics.weeklyHours} hrs`}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Weekly Contact Hours</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>🏛️</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#d97706', letterSpacing: '-0.02em' }}>
            {isLoading ? '...' : `${metrics.weeklySessions} Lectures`}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Weekly Scheduled Classes</div>
        </div>
      </div>

      {/* Teaching Schedule Weekly Graph / Visual Timeline */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '2rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              📅 Weekly Teaching Schedule Matrix
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Chronological day-by-day distribution of your assigned lecture blocks.
            </p>
          </div>
          <button className="btn-outline" style={{ width: 'auto', fontSize: '0.85rem' }} onClick={() => navigate('/faculty/schedule')}>
            Open Interactive Timetable →
          </button>
        </div>

        {isLoading ? (
          <SkeletonCard />
        ) : courses.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No courses assigned to your faculty profile for the active semester.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {DAYS.map(dayKey => {
              const dayCourses = scheduleByDay[dayKey] || [];
              const isToday = new Date().getDay() === (dayKey === 'Sun' ? 0 : dayKey === 'Mon' ? 1 : dayKey === 'Tue' ? 2 : dayKey === 'Wed' ? 3 : 4);

              return (
                <div 
                  key={dayKey}
                  style={{
                    background: isToday ? '#fefce8' : '#f8fafc',
                    border: `1.5px solid ${isToday ? 'var(--accent-yellow)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    minHeight: '220px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {DAY_LABELS[dayKey]}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {dayCourses.length} {dayCourses.length === 1 ? 'class' : 'classes'}
                    </span>
                  </div>

                  {dayCourses.length === 0 ? (
                    <div style={{ margin: 'auto 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      No lectures scheduled
                    </div>
                  ) : (
                    dayCourses.map(course => {
                      const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
                      return (
                        <div
                          key={course.id}
                          style={{
                            background: color.bg,
                            borderLeft: `4px solid ${color.border}`,
                            border: `1px solid ${color.border}40`,
                            borderLeftWidth: '4px',
                            borderRadius: '6px',
                            padding: '0.75rem',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          }}
                          onClick={() => navigate(`/faculty/courses/${course.id}`)}
                          title={`Click to manage ${course.course_code}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: color.text }}>
                              {course.course_code}
                            </span>
                            <span style={{ fontSize: '0.72rem', background: color.badge, color: color.text, padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                              {course.room || 'Room TBA'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.35rem' }}>
                            {course.course_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span>⏰ {course.start_time || '08:30'} – {course.end_time || '10:00'}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assigned Classes Quick Hub */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
            📖 Active Assigned Courses ({courses.length})
          </h2>
          <button className="btn-outline" style={{ width: 'auto', fontSize: '0.85rem' }} onClick={() => navigate('/faculty/courses')}>
            View All Classes →
          </button>
        </div>

        <div className="course-grid">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : courses.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No courses currently assigned to your faculty profile.
            </div>
          ) : (
            courses.map(course => (
              <div key={course.id} className="course-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="course-code">{course.course_code}</span>
                  <span className="badge badge-success">{course.credit} Credits</span>
                </div>
                <h3 className="course-title">{course.course_name}</h3>
                <p className="course-desc">
                  Room: <strong>{course.room || 'TBA'}</strong> | Days: <strong>{course.schedule_days || 'Sun,Tue'}</strong> ({course.start_time || '08:30'} - {course.end_time || '10:00'})
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '1rem' }}>
                  <button 
                    className="btn-primary" 
                    style={{ flex: 1, padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={() => navigate(`/faculty/courses/${course.id}`)}
                  >
                    📋 Take Attendance
                  </button>
                  <button 
                    className="btn-outline" 
                    style={{ width: 'auto', padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={() => navigate(`/faculty/courses/${course.id}`)}
                  >
                    Roster
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;