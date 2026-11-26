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
import { TeamEmailPage } from "../pages/TeamEmailPage";
import { ModuleRoute, ModulesDisabledPage } from "../modules/ModuleRoute";

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
          { path: "/welcome", element: <ModuleRoute moduleKey="team.home"><WelcomePage /></ModuleRoute> },
          { path: "/bookings", element: <ModuleRoute moduleKey="team.bookings"><BookingsPage /></ModuleRoute> },
          { path: "/calendar", element: <ModuleRoute moduleKey="team.calendar"><CalendarPage /></ModuleRoute> },
          { path: "/escalations", element: <ModuleRoute moduleKey="team.escalations"><EscalationsPage /></ModuleRoute> },
          { path: "/guide", element: <ModuleRoute moduleKey="team.guide"><GuidePage /></ModuleRoute> },
          { path: "/notice-board", element: <ModuleRoute moduleKey="team.notice-board"><NoticeBoardPage /></ModuleRoute> },
          { path: "/team-email", element: <ModuleRoute moduleKey="team.team-email"><TeamEmailPage /></ModuleRoute> },
          { path: "/pawcare/booking", element: <ModuleRoute moduleKey="pawcare.booking"><PawcareBookingPage /></ModuleRoute> },
          { path: "/pawcare/appointments", element: <ModuleRoute moduleKey="pawcare.appointments"><PawcareAppointmentsPage /></ModuleRoute> },
          { path: "/pawcare/quotes", element: <ModuleRoute moduleKey="pawcare.quotes"><QuoteGeneratorPage /></ModuleRoute> },
          { path: "/pawcare/chat", element: <ModuleRoute moduleKey="pawcare.chat"><ClinicChatPage /></ModuleRoute> },
          { path: "/pawcare/pharmacy", element: <ModuleRoute moduleKey="pawcare.pharmacy"><PawcarePlaceholderPage title="Pharmacy" icon={Pill} /></ModuleRoute> },
          { path: "/pawcare/diagnostics", element: <ModuleRoute moduleKey="pawcare.diagnostics"><DiagnosticsPage /></ModuleRoute> },
          { path: "/modules-disabled", element: <ModulesDisabledPage /> },
          { path: "/admin", element: <AdminControlPage /> },
          { path: "/profile", element: <ProfilePage /> },
          { path: "/escalations/new", element: <ModuleRoute moduleKey="team.escalations"><CreateEscalationPage /></ModuleRoute> },
          { path: "/escalations/feature-request", element: <ModuleRoute moduleKey="team.escalations"><FeatureRequestPage /></ModuleRoute> },
          { path: "/escalations/report-bug", element: <ModuleRoute moduleKey="team.escalations"><ReportBugPage /></ModuleRoute> },
          { path: "/escalations/:escalationId", element: <ModuleRoute moduleKey="team.escalations"><EscalationDetailPage /></ModuleRoute> },
        ],
      },
    ],
  },
  { path: "*", element: <RootRedirect /> },
]);
