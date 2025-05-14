import { Navigate, Outlet } from "react-router-dom";
import useAuth from "../../hooks/useAuth";  // ✅ Correct relative path

const PrivateRoute = ({ allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
