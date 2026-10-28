import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { ToastContext } from '../ToastContext';

interface Semester {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  add_drop_deadline: string;
  grading_start_date: string | null;
  grading_end_date: string | null;
  is_active: boolean;
}

const AdminSemesters: React.FC = () => {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  
  const [newSemester, setNewSemester] = useState({ name: '', start_date: '', end_date: '', add_drop_deadline: '', grading_start_date: '', grading_end_date: '' });
  const toast = useContext(ToastContext);

  const fetchSemesters = () => {
    api.get('/semesters').then(res => setSemesters(res.data)).catch(() => toast?.showToast('Failed to load semesters', 'error'));
  };

  useEffect(() => { fetchSemesters(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/semesters', {
        ...newSemester,
        grading_start_date: newSemester.grading_start_date || null,
        grading_end_date: newSemester.grading_end_date || null
      });
      toast?.showToast('Semester created', 'success');
      setNewSemester({ name: '', start_date: '', end_date: '', add_drop_deadline: '', grading_start_date: '', grading_end_date: '' });
      setIsCreateModalOpen(false);
      fetchSemesters();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to create semester', 'error');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSemester) return;
    try {
      await api.put(`/semesters/${editingSemester.id}`, {
        ...editingSemester,
        grading_start_date: editingSemester.grading_start_date || null,
        grading_end_date: editingSemester.grading_end_date || null
      });
      toast?.showToast('Semester updated', 'success');
      setEditingSemester(null);
      fetchSemesters();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to update semester', 'error');
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await api.put(`/semesters/${id}/activate`);
      toast?.showToast('Semester activated', 'success');
      fetchSemesters();
    } catch {
      toast?.showToast('Failed to activate semester', 'error');
    }
  };

  // Helper to open the native date picker popup when clicking anywhere on the input
  const handleDateClick = (e: React.MouseEvent<HTMLInputElement>) => {
    try { (e.target as HTMLInputElement).showPicker(); } catch {}
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Semester Management</h1>
          <p>Define academic timelines, enrollment deadlines, and strict grading periods.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setIsCreateModalOpen(true)}>+ Add Semester</button>
      </div>

      <div className="course-grid">
        {semesters.map(semester => (
          <div key={semester.id} className="course-card" style={{ border: semester.is_active ? '2px solid var(--primary)' : '' }}>
            <div className="badge-container">
              {semester.is_active && <span className="badge badge-success">Active Timeline</span>}
            </div>
            <h3 className="course-title">{semester.name}</h3>
            <p className="course-desc" style={{ fontSize: '0.85rem' }}>
              <strong>Starts:</strong> {new Date(semester.start_date).toLocaleString()} <br/>
              <strong>Ends:</strong> {new Date(semester.end_date).toLocaleString()} <br/>
              <strong style={{ color: '#dc2626' }}>Drop Deadline:</strong> {new Date(semester.add_drop_deadline).toLocaleString()} <br/>
              <strong style={{ color: 'var(--primary)' }}>Grading Window:</strong> {semester.grading_start_date ? new Date(semester.grading_start_date).toLocaleDateString() : 'N/A'} - {semester.grading_end_date ? new Date(semester.grading_end_date).toLocaleDateString() : 'N/A'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
              <button className="btn-outline" onClick={() => setEditingSemester(semester)}>Edit Details</button>
              {!semester.is_active && <button className="btn-primary" onClick={() => handleActivate(semester.id)}>Set Active</button>}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Semester">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Semester Name</label>
            <input required value={newSemester.name} onChange={e => setNewSemester({...newSemester, name: e.target.value})} placeholder="e.g. Fall 2026" />
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
              <label>Start Date</label>
              <input type="datetime-local" onClick={handleDateClick} required value={newSemester.start_date} onChange={e => setNewSemester({...newSemester, start_date: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
              <label>End Date</label>
              <input type="datetime-local" onClick={handleDateClick} required value={newSemester.end_date} onChange={e => setNewSemester({...newSemester, end_date: e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label>Add/Drop Deadline</label>
            <input type="datetime-local" onClick={handleDateClick} required value={newSemester.add_drop_deadline} onChange={e => setNewSemester({...newSemester, add_drop_deadline: e.target.value})} />
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '1.25rem', width: '100%' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
              <label>Grading Opens</label>
              <input type="datetime-local" onClick={handleDateClick} value={newSemester.grading_start_date} onChange={e => setNewSemester({...newSemester, grading_start_date: e.target.value})} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
              <label>Grading Closes</label>
              <input type="datetime-local" onClick={handleDateClick} value={newSemester.grading_end_date} onChange={e => setNewSemester({...newSemester, grading_end_date: e.target.value})} />
            </div>
          </div>
          
          <button type="submit" className="btn-primary">Create Semester</button>
        </form>
      </Modal>

      <Modal isOpen={editingSemester !== null} onClose={() => setEditingSemester(null)} title="Edit Semester">
        {editingSemester && (
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Semester Name</label>
              <input required value={editingSemester.name} onChange={e => setEditingSemester({...editingSemester, name: e.target.value})} />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                <label>Start Date</label>
                <input type="datetime-local" onClick={handleDateClick} required value={editingSemester.start_date.slice(0,16)} onChange={e => setEditingSemester({...editingSemester, start_date: e.target.value})} />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                <label>End Date</label>
                <input type="datetime-local" onClick={handleDateClick} required value={editingSemester.end_date.slice(0,16)} onChange={e => setEditingSemester({...editingSemester, end_date: e.target.value})} />
              </div>
            </div>
            
            <div className="form-group">
              <label>Add/Drop Deadline</label>
              <input type="datetime-local" onClick={handleDateClick} required value={editingSemester.add_drop_deadline.slice(0,16)} onChange={e => setEditingSemester({...editingSemester, add_drop_deadline: e.target.value})} />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '1.25rem', width: '100%' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
                <label>Grading Opens</label>
                <input type="datetime-local" onClick={handleDateClick} value={editingSemester.grading_start_date ? editingSemester.grading_start_date.slice(0,16) : ''} onChange={e => setEditingSemester({...editingSemester, grading_start_date: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
                <label>Grading Closes</label>
                <input type="datetime-local" onClick={handleDateClick} value={editingSemester.grading_end_date ? editingSemester.grading_end_date.slice(0,16) : ''} onChange={e => setEditingSemester({...editingSemester, grading_end_date: e.target.value})} />
              </div>
            </div>
            
            <button type="submit" className="btn-primary">Save Changes</button>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AdminSemesters;