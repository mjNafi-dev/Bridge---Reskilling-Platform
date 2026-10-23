import { STEPS } from "../onboarding/steps.js";

/*
  The hiring brief, described like onboarding's steps (same field types, drawn by
  onboarding/fields.jsx), but about the person HR is looking for.
  backend/app/hire.py reads these keys to line candidates up against the brief.
*/

// Reuse onboarding's option lists, so a candidate's answers and the brief use the same words
const optionsOf = (key) => STEPS.flatMap((s) => s.fields || []).find((f) => f.key === key)?.options || [];
const fromRoles = (key) => STEPS.find((s) => s.id === "experience").fields.find((f) => f.key === "roles").subfields.find((f) => f.key === key).options;

export const BRIEF_STEPS = [
  {
    id: "role",
    title: "Who are you hiring?",
    nav: "The role",
    required: true,
    intro: "Name the project and the role. Candidates who are working towards this role on Bridge get a note.",
    fields: [
      { key: "title", label: "Project name", type: "text", required: true, placeholder: "e.g. Junior UI designer, January intake" },
      { key: "role", label: "The role they'll do", type: "text", required: true, placeholder: "e.g. User interface designer" },
      { key: "industry", label: "Your industry", type: "select", options: fromRoles("industry") },
      {
        key: "experience", label: "Work experience needed", type: "cards", required: true, max: 1,
        options: ["No experience needed", "Some experience (1–2 years)", "Experienced (3+ years)"],
      },
    ],
  },
  {
    id: "skills",
    title: "What they should know",
    nav: "Skills",
    required: true,
    intro: "Bridge looks for each skill in everything a candidate shared: their skills, past work, projects, courses and what they've learned here.",
    fields: [
      { key: "skills", label: "Must-have skills, and how well", type: "skills", required: true, brief: true },
      { key: "niceToHave", label: "Nice to have", type: "tags", placeholder: "Type a skill, press Enter" },
      { key: "languages", label: "Languages they'll need", type: "tags", placeholder: "e.g. English, Bahasa Melayu" },
    ],
  },
  {
    id: "background",
    title: "Background",
    nav: "Background",
    required: false,
    intro: "Leave it empty if it doesn't matter. Plenty of good people are self-taught.",
    fields: [
      { key: "eduLevel", label: "Lowest education level", type: "select", options: optionsOf("eduLevel").filter((o) => o !== "Self-taught") },
    ],
  },
  {
    id: "person",
    title: "The person",
    nav: "The person",
    required: false,
    intro: "What would make someone enjoy this job. These count a little, never as much as skills.",
    fields: [
      {
        key: "workTypes", label: "What kind of work is it mostly?", type: "cards", max: 2,
        hint: "Pick up to 2. Matched with what candidates said they enjoy.", options: optionsOf("workTypes"),
      },
      {
        key: "hobbies", label: "Hobbies or interests that would help", type: "list", placeholder: "e.g. Sketching, press Enter",
        hint: "Someone who sketches may enjoy wireframes. A small bonus only.",
      },
      { key: "causes", label: "What does your team's work help with?", type: "chips", options: optionsOf("causes") },
    ],
  },
  {
    id: "review",
    title: "Check the brief",
    nav: "Review",
    required: true,
    custom: "review",
  },
];
