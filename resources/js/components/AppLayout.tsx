import React from "react";
import LeftSidebar from "./LeftSidebar";
import RightPanel from "./RightPanel";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, title }) => {
  return (
    <div className="min-h-screen bg-surface">
      <LeftSidebar />
      <RightPanel />
      <MobileHeader title={title} />

      <main className="md:ml-[220px] lg:mr-[280px] min-h-screen pb-16 md:pb-0">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default AppLayout;
