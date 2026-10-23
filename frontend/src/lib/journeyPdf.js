import { jsPDF } from "jspdf";
import { SKILL_LEVELS } from "../pages/onboarding/steps.js";

/*
  "Save as PDF" on a shared journey: builds a real A4 PDF (selectable text, like a CV)
  and downloads it. Loaded only when someone clicks the button (see Journey.jsx).
  jsPDF's built-in Helvetica covers Latin text; anything outside it is simplified first.
*/

const C = {
  ink: [17, 17, 17],
  d2: [58, 58, 60],
  d3: [107, 107, 112],
  mid: [154, 154, 160],
  l1: [232, 232, 235],
  night: [17, 17, 17],
  nightText: [176, 176, 180],
  nightLine: [60, 60, 62],
  done: [163, 199, 107],
  learning: [217, 154, 11],
};
const PAGE_W = 210;
const PAGE_H = 297;
const M = 18; // margin
const W = PAGE_W - 2 * M;

const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const join = (...parts) => parts.filter(Boolean).join("  ·  ");
// Helvetica in jsPDF is WinAnsi: swap the few characters it can't draw
const safe = (t) =>
  String(t ?? "")
    .replace(/[→➔]/g, "->")
    .replace(/[✓✔]/g, "")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "");

export async function downloadJourneyPdf(snap, code) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 0;

  const font = (size, style = "normal", color = C.ink) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const lineH = (size) => size * 0.42; // mm per line at this point size
  const room = (h) => {
    if (y + h > PAGE_H - 20) {
      doc.addPage();
      y = M;
    }
  };
  const text = (t, size, style, color, x = M, width = W) => {
    font(size, style, color);
    const lines = doc.splitTextToSize(safe(t), width);
    room(lines.length * lineH(size));
    doc.text(lines, x, y + lineH(size) * 0.8);
    y += lines.length * lineH(size);
  };
  const label = (t, color = C.mid) => {
    font(7.5, "bold", color);
    doc.setCharSpace(0.4);
    doc.text(safe(t).toUpperCase(), M, y + 3);
    doc.setCharSpace(0);
    y += 5;
  };
  const section = (t) => {
    room(16);
    y += 6;
    font(13, "bold");
    doc.text(safe(t), M, y + 5);
    y += 8;
    doc.setDrawColor(...C.l1);
    doc.setLineWidth(0.3);
    doc.line(M, y, M + W, y);
    y += 4;
  };
  const bullets = (items, size = 9.5) => items.forEach((it) => text(`•  ${it}`, size, "normal", C.d2, M + 2, W - 2));

  // ---------- Dark header ----------
  const done = snap.done || [];
  const learning = snap.learning || [];
  const total = Math.max(snap.total || 0, done.length + learning.length);
  const roles = snap.roles || [];
  const headline = join(roles[0] ? sentence(roles[0].title) : snap.situation, snap.country);

  doc.setFillColor(...C.night);
  doc.rect(0, 0, PAGE_W, 74, "F");
  y = M;
  label(`Learning journey  ·  CV and beyond${code ? `  ·  ${code}` : ""}`, C.nightText);
  y += 1;
  text(snap.name || "A Bridge learner", 24, "bold", [255, 255, 255]);
  y += 1;
  if (headline) text(headline, 10.5, "normal", C.nightText);

  y += 5;
  label("Working towards", C.nightText);
  text(snap.role, 14, "bold", [255, 255, 255]);
  text(
    `${done.length} of ${total} topics done${learning.length ? `, ${learning.length} in progress` : ""}${snap.hours ? `, learning about ${snap.hours} hours a week` : ""}`,
    9,
    "normal",
    C.nightText
  );
  y += 2.5;
  const gap = 1.2;
  const seg = total ? (W - gap * (total - 1)) / total : W;
  for (let i = 0; i < Math.max(total, 1); i++) {
    doc.setFillColor(...(i < done.length ? C.done : i < done.length + learning.length ? C.learning : C.nightLine));
    doc.roundedRect(M + i * (seg + gap), y, seg, 2.6, 0.8, 0.8, "F");
  }
  y = 74 + 4;

  // ---------- Learning on Bridge ----------
  section("Learning on Bridge");
  const groups = [
    ["Done", done],
    ["Learning now", learning],
    [snap.v >= 2 ? "Already strong in (before Bridge)" : "Already brought", snap.v >= 2 ? snap.strong || [] : snap.brought || []],
  ].filter(([, list]) => list.length);
  if (!groups.length) text("Nothing marked yet.", 9.5, "normal", C.d3);
  groups.forEach(([name, list]) => {
    room(10);
    label(`${name}  (${list.length})`);
    text(list.join("  ·  "), 9.5, "normal", C.d2);
    y += 2.5;
  });

  if (snap.v >= 2) {
    // ---------- Experience ----------
    section("Experience");
    if (!roles.length) text(snap.noExperience ? "No work experience yet: starting out." : "Not shared.", 9.5, "normal", C.d3);
    roles.forEach((r) => {
      room(14);
      text(sentence(r.title), 11, "bold");
      const meta = join(r.industry, r.years && `${r.years} ${r.years === "1" ? "year" : "years"}`);
      if (meta) text(meta, 9, "normal", C.d3);
      y += 1;
      bullets(r.tasks || []);
      if (r.tools?.length) text(`Tools: ${r.tools.join(", ")}`, 9, "normal", C.d3);
      y += 3;
    });

    // ---------- Education, courses, projects ----------
    const edu = snap.education || {};
    if (edu.level || edu.field) {
      section("Education");
      text(edu.level && edu.field ? `${edu.level} in ${edu.field}` : edu.level || edu.field, 11, "bold");
      const year = edu.year && (Number(edu.year) > new Date().getFullYear() ? `expected ${edu.year}` : edu.year);
      if (edu.type || year) text(join(edu.type, year), 9, "normal", C.d3);
    }
    if (snap.courses?.length) {
      section("Courses and certificates");
      bullets(snap.courses.map((c) => [c.name, join(c.provider, c.year)].filter(Boolean).join("  ·  ")));
    }
    if (snap.projects?.length) {
      section("Projects");
      snap.projects.forEach((p) => {
        room(10);
        text(p.what, 10, "bold");
        if (p.role) text(p.role, 9, "normal", C.d2);
        if (p.skills?.length) text(`Skills: ${p.skills.join(", ")}`, 9, "normal", C.d3);
        y += 2;
      });
    }

    // ---------- Skills with level bars ----------
    if (snap.skills?.length) {
      section("Skills (self-rated)");
      snap.skills.forEach((s) => {
        room(6);
        font(9.5, "normal", C.d2);
        doc.text(safe(s.name), M, y + 3.5);
        const level = Math.min(3, Math.max(0, s.level ?? 1));
        for (let k = 0; k < 4; k++) {
          doc.setFillColor(...(k <= level ? C.ink : C.l1));
          doc.roundedRect(M + W - 52 + k * 6, y + 1.3, 5, 2, 0.6, 0.6, "F");
        }
        font(8, "normal", C.d3);
        doc.text(SKILL_LEVELS[level].toLowerCase(), M + W - 26, y + 3.5);
        y += 5.5;
      });
    }

    // ---------- The person ----------
    const interests = snap.interests || {};
    const rows = [
      ["Languages", snap.languages],
      ["Enjoys work that's", snap.enjoys],
      ["Wants their work to help with", snap.causes],
      ["Hobbies", interests.hobbies],
      ["Sports", interests.sports],
      ["Reads", interests.books],
      ["Watches", interests.movies],
      ["Genres", interests.genres],
    ].filter(([, v]) => v?.length);
    if (rows.length) {
      section("Beyond the CV");
      rows.forEach(([k, v]) => {
        room(6);
        font(9, "bold", C.d3);
        doc.text(safe(k), M, y + 3.5);
        const before = y;
        text(v.join(", "), 9.5, "normal", C.d2, M + 52, W - 52);
        y = Math.max(y, before + 5) + 1;
      });
    }
  }

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages();
  const date = snap.date ? new Date(`${snap.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    font(7.5, "normal", C.mid);
    doc.text(
      safe(`A snapshot${date ? ` from ${date}` : ""}, shared by its owner from Bridge. Skill levels are their own rating; pathway topics are ESCO skills.`),
      M,
      PAGE_H - 10
    );
    doc.text(`${i} / ${pages}`, PAGE_W - M, PAGE_H - 10, { align: "right" });
  }

  doc.setProperties({ title: `${snap.name || "Bridge"} - learning journey`, creator: "Bridge" });
  doc.save(`${(snap.name || "Bridge").replace(/[^\w -]/g, "")} - learning journey.pdf`);
}
