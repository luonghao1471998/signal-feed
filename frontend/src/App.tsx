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
import AdminRoute from "./components/AdminRoute";
import AdminLayout from "./layouts/AdminLayout";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminPipelinePage from "./pages/AdminPipelinePage";
import AdminAccountsPage from "./pages/admin/AdminAccountsPage";
import AdminAdminFormPage from "./pages/admin/AdminAdminFormPage";
import AdminCategoryFormPage from "./pages/admin/AdminCategoryFormPage";
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage";
import AdminSourcesPage from "./pages/admin/AdminSourcesPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminDigestsPage from "./pages/admin/AdminDigestsPage";
import AdminSignalDetailPage from "./pages/admin/AdminSignalDetailPage";
import AdminSignalsPage from "./pages/admin/AdminSignalsPage";
import AdminSourcesManagementPage from "./pages/admin/AdminSourcesManagementPage";
import AdminSourceFormPage from "./pages/admin/AdminSourceFormPage";
import AdminTweetsPage from "./pages/admin/AdminTweetsPage";
import AdminUserFormPage from "./pages/admin/AdminUserFormPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
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
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/landingpage" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="digests" element={<AdminDigestsPage />} />
        <Route path="signals" element={<AdminSignalsPage />} />
        <Route path="signals/:id" element={<AdminSignalDetailPage />} />
        <Route path="tweets" element={<AdminTweetsPage />} />
        <Route path="sources" element={<AdminSourcesManagementPage />} />
        <Route path="sources/create" element={<AdminSourceFormPage />} />
        <Route path="sources/update/:id" element={<AdminSourceFormPage />} />
        <Route path="source-moderation" element={<AdminSourcesPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="categories/create" element={<AdminCategoryFormPage />} />
        <Route path="categories/update/:id" element={<AdminCategoryFormPage />} />
        <Route path="pipeline" element={<AdminPipelinePage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/update/:id" element={<AdminUserFormPage />} />
        <Route path="admins" element={<AdminAccountsPage />} />
        <Route path="admins/create" element={<AdminAdminFormPage />} />
        <Route path="admins/update/:id" element={<AdminAdminFormPage />} />
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