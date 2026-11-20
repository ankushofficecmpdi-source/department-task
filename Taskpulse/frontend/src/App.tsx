import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import Board from "@/pages/Board";
import Team from "@/pages/Team";
import ActivityFeed from "@/pages/ActivityFeed";
import Departments from "@/pages/Departments";
import DigestPage from "@/pages/Digest";
import Planner from "@/pages/Planner";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Overview />} />
          <Route path="/board" element={<Board />} />
          <Route path="/team" element={<Team />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/digest" element={<DigestPage />} />
          <Route path="/activity" element={<ActivityFeed />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors />
    </>
  );
}
