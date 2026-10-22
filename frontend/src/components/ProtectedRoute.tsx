import React, { useContext } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: Array<'student' | 'faculty' | 'admin'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const auth = useContext(AuthContext);

  if (auth?.loading) return <div>Loading session...</div>;
  
  if (!auth?.user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(auth.user.role)) {
    return <div><h2>403 Forbidden</h2><p>Your role does not have access to this page.</p></div>;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
