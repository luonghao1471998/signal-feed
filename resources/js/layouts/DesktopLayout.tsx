import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import LeftSidebar from "@/components/LeftSidebar";
import OnboardingGate from "@/components/OnboardingGate";
import RightPanel from "@/components/RightPanel";
import { DigestSidebarProvider } from "@/contexts/DigestSidebarContext";

const DesktopLayout: React.FC = () => {
  const { pathname } = useLocation();
  const showDigestPanel = pathname === "/digest" || pathname.startsWith("/digest/");

  return (
    <DigestSidebarProvider>
      <div className="flex min-h-screen bg-white">
        <LeftSidebar />
        <div className="flex min-h-screen flex-1 min-w-0 ml-[240px]">
          <main className="min-h-screen flex-1 min-w-0">
            <OnboardingGate>
              <Outlet />
            </OnboardingGate>
          </main>
          {showDigestPanel && <RightPanel />}
        </div>
      </div>
    </DigestSidebarProvider>
  );
};

export default DesktopLayout;
