import React, { useContext } from 'react';
import { AuthContext } from '../AuthContext';

const StudentDashboard: React.FC = () => {
  const auth = useContext(AuthContext);
  return (
    <div>
      <h2>Student Dashboard</h2>
      <p>Welcome, {auth?.user?.name}. Here you can browse courses and manage your enrollments.</p>
    </div>
  );
};

export default StudentDashboard;