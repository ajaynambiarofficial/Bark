import { Navigate, Outlet, createBrowserRouter } from "react-router";
import { Pill } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { EscalationsPage } from "../pages/EscalationsPage";
import { CreateEscalationPage } from "../features/escalations/CreateEscalationPage";
import { EscalationDetailPage } from "../features/escalations/EscalationDetailPage";
import { LoginPage } from "../pages/LoginPage";
import { WelcomePage } from "../pages/WelcomePage";
import { BookingsPage } from "../pages/BookingsPage";
import { GuidePage } from "../pages/GuidePage";
import { CalendarPage } from "../pages/CalendarPage";
import { PawcarePlaceholderPage } from "../pages/PawcarePlaceholderPage";
import { DiagnosticsPage } from "../pages/DiagnosticsPage";
import { AdminControlPage } from "../pages/AdminControlPage";
import { PawcareBookingPage } from "../pages/PawcareBookingPage";
import { PawcareAppointmentsPage } from "../pages/PawcareAppointmentsPage";
import { QuoteGeneratorPage } from "../pages/QuoteGeneratorPage";
import { ClinicChatPage } from "../pages/ClinicChatPage";
import { ProfilePage } from "../pages/ProfilePage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { FeatureRequestPage } from "../features/escalations/FeatureRequestPage";
import { ReportBugPage } from "../features/escalations/ReportBugPage";
import { NoticeBoardPage } from "../pages/NoticeBoardPage";

function ProtectedRoute() {
  const { employee, isRestoring } = useAuth();
  if (isRestoring) return <LoadingScreen />;
  if (!employee) return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  return <Outlet />;
}

function RootRedirect() {
  const { employee, isRestoring } = useAuth();
  if (isRestoring) return <LoadingScreen />;
  return <Navigate to={employee ? "/welcome" : "/login"} replace />;
}

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/welcome", element: <WelcomePage /> },
          { path: "/bookings", element: <BookingsPage /> },
          { path: "/calendar", element: <CalendarPage /> },
          { path: "/escalations", element: <EscalationsPage /> },
          { path: "/guide", element: <GuidePage /> },
          { path: "/notice-board", element: <NoticeBoardPage /> },
          { path: "/pawcare/booking", element: <PawcareBookingPage /> },
          { path: "/pawcare/appointments", element: <PawcareAppointmentsPage /> },
          { path: "/pawcare/quotes", element: <QuoteGeneratorPage /> },
          { path: "/pawcare/chat", element: <ClinicChatPage /> },
          { path: "/pawcare/pharmacy", element: <PawcarePlaceholderPage title="Pharmacy" icon={Pill} /> },
          { path: "/pawcare/diagnostics", element: <DiagnosticsPage /> },
          { path: "/admin", element: <AdminControlPage /> },
          { path: "/profile", element: <ProfilePage /> },
          { path: "/escalations/new", element: <CreateEscalationPage /> },
          { path: "/escalations/feature-request", element: <FeatureRequestPage /> },
          { path: "/escalations/report-bug", element: <ReportBugPage /> },
          { path: "/escalations/:escalationId", element: <EscalationDetailPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <RootRedirect /> },
]);
