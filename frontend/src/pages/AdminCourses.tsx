import React, { useEffect, useState } from 'react';
import api from '../api';

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  capacity: number;
}

const AdminCourses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourse, setNewCourse] = useState({ course_code: '', course_name: '', description: '', credit: 3, capacity: 40 });
  const [message, setMessage] = useState('');

  const fetchCourses = () => {
    api.get('/courses').then(res => setCourses(res.data)).catch(() => setMessage('Failed to load'));
  };

  useEffect(() => fetchCourses(), []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/courses', newCourse);
      setMessage('Course created successfully');
      fetchCourses();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to create course');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/courses/${id}`);
      setMessage('Course deleted');
      fetchCourses();
    } catch {
      setMessage('Failed to delete course');
    }
  };

  return (
    <div>
      <h2>Manage Courses</h2>
      {message && <p><b>{message}</b></p>}
      
      <form onSubmit={handleCreate} style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h3>Create New Course</h3>
        <input placeholder="Code (e.g. CSE101)" required value={newCourse.course_code} onChange={e => setNewCourse({...newCourse, course_code: e.target.value})} />
        <input placeholder="Name" required value={newCourse.course_name} onChange={e => setNewCourse({...newCourse, course_name: e.target.value})} />
        <button type="submit">Create</button>
      </form>

      <ul>
        {courses.map(course => (
          <li key={course.id} style={{ marginBottom: '1rem' }}>
            {course.course_code}: {course.course_name}
            <button onClick={() => handleDelete(course.id)} style={{ marginLeft: '1rem', color: 'red' }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminCourses;