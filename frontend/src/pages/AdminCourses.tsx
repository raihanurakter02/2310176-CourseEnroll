import React, { useEffect, useState, useContext, useMemo } from 'react';
import api, { getCachedData } from '../api';
import Modal from '../components/Modal';
import { ToastContext } from '../ToastContext';

interface Course { 
  id: number; 
  course_code: string; 
  course_name: string; 
  capacity: number; 
  credit: number; 
  description: string; 
  schedule_days?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
}
interface ClassSession { id: number; date: string; topic: string | null; }

const AdminCourses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>(() => getCachedData<Course[]>('/courses') || []);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creditFilter, setCreditFilter] = useState<'all' | '1' | '2' | '3' | '4'>('all');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<number | null>(null);
  const [formState, setFormState] = useState({ 
    course_code: '', 
    course_name: '', 
    description: '', 
    credit: 3, 
    capacity: 40,
    schedule_days: 'Mon,Wed',
    start_time: '10:00',
    end_time: '11:30',
    room: 'Hall 101'
  });

  const [scheduleCourse, setScheduleCourse] = useState<Course | null>(null);
  const [courseSessions, setCourseSessions] = useState<ClassSession[]>([]);
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionTopic, setNewSessionTopic] = useState('');
  
  const toast = useContext(ToastContext);

  const fetchCourses = () => {
    api.get('/courses').then(res => setCourses(res.data)).catch(() => toast?.showToast('Failed to load courses', 'error'));
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      await api.post('/courses', { ...formState, capacity: Number(formState.capacity) || 40, credit: Number(formState.credit) || 3 });
      toast?.showToast('Course created successfully', 'success');
      setFormState({ 
        course_code: '', 
        course_name: '', 
        description: '', 
        credit: 3, 
        capacity: 40,
        schedule_days: 'Mon,Wed',
        start_time: '10:00',
        end_time: '11:30',
        room: 'Hall 101'
      });
      setIsCreateModalOpen(false);
      fetchCourses();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to create course', 'error');
    } finally { setIsActionLoading(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    setIsActionLoading(true);
    try {
      await api.put(`/courses/${editingCourse.id}`, { ...editingCourse, credit: Number(editingCourse.credit), capacity: Number(editingCourse.capacity) });
      toast?.showToast('Course updated successfully', 'success');
      setEditingCourse(null);
      fetchCourses();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to update course', 'error');
    } finally { setIsActionLoading(false); }
  };

  const confirmDelete = async () => {
    if (!courseToDelete) return;
    setIsActionLoading(true);
    try {
      await api.delete(`/courses/${courseToDelete}`);
      toast?.showToast('Course deleted successfully', 'success');
      setCourseToDelete(null);
      fetchCourses();
    } catch {
      toast?.showToast('Failed to delete course', 'error');
    } finally { setIsActionLoading(false); }
  };

  const openSchedule = async (course: Course) => {
    setScheduleCourse(course);
    try {
      const res = await api.get(`/courses/${course.id}/sessions`);
      setCourseSessions(res.data);
    } catch { toast?.showToast('Failed to load sessions', 'error'); }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleCourse) return;
    try {
      const res = await api.post(`/courses/${scheduleCourse.id}/sessions`, { date: newSessionDate, topic: newSessionTopic });
      setCourseSessions([...courseSessions, res.data]);
      setNewSessionDate('');
      setNewSessionTopic('');
      toast?.showToast('Class scheduled', 'success');
    } catch { toast?.showToast('Failed to add class session', 'error'); }
  };

  const handleDeleteSession = async (sessionId: number) => {
    try {
      await api.delete(`/sessions/${sessionId}`);
      setCourseSessions(courseSessions.filter(s => s.id !== sessionId));
      toast?.showToast('Session removed', 'success');
    } catch { toast?.showToast('Failed to delete session', 'error'); }
  };

  const handleDateClick = (e: React.MouseEvent<HTMLInputElement>) => {
    try { (e.target as HTMLInputElement).showPicker(); } catch {}
  };

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        course.course_code.toLowerCase().includes(q) ||
        course.course_name.toLowerCase().includes(q) ||
        (course.description && course.description.toLowerCase().includes(q)) ||
        (course.room && course.room.toLowerCase().includes(q));

      const matchesCredit = creditFilter === 'all' || String(course.credit) === creditFilter;
      return matchesSearch && matchesCredit;
    });
  }, [courses, searchQuery, creditFilter]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Manage Catalog</h1>
          <p>Create courses, edit details, and manage official class schedules for Faculty.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setIsCreateModalOpen(true)}>+ Create Course</button>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
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
              placeholder="Search by code, title, room..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.4rem', width: '100%', borderRadius: 'var(--radius-md)' }}
            />
          </div>

          <select
            value={creditFilter}
            onChange={e => setCreditFilter(e.target.value as any)}
            style={{ width: 'auto', padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-md)', minWidth: '130px' }}
          >
            <option value="all">All Credits</option>
            <option value="1">1 Credit</option>
            <option value="2">2 Credits</option>
            <option value="3">3 Credits</option>
            <option value="4">4 Credits</option>
          </select>

          {(searchQuery || creditFilter !== 'all') && (
            <button
              className="btn-outline"
              style={{ width: 'auto', padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
              onClick={() => { setSearchQuery(''); setCreditFilter('all'); }}
            >
              Reset
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          Showing <strong>{filteredCourses.length}</strong> of {courses.length} courses
        </div>
      </div>

      <div className="course-grid">
        {filteredCourses.map(course => (
          <div key={course.id} className="course-card">
            <span className="course-code">{course.course_code}</span>
            <h3 className="course-title">{course.course_name}</h3>
            <p className="course-desc" style={{ marginBottom: '0.4rem' }}>{course.description || 'No description provided'}</p>
            <p className="course-desc" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800 }}>Credits: {course.credit} | Capacity: {course.capacity} Students</p>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="btn-primary" style={{ padding: '0.5rem' }} onClick={() => openSchedule(course)}>Manage Schedule</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-outline" style={{ padding: '0.4rem' }} onClick={() => setEditingCourse({ ...course, description: course.description || '' })}>Edit</button>
                <button className="btn-outline" style={{ padding: '0.4rem', color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => setCourseToDelete(course.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {filteredCourses.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🔍</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No matching courses</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Try adjusting your search keyword or credit filter.</p>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Course">
        <form onSubmit={handleCreate}>
          <div className="form-group"><label>Course Code</label><input required value={formState.course_code} onChange={e => setFormState({ ...formState, course_code: e.target.value })} placeholder="e.g. CSE101" /></div>
          <div className="form-group"><label>Course Name</label><input required value={formState.course_name} onChange={e => setFormState({ ...formState, course_name: e.target.value })} placeholder="Introduction to CS" /></div>
          <div className="form-group"><label>Course Description</label><input required value={formState.description} onChange={e => setFormState({ ...formState, description: e.target.value })} placeholder="Basic programming concepts" /></div>
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>Credits</label><input type="number" min="1" required value={formState.credit} onChange={e => setFormState({ ...formState, credit: Number(e.target.value) })} /></div>
            <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>Capacity</label><input type="number" min="1" required value={formState.capacity} onChange={e => setFormState({ ...formState, capacity: Number(e.target.value) })} /></div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>Schedule Days</label><input value={formState.schedule_days} onChange={e => setFormState({ ...formState, schedule_days: e.target.value })} placeholder="e.g. Mon,Wed" /></div>
            <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>Room / Venue</label><input value={formState.room} onChange={e => setFormState({ ...formState, room: e.target.value })} placeholder="Hall 101" /></div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>Start Time (HH:MM)</label><input value={formState.start_time} onChange={e => setFormState({ ...formState, start_time: e.target.value })} placeholder="10:00" /></div>
            <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>End Time (HH:MM)</label><input value={formState.end_time} onChange={e => setFormState({ ...formState, end_time: e.target.value })} placeholder="11:30" /></div>
          </div>
          <button type="submit" className="btn-primary" disabled={isActionLoading}>{isActionLoading ? 'Creating...' : 'Create Course'}</button>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal isOpen={editingCourse !== null} onClose={() => setEditingCourse(null)} title="Edit Course">
        {editingCourse && (
          <form onSubmit={handleUpdate}>
            <div className="form-group"><label>Course Code</label><input required value={editingCourse.course_code} onChange={e => setEditingCourse({ ...editingCourse, course_code: e.target.value })} /></div>
            <div className="form-group"><label>Course Name</label><input required value={editingCourse.course_name} onChange={e => setEditingCourse({ ...editingCourse, course_name: e.target.value })} /></div>
            <div className="form-group"><label>Course Description</label><input value={editingCourse.description || ''} onChange={e => setEditingCourse({ ...editingCourse, description: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>Credits</label><input type="number" min="1" required value={editingCourse.credit} onChange={e => setEditingCourse({ ...editingCourse, credit: Number(e.target.value) })} /></div>
              <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>Capacity</label><input type="number" min="1" required value={editingCourse.capacity} onChange={e => setEditingCourse({ ...editingCourse, capacity: Number(e.target.value) })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>Schedule Days</label><input value={editingCourse.schedule_days || ''} onChange={e => setEditingCourse({ ...editingCourse, schedule_days: e.target.value })} placeholder="Mon,Wed" /></div>
              <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>Room / Venue</label><input value={editingCourse.room || ''} onChange={e => setEditingCourse({ ...editingCourse, room: e.target.value })} placeholder="Hall 101" /></div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>Start Time (HH:MM)</label><input value={editingCourse.start_time || ''} onChange={e => setEditingCourse({ ...editingCourse, start_time: e.target.value })} placeholder="10:00" /></div>
              <div className="form-group" style={{ flex: 1, minWidth: 0 }}><label>End Time (HH:MM)</label><input value={editingCourse.end_time || ''} onChange={e => setEditingCourse({ ...editingCourse, end_time: e.target.value })} placeholder="11:30" /></div>
            </div>
            <button type="submit" className="btn-primary" disabled={isActionLoading}>{isActionLoading ? 'Saving...' : 'Save Changes'}</button>
          </form>
        )}
      </Modal>

      {/* DELETE MODAL */}
      <Modal isOpen={courseToDelete !== null} onClose={() => setCourseToDelete(null)} title="Confirm Deletion">
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ marginBottom: '1.5rem', lineHeight: '1.6', color: 'var(--text-main)' }}>Are you sure you want to delete this course? This action cannot be undone.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn-outline" style={{ width: 'auto' }} onClick={() => setCourseToDelete(null)} disabled={isActionLoading}>Cancel</button>
            <button className="btn-primary" style={{ width: 'auto', background: '#dc2626' }} onClick={confirmDelete} disabled={isActionLoading}>{isActionLoading ? 'Deleting...' : 'Confirm Delete'}</button>
          </div>
        </div>
      </Modal>

      {/* SCHEDULE MODAL */}
      <Modal isOpen={!!scheduleCourse} onClose={() => setScheduleCourse(null)} title={`Schedule: ${scheduleCourse?.course_code}`}>
        <form onSubmit={handleAddSession} style={{ background: 'var(--bg-main)', padding: '1.25rem', borderRadius: '8px', border: '1.5px solid var(--border)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Using flex: '1 1 240px' ensures the input never shrinks below 240px, preventing text cutoff */}
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 240px' }}>
            <label>Date & Time</label>
            <input type="datetime-local" onClick={handleDateClick} required value={newSessionDate} onChange={e => setNewSessionDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 180px' }}>
            <label>Topic (Optional)</label>
            <input value={newSessionTopic} onChange={e => setNewSessionTopic(e.target.value)} placeholder="e.g. Midterm Review" />
          </div>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>Add</button>
        </form>

        <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1.5px solid var(--border)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1.5px solid var(--border)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                <th style={{ padding: '0.75rem 1rem' }}>Topic</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {courseSessions.map(session => (
                <tr key={session.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{new Date(session.date).toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{session.topic || '--'}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button className="btn-outline" style={{ padding: '0.2rem 0.5rem', color: '#dc2626', borderColor: '#fca5a5', width: 'auto' }} onClick={() => handleDeleteSession(session.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {courseSessions.length === 0 && (
                <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No classes scheduled by Admin yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
};

export default AdminCourses;