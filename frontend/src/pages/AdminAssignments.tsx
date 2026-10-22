import React, { useEffect, useState } from 'react';
import api from '../api';

interface Course { id: number; course_code: string; faculty_id: number | null; }
interface User { id: number; name: string; role: string; }

const AdminAssignments: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    try {
      const courseRes = await api.get('/courses');
      const userRes = await api.get('/users');
      setCourses(courseRes.data);
      setFaculty(userRes.data.filter((u: User) => u.role === 'faculty'));
    } catch {
      setMessage('Failed to load data');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // FastAPI expects faculty_id as a query parameter based on our backend implementation
      await api.put(`/courses/${selectedCourse}/faculty?faculty_id=${selectedFaculty}`);
      setMessage('Faculty assigned successfully');
      fetchData();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Assignment failed');
    }
  };

  return (
    <div>
      <h2>Assign Faculty to Courses</h2>
      {message && <p><b>{message}</b></p>}
      
      <form onSubmit={handleAssign}>
        <select required value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
          <option value="">-- Select Course --</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.course_code}</option>)}
        </select>
        
        <select required value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)}>
          <option value="">-- Select Faculty --</option>
          {faculty.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        
        <button type="submit">Assign</button>
      </form>
    </div>
  );
};

export default AdminAssignments;