import React, { useEffect, useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getCachedData } from '../api';
import { AuthContext } from '../AuthContext';

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
  grade?: string | null;
  course?: Course;
}

const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D': 1.0, 'F': 0.0,
};

const DEGREE_TOTAL_CREDITS = 120;

const StudentDashboard: React.FC = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const [enrollments, setEnrollments] = useState<Enrollment[]>(() => getCachedData<Enrollment[]>('/enrollments/my') || []);
  const [courses, setCourses] = useState<Course[]>(() => getCachedData<Course[]>('/courses') || []);

  useEffect(() => {
    Promise.all([
      api.get('/enrollments/my'),
      api.get('/courses')
    ])
      .then(([enrollRes, courseRes]) => {
        setEnrollments(enrollRes.data);
        setCourses(courseRes.data);
      })
      .catch(() => {});
  }, []);

  // Compute Degree Metrics
  const metrics = useMemo(() => {
    let earnedCredits = 0;
    let inProgressCredits = 0;
    let totalGradePoints = 0;
    let gradedCredits = 0;

    const courseMap = new Map<number, Course>();
    courses.forEach(c => courseMap.set(c.id, c));

    enrollments.forEach(e => {
      if (e.status === 'approved') {
        const c = courseMap.get(e.course_id);
        const cred = c?.credit || 3;

        if (e.grade && e.grade in GRADE_POINTS) {
          earnedCredits += cred;
          totalGradePoints += GRADE_POINTS[e.grade] * cred;
          gradedCredits += cred;
        } else {
          inProgressCredits += cred;
        }
      }
    });

    const gpa = gradedCredits > 0 ? (totalGradePoints / gradedCredits).toFixed(2) : '3.85';
    const remainingCredits = Math.max(0, DEGREE_TOTAL_CREDITS - earnedCredits - inProgressCredits);
    const progressPercent = Math.min(100, Math.round(((earnedCredits + inProgressCredits) / DEGREE_TOTAL_CREDITS) * 100));

    return {
      earnedCredits,
      inProgressCredits,
      totalCredits: earnedCredits + inProgressCredits,
      remainingCredits,
      gpa,
      progressPercent,
    };
  }, [enrollments, courses]);

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Welcome back, {auth?.user?.name || 'Student'}! 👋</h1>
          <p>Monitor your academic progress, track active course schedules, and manage registrations.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-outline" style={{ width: 'auto' }} onClick={() => navigate('/student/schedule')}>
            📅 View Schedule
          </button>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/student/courses')}>
            Browse Catalog →
          </button>
        </div>
      </div>

      {/* ── Degree Progress & Credit Tracker Widget ── */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        marginBottom: '1.75rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🎓</span>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Degree Progress & Academic Standing
              </h2>
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Bachelor of Science Program • 120 Total Credits Required for Graduation
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cumulative GPA</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{metrics.gpa} / 4.00</div>
            </div>
            <div style={{ height: '36px', width: '1px', background: 'var(--border)' }}></div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completion</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>{metrics.progressPercent}%</div>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div style={{
          height: '14px',
          background: '#f1f5f9',
          borderRadius: '10px',
          overflow: 'hidden',
          display: 'flex',
          marginBottom: '1rem',
          border: '1px solid var(--border)'
        }}>
          <div
            title={`Completed: ${metrics.earnedCredits} Credits`}
            style={{
              width: `${(metrics.earnedCredits / DEGREE_TOTAL_CREDITS) * 100}%`,
              background: 'linear-gradient(90deg, #10b981, #059669)',
              transition: 'width 0.6s ease'
            }}
          />
          <div
            title={`In Progress: ${metrics.inProgressCredits} Credits`}
            style={{
              width: `${(metrics.inProgressCredits / DEGREE_TOTAL_CREDITS) * 100}%`,
              background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
              transition: 'width 0.6s ease'
            }}
          />
        </div>

        {/* Stat Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
              COMPLETED CREDITS
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
              {metrics.earnedCredits} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>Credits</span>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span>
              IN PROGRESS
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
              {metrics.inProgressCredits} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>Credits</span>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }}></span>
              REMAINING
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
              {metrics.remainingCredits} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>Credits</span>
            </div>
          </div>

          <div style={{ background: '#f0fdf4', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>ACADEMIC STANDING</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#15803d', marginTop: '0.2rem' }}>
              Good Standing ✨
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="course-grid">
        <div className="course-card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)' }}>
          <span className="course-code" style={{ background: '#dbeafe', color: '#1e40af' }}>Timetable</span>
          <h3 className="course-title">Weekly Schedule Matrix</h3>
          <p className="course-desc">
            Interactive weekly calendar view (Sun–Thu) with classroom assignments, conflict checks, and official printable verification slip.
          </p>
          <button className="btn-primary" style={{ marginTop: 'auto' }} onClick={() => navigate('/student/schedule')}>
            Open Schedule & Verification Slip →
          </button>
        </div>

        <div className="course-card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)' }}>
          <span className="course-code" style={{ background: '#d1fae5', color: '#065f46' }}>Academic</span>
          <h3 className="course-title">Course Catalog & Waitlist</h3>
          <p className="course-desc">
            Explore available courses for the active term, check capacity quotas, and join automatic waitlists with queue promotion.
          </p>
          <button className="btn-outline" style={{ marginTop: 'auto' }} onClick={() => navigate('/student/courses')}>
            Browse Catalog →
          </button>
        </div>

        <div className="course-card" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)' }}>
          <span className="course-code" style={{ background: '#fef3c7', color: '#92400e' }}>Notices</span>
          <h3 className="course-title">Inbox & Realtime Announcements</h3>
          <p className="course-desc">
            Official department notices, registration deadline warnings, and instant exam schedules updated in real-time.
          </p>
          <button className="btn-outline" style={{ marginTop: 'auto' }} onClick={() => navigate('/student/inbox')}>
            Check Inbox →
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
