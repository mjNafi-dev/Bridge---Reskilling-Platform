import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth.jsx";
import Onboarding from "./pages/onboarding/Onboarding.jsx";

// One route per page. More pages (pathway, progress...) get added here.
export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/results" element={<ComingNext />} />
      <Route path="*" element={<Navigate to="/signup" replace />} />
    </Routes>
  );
}

// Temporary stand-in until the results page is built
function ComingNext() {
  return (
    <main style={{ padding: "var(--space-64) var(--space-16)", maxWidth: 640, margin: "0 auto" }}>
      <p className="label-mono">Next up</p>
      <h2>Results are being built.</h2>
    </main>
  );
}
