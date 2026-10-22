import React, { useContext } from 'react';
import { AuthContext } from '../AuthContext';

const FacultyDashboard: React.FC = () => {
  const auth = useContext(AuthContext);
  return (
    <div>
      <h2>Faculty Dashboard</h2>
      <p>Welcome, {auth?.user?.name}. Manage your assigned courses and view student rosters here.</p>
    </div>
  );
};

export default FacultyDashboard;