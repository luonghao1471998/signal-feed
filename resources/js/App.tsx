import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DigestPage from "./pages/DigestPage";
import MyKOLsPage from "./pages/MyKOLsPage";
import ArchivePage from "./pages/ArchivePage";
import SettingsPage from "./pages/SettingsPage";
import OnboardingStep1 from "./pages/OnboardingStep1";
import OnboardingStep2 from "./pages/OnboardingStep2";
import NotFound from "./pages/NotFound";
import AdminLayout from "./layouts/AdminLayout";
import AdminSourcesPage from "./pages/AdminSourcesPage";
import AdminPipelinePage from "./pages/AdminPipelinePage";
import { CategoryFilterProvider } from "./contexts/CategoryFilterContext";
import { AuthProvider } from "./contexts/AuthContext";
import { useIsPWA } from "./hooks/useIsPWA";
import { useMediaQuery } from "./hooks/useMediaQuery";
import PWALayout from "./layouts/PWALayout";
import DesktopLayout from "./layouts/DesktopLayout";
import { SyncDocumentTitle } from "./components/SyncDocumentTitle";
import { LocaleProvider } from "@/i18n";
import { LocaleSync } from "./components/LocaleSync";

const queryClient = new QueryClient();

function AppRoutes() {
  const isPWA = useIsPWA();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const usePWALayout = isPWA || isMobile;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/sources" replace />} />
        <Route path="sources" element={<AdminSourcesPage />} />
        <Route path="pipeline" element={<AdminPipelinePage />} />
      </Route>
      <Route path="/onboarding" element={<OnboardingStep1 />} />
      <Route path="/onboarding/follow" element={<OnboardingStep2 />} />
      <Route path="/onboarding/follow-kols" element={<OnboardingStep2 />} />

      <Route element={usePWALayout ? <PWALayout /> : <DesktopLayout />}>
        <Route path="/digest" element={<DigestPage />} />
        <Route path="/digest/:date" element={<DigestPage />} />
        <Route path="/my-kols" element={<MyKOLsPage />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LocaleProvider>
            <LocaleSync />
            <CategoryFilterProvider>
              <SyncDocumentTitle />
              <AppRoutes />
            </CategoryFilterProvider>
          </LocaleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;