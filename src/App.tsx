import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./state/AppContext";
import { Shell } from "./components/Shell";
import { ConfettiCanvas } from "./components/Confetti";
import { Celebration, Toast } from "./components/Overlays";
import { Login } from "./pages/Auth";
import { Setup } from "./pages/Setup";
import { Learn } from "./pages/Learn";
import { Profile, Stats, Today, Upsolve } from "./pages/Views";
import { Parent } from "./pages/Parent";

// Signed-in only; students finish onboarding (Codeforces handle) before anything else.
function RequireAuth() {
  const { ready, userId, me, data } = useApp();
  const loc = useLocation();
  if (!ready) return <div className="authwrap"><p className="muted">Loading…</p></div>;
  if (!userId || !me) return <Navigate to="/login" replace />;
  if (me.role === "student") {
    if (!data) return <div className="authwrap"><p className="muted">Loading…</p></div>;
    // First sign-in: Codeforces handle, groups, API key, CSES and TLE accounts before anything else.
    if ((!data.profile.cf_handle || !data.manual["setup:done"]) && loc.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
function Home() {
  const { me } = useApp();
  return <Navigate to={me?.role === "parent" ? "/parent" : "/learn"} replace />;
}

export default function App() {
  return <AppProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<Setup />} />
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="learn" element={<Learn />} />
            <Route path="learn/:stage" element={<Learn />} />
            <Route path="today" element={<Today />} />
            <Route path="upsolve" element={<Upsolve />} />
            <Route path="stats" element={<Stats />} />
            <Route path="profile" element={<Profile />} />
            <Route path="parent" element={<Parent />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    <ConfettiCanvas />
    <Toast />
    <Celebration />
  </AppProvider>;
}
