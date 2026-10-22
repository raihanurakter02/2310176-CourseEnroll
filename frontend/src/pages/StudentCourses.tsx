import React, { useEffect, useState } from 'react';
import api from '../api';

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  description: string;
  credit: number;
  capacity: number;
}

const StudentCourses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/courses')
      .then(res => setCourses(res.data))
      .catch(() => setMessage('Failed to load courses'));
  }, []);

  const handleEnroll = async (courseId: number) => {
    try {
      await api.post('/enrollments', { course_id: courseId });
      setMessage('Successfully enrolled!');
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Enrollment failed');
    }
  };

  return (
    <div>
      <h2>Available Courses</h2>
      {message && <p><b>{message}</b></p>}
      <ul>
        {courses.map(course => (
          <li key={course.id} style={{ marginBottom: '1rem' }}>
            <strong>{course.course_code}: {course.course_name}</strong> ({course.credit} Credits)
            <br />
            {course.description}
            <br />
            <button onClick={() => handleEnroll(course.id)}>Enroll</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StudentCourses;