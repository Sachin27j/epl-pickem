import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/use-auth";
import GameweekPage from "./pages/GameweekPage";
import LeaguePage from "./pages/LeaguePage";
import LeaguesPage from "./pages/LeaguesPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SeasonPage from "./pages/SeasonPage";

function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {user?.email}</h1>

            <p className="mt-1 text-sm text-slate-500">EPL Pick&apos;em</p>
          </div>

          <button
            onClick={logout}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Your leagues</h2>

          <p className="mt-2 text-sm text-slate-500">
            Create or join an EPL Pick&apos;em league.
          </p>

          <a
            href="/leagues"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            View leagues
          </a>
        </div>
      </div>
    </main>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading...</p>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/login" element={<LoginPage />} />

      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/leagues"
        element={
          <ProtectedRoute>
            <LeaguesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/leagues/:leagueId"
        element={
          <ProtectedRoute>
            <LeaguePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/leagues/:leagueId/seasons/:seasonId"
        element={
          <ProtectedRoute>
            <SeasonPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/leagues/:leagueId/seasons/:seasonId/gameweeks/:gameweekId"
        element={
          <ProtectedRoute>
            <GameweekPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
