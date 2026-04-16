import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, authReady } = useAuth();

  useEffect(() => {
    if (authReady && user && !user.is_admin) {
      toast.error("Access denied");
    }
  }, [authReady, user]);

  if (!authReady) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.is_admin) {
    return <Navigate to="/digest" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
