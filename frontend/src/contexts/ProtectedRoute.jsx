
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user } = useAuth();
    const location = useLocation();
  
    if (!user) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
  
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to={`/dashboard/${user.role}`} replace />;
    }
  
    return children;
  };