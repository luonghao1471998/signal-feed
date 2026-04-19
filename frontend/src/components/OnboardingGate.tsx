import React from "react";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * - Chưa đăng nhập (session hết hạn hoặc chưa login) → /login
 * - Đã login nhưng chưa chọn category → /onboarding
 * Dùng trong layout bọc digest / my-kols / … (không bọc /onboarding, /login).
 */
const OnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const n = user.my_categories?.length ?? 0;
  if (n === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default OnboardingGate;
