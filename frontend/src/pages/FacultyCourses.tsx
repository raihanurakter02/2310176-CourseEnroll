import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  capacity: number;
}

const FacultyCourses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/faculty/courses')
      .then(res => setCourses(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load courses'));
  }, []);

  return (
    <div>
      <h2>My Assigned Courses</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {courses.map(course => (
          <li key={course.id} style={{ marginBottom: '1rem' }}>
            <strong>{course.course_code}: {course.course_name}</strong> (Capacity: {course.capacity})
            <br />
            <Link to={`/faculty/courses/${course.id}`}>
              <button style={{ marginTop: '5px' }}>View Student Roster</button>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FacultyCourses;