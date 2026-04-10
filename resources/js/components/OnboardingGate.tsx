import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Bắt user đã đăng nhập nhưng chưa chọn category (onboarding) — chuyển tới /onboarding.
 * Dùng trong layout bọc digest / my-kols / … (không bọc /onboarding).
 */
const OnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady || !user) {
      return;
    }
    const n = user.my_categories?.length ?? 0;
    if (n === 0) {
      navigate("/onboarding", { replace: true });
    }
  }, [authReady, user, navigate]);

  return <>{children}</>;
};

export default OnboardingGate;
