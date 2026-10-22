import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

interface Student {
  id: number;
  name: string;
  email: string;
}

const FacultyCourseDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/faculty/courses/${id}/students`)
      .then(res => setStudents(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load students'));
  }, [id]);

  return (
    <div>
      <h2>Course Roster</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      <h3>Enrolled Students</h3>
      {students.length === 0 && !error ? <p>No students are currently enrolled in this course.</p> : null}
      
      <ul>
        {students.map(student => (
          <li key={student.id}>
            {student.name} - {student.email}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FacultyCourseDetails;