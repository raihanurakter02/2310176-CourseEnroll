import React, { useContext } from 'react';
import { AuthContext } from '../AuthContext';

const AdminDashboard: React.FC = () => {
  const auth = useContext(AuthContext);
  return (
    <div>
      <h2>Admin Dashboard</h2>
      <p>Welcome, {auth?.user?.name}. Access global system controls for users, courses, and assignments.</p>
    </div>
  );
};

export default AdminDashboard;