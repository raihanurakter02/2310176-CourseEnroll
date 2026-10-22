import React, { useEffect, useState } from 'react';
import api from '../api';

interface Enrollment {
  id: number;
  course_id: number;
  enrolled_at: string;
  status: string;
}

const StudentMyCourses: React.FC = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [message, setMessage] = useState('');

  const fetchEnrollments = () => {
    api.get('/enrollments/my')
      .then(res => setEnrollments(res.data))
      .catch(() => setMessage('Failed to load enrollments'));
  };

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const handleDrop = async (enrollmentId: number) => {
    try {
      await api.delete(`/enrollments/${enrollmentId}`);
      setMessage('Course dropped successfully');
      fetchEnrollments();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to drop course');
    }
  };

  return (
    <div>
      <h2>My Enrollments</h2>
      {message && <p><b>{message}</b></p>}
      <ul>
        {enrollments.map(enrollment => (
          <li key={enrollment.id} style={{ marginBottom: '1rem' }}>
            Course ID: {enrollment.course_id} | Status: {enrollment.status}
            <br />
            <button onClick={() => handleDrop(enrollment.id)}>Drop Course</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StudentMyCourses;