import { Navigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";

const RequireAdmin = ({ children }: any) => {
  const { currentRole, loadingRole } = useAppContext();

  if (loadingRole) return null;

  if ((currentRole || "").toLowerCase() !== "raise_admin") {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAdmin;