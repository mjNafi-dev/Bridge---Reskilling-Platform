import { Routes, Route, Navigate } from "react-router-dom";
import DotField from "./components/DotField.jsx";
import Auth from "./pages/Auth.jsx";
import Onboarding from "./pages/onboarding/Onboarding.jsx";
import Results from "./pages/results/Results.jsx";
import Pathway from "./pages/pathway/Pathway.jsx";
import DataSources from "./pages/data/DataSources.jsx";
import Org from "./pages/org/Org.jsx";
import Journey from "./pages/journey/Journey.jsx";
import HireBrief from "./pages/hire/HireBrief.jsx";
import HireProject from "./pages/hire/HireProject.jsx";

// One route per page, over the shared dot grid.
export default function App() {
  return (
    <>
      <DotField />
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
        <Route path="/hire/new" element={<HireBrief />} />
        <Route path="/hire/:id/brief" element={<HireBrief />} />
        <Route path="/hire/:id" element={<HireProject />} />
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    </>
  );
}
