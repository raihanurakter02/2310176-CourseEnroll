import React, { useEffect, useState, useContext, useMemo } from 'react';
import api, { getCachedData } from '../api';
import Modal from '../components/Modal';
import SkeletonCard from '../components/SkeletonCard';
import SearchInput from '../components/SearchInput';
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
  const cachedCourses = getCachedData<Course[]>('/courses');
  const cachedUsers = getCachedData<User[]>('/users');
  const [courses, setCourses] = useState<Course[]>(() => cachedCourses || []);
  const [faculty, setFaculty] = useState<User[]>(() => {
    if (!cachedUsers) return [];
    return cachedUsers.filter(u => u.role === 'faculty');
  });
  const [isPageLoading, setIsPageLoading] = useState(() => !cachedCourses || !cachedUsers);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'assigned' | 'unassigned'>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Form State
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | ''>('');
  const [isEditing, setIsEditing] = useState(false);

  // Delete confirmation state
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  const toast = useContext(ToastContext);

  const fetchData = async () => {
    if (!cachedCourses || !cachedUsers) {
      setIsPageLoading(true);
    }
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

  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      // Tab filter
      if (filterTab === 'assigned' && c.faculty_id === null) return false;
      if (filterTab === 'unassigned' && c.faculty_id !== null) return false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const prof = faculty.find(f => f.id === c.faculty_id);
      const profName = prof ? prof.name.toLowerCase() : '';
      return (
        c.course_code.toLowerCase().includes(q) ||
        c.course_name.toLowerCase().includes(q) ||
        profName.includes(q)
      );
    });
  }, [courses, faculty, filterTab, searchQuery]);

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

  const handleOpenDelete = (course: Course) => {
    setCourseToDelete(course);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;
    setIsActionLoading(true);
    try {
      await api.delete(`/courses/${courseToDelete.id}/faculty`);
      toast?.showToast('Faculty assignment removed successfully', 'success');
      setIsConfirmDeleteOpen(false);
      setCourseToDelete(null);
      fetchData();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to remove assignment', 'error');
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

      {/* Search & Filter Toolbar */}
      <div className="premium-filter-bar">
        <div className="premium-filter-controls">
          <SearchInput
            placeholder="Search course code, title, or instructor..."
            value={searchQuery}
            onChange={setSearchQuery}
          />

          {/* Filter Tabs */}
          <div className="premium-pill-group">
            {(['all', 'assigned', 'unassigned'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                className={`premium-pill-btn ${filterTab === tab ? 'active' : ''}`}
                onClick={() => setFilterTab(tab)}
              >
                <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                <span className="premium-pill-badge">
                  {tab === 'assigned' ? assignedCourses.length : tab === 'unassigned' ? unassignedCourses.length : courses.length}
                </span>
              </button>
            ))}
          </div>

          {(searchQuery || filterTab !== 'all') && (
            <button
              type="button"
              className="premium-reset-btn"
              onClick={() => { setSearchQuery(''); setFilterTab('all'); }}
            >
              ✕ Reset Filters
            </button>
          )}
        </div>

        <div className="premium-count-badge">
          <span>Courses:</span>
          <strong>{filteredCourses.length}</strong> of {courses.length}
        </div>
      </div>

      <div className="table-scroll" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
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
            ) : filteredCourses.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🔍</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>No matching courses</div>
                  <div style={{ fontSize: '0.875rem' }}>Try clearing your search query or tab filter.</div>
                </td>
              </tr>
            ) : (
              filteredCourses.map(course => {
                const assignedProf = faculty.find(f => f.id === course.faculty_id);
                const isAssigned = course.faculty_id !== null;
                return (
                  <tr key={course.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{course.course_code}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{course.course_name}</div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      {isAssigned ? (
                        <span className="badge badge-primary">{assignedProf ? assignedProf.name : 'Unknown'}</span>
                      ) : (
                        <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                          ⚠️ Unassigned
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      {isAssigned ? (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-outline" 
                            style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                            onClick={() => handleOpenEdit(course)}
                          >
                            Edit Assignment
                          </button>
                          <button 
                            className="btn-outline"
                            style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#ef4444', borderColor: '#ef4444' }}
                            onClick={() => handleOpenDelete(course)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn-primary"
                          style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                          onClick={() => {
                            setIsEditing(false);
                            setSelectedCourseId(course.id);
                            setSelectedFacultyId(faculty.length > 0 ? faculty[0].id : '');
                            setIsModalOpen(true);
                          }}
                        >
                          + Assign Faculty
                        </button>
                      )}
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
      <Modal isOpen={isConfirmDeleteOpen} onClose={() => setIsConfirmDeleteOpen(false)} title="Remove Faculty Assignment">
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          Are you sure you want to remove the faculty assignment for <strong>{courseToDelete?.course_code} - {courseToDelete?.course_name}</strong>? This will unassign the instructor from this course.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            className="btn-outline"
            style={{ width: 'auto' }}
            onClick={() => setIsConfirmDeleteOpen(false)}
            disabled={isActionLoading}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{ width: 'auto', background: '#ef4444', borderColor: '#ef4444' }}
            onClick={handleConfirmDelete}
            disabled={isActionLoading}
          >
            {isActionLoading ? 'Removing...' : 'Yes, Remove'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminAssignments;