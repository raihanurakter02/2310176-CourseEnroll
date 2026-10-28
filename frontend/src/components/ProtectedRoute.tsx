import React, { useContext } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: Array<'student' | 'faculty' | 'admin'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const auth = useContext(AuthContext);
  const location = useLocation();

  if (auth?.loading) return <div className="auth-container">Loading session...</div>;
  
  if (!auth?.user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (!allowedRoles.includes(auth.user.role)) {
    return <Navigate to={`/${auth.user.role}/dashboard`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;