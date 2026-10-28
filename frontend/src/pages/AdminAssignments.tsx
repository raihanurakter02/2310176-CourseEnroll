import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import SkeletonCard from '../components/SkeletonCard';
import { ToastContext } from '../ToastContext';

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  faculty_id: number | null;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const AdminAssignments: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Form State
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | ''>('');
  const [isEditing, setIsEditing] = useState(false);

  const toast = useContext(ToastContext);

  const fetchData = async () => {
    setIsPageLoading(true);
    try {
      const [coursesRes, usersRes] = await Promise.all([
        api.get('/courses'),
        api.get('/users')
      ]);
      setCourses(coursesRes.data);
      setFaculty(usersRes.data.filter((u: User) => u.role === 'faculty'));
    } catch {
      toast?.showToast('Failed to load assignments data', 'error');
    } finally {
      setIsPageLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const assignedCourses = courses.filter(c => c.faculty_id !== null);
  const unassignedCourses = courses.filter(c => c.faculty_id === null);

  const handleOpenAssign = () => {
    setIsEditing(false);
    setSelectedCourseId(unassignedCourses.length > 0 ? unassignedCourses[0].id : '');
    setSelectedFacultyId(faculty.length > 0 ? faculty[0].id : '');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (course: Course) => {
    setIsEditing(true);
    setSelectedCourseId(course.id);
    setSelectedFacultyId(course.faculty_id || (faculty.length > 0 ? faculty[0].id : ''));
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !selectedFacultyId) {
      toast?.showToast('Please select both a course and a faculty member', 'error');
      return;
    }
    
    setIsActionLoading(true);
    try {
      await api.put(`/courses/${selectedCourseId}/faculty?faculty_id=${selectedFacultyId}`);
      toast?.showToast(`Faculty successfully ${isEditing ? 'updated' : 'assigned'}`, 'success');
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to assign faculty', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Faculty Assignments</h1>
          <p>Assign registered faculty members to teach specific course sections.</p>
        </div>
        <button 
          className="btn-primary" 
          style={{ width: 'auto' }} 
          onClick={handleOpenAssign}
          disabled={unassignedCourses.length === 0}
        >
          + Assign Course
        </button>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '1rem 1.5rem' }}>Course</th>
              <th style={{ padding: '1rem 1.5rem' }}>Assigned Instructor</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPageLoading ? (
              <tr><td colSpan={3} style={{ padding: '2rem' }}><SkeletonCard /></td></tr>
            ) : assignedCourses.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No courses have been assigned to faculty yet.</td></tr>
            ) : (
              assignedCourses.map(course => {
                const assignedProf = faculty.find(f => f.id === course.faculty_id);
                return (
                  <tr key={course.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{course.course_code}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{course.course_name}</div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span className="badge badge-primary">{assignedProf ? assignedProf.name : 'Unknown'}</span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <button 
                        className="btn-outline" 
                        style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                        onClick={() => handleOpenEdit(course)}
                      >
                        Edit Assignment
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? "Edit Assignment" : "Assign Faculty to Course"}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Course</label>
            {isEditing ? (
              <input 
                type="text" 
                disabled 
                value={courses.find(c => c.id === selectedCourseId)?.course_name || ''} 
                style={{ background: '#f1f5f9', color: 'var(--text-muted)' }} 
              />
            ) : (
              <select 
                required 
                value={selectedCourseId} 
                onChange={e => setSelectedCourseId(Number(e.target.value))}
              >
                {unassignedCourses.map(c => (
                  <option key={c.id} value={c.id}>{c.course_code} - {c.course_name}</option>
                ))}
              </select>
            )}
          </div>
          
          <div className="form-group">
            <label>Select Instructor</label>
            <select 
              required 
              value={selectedFacultyId} 
              onChange={e => setSelectedFacultyId(Number(e.target.value))}
            >
              <option value="" disabled>Choose a faculty member...</option>
              {faculty.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          
          <button type="submit" className="btn-primary" disabled={isActionLoading}>
            {isActionLoading ? 'Saving...' : 'Confirm Assignment'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default AdminAssignments;