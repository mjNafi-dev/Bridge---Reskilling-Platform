import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth.jsx";
import Onboarding from "./pages/onboarding/Onboarding.jsx";
import Results from "./pages/results/Results.jsx";
import Pathway from "./pages/pathway/Pathway.jsx";

// One route per page. More pages (progress, data sources...) get added here.
export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/results" element={<Results />} />
      <Route path="/pathway" element={<Pathway />} />
      <Route path="*" element={<Navigate to="/signup" replace />} />
    </Routes>
  );
}
