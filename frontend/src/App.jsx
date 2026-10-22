import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth.jsx";
import Onboarding from "./pages/onboarding/Onboarding.jsx";
import Results from "./pages/results/Results.jsx";
import Pathway from "./pages/pathway/Pathway.jsx";
import DataSources from "./pages/data/DataSources.jsx";
import Org from "./pages/org/Org.jsx";
import Journey from "./pages/journey/Journey.jsx";

// One route per page.
export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/results" element={<Results />} />
      <Route path="/pathway" element={<Pathway />} />
      <Route path="/data" element={<DataSources />} />
      <Route path="/org" element={<Org />} />
      <Route path="/org/:code" element={<Org />} />
      <Route path="/journey" element={<Journey />} />
      <Route path="*" element={<Navigate to="/signup" replace />} />
    </Routes>
  );
}
