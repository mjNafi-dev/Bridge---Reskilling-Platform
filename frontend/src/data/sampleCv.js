/*
  SYNTHETIC sample profile (not a real person). Used to pre-fill onboarding
  until real CV reading is connected to the backend. Hackathon rules: no real
  personal data or real CVs in demos.
*/
export const SAMPLE_CV = {
  eduLevel: "Diploma",
  eduField: "Graphic design",
  eduType: "College",
  eduYear: "2019",
  roles: [
    {
      title: "Graphic designer",
      industry: "Creative & media",
      years: "4",
      tasks: ["Designed social media posters", "Retouched product photos", "Built brand colour palettes", "Prepared print layouts"],
      tools: ["Photoshop", "Illustrator", "Lightroom", "Canva"],
    },
  ],
  skills: [
    { name: "Photo retouching", level: 3, lastUsed: "This year" },
    { name: "Colour correction", level: 2, lastUsed: "This year" },
    { name: "Layout & composition", level: 3, lastUsed: "This year" },
    { name: "Typography", level: 2, lastUsed: "This year" },
    { name: "Basic photography", level: 1, lastUsed: "1–3 years ago" },
  ],
  languages: ["English", "Bahasa Melayu"],
  courses: [{ name: "Adobe Lightroom Essentials", provider: "LinkedIn Learning", year: "2021" }],
};

// Which onboarding fields the CV step fills (used for the "From your CV" badges)
export const CV_FIELDS = Object.keys(SAMPLE_CV);

// Full SYNTHETIC demo profile for "Try with a demo profile": every required answer
// filled, so judges land on the Review step and can run matching straight away.
export const DEMO_PROFILE = {
  name: "Aina (demo)",
  ageRange: "25–34",
  country: "Malaysia",
  situation: "Employed",
  ...SAMPLE_CV,
  cvFileName: "sample-cv-graphic-designer.pdf",
  cvFilled: CV_FIELDS,
  workTypes: ["Creative", "Analytical"],
  goal: "Switch to a new field",
  comfort: 50,
  eyeing: "Video editor",
  causes: ["Education"],
  hoursPerWeek: 8,
  budget: "Free only",
  learnStyle: ["Videos", "Hands-on practice"],
  genres: ["Mystery", "Sci-fi"],
  sports: ["Football"],
  hobbies: ["Photography walks"],
};

// More SYNTHETIC demo people (made up, not real): different starting points, so judges
// can see how the matches change. Every required answer is filled.
const base = { cvFilled: [], comfort: 50, budget: "Free only", learnStyle: ["Videos", "Hands-on practice"] };

export const DEMO_PROFILES = [
  { id: "designer", label: "Graphic designer", who: "Aina, 29, wants to move into video", profile: DEMO_PROFILE },
  {
    id: "developer",
    label: "Junior developer",
    who: "Daniel, 26, eyeing data work",
    profile: {
      ...base,
      name: "Daniel (demo)", ageRange: "25–34", country: "Singapore", situation: "Employed",
      eduLevel: "Bachelor's degree", eduField: "Computer science", eduType: "University", eduYear: "2021",
      roles: [{
        title: "Software developer", industry: "IT & software", years: "3",
        tasks: ["Built REST APIs for a logistics dashboard", "Wrote SQL reports", "Fixed bugs and wrote unit tests"],
        tools: ["Python", "Django", "PostgreSQL", "Git"],
      }],
      skills: [
        { name: "Python", level: 2, lastUsed: "This year" },
        { name: "SQL", level: 2, lastUsed: "This year" },
        { name: "Software testing", level: 1, lastUsed: "This year" },
        { name: "Statistics", level: 1, lastUsed: "3+ years ago" },
      ],
      languages: ["English", "Mandarin"],
      workTypes: ["Analytical", "Hands-on"], goal: "Get promoted", comfort: 75, eyeing: "Data scientist",
      causes: ["Fair opportunities"], hoursPerWeek: 6, budget: "Low-cost", learnStyle: ["Reading", "Hands-on practice"],
      genres: ["Sci-fi"], sports: ["Badminton"], hobbies: ["Chess"],
    },
  },
  {
    id: "student",
    label: "Accounting student",
    who: "Siti, 22, first job hunt",
    profile: {
      ...base,
      name: "Siti (demo)", ageRange: "18–24", country: "Malaysia", situation: "Student",
      eduLevel: "Bachelor's degree", eduField: "Accounting", eduType: "University", eduYear: "2026",
      noExperience: true,
      skills: [
        { name: "Bookkeeping", level: 2, lastUsed: "This year" },
        { name: "Excel", level: 2, lastUsed: "This year" },
        { name: "Financial reporting", level: 1, lastUsed: "This year" },
      ],
      projects: [{ what: "Treasurer of the accounting society", role: "Managed the budget and wrote monthly reports", skills: ["Budgeting"] }],
      languages: ["Bahasa Melayu", "English"],
      workTypes: ["Organising", "Analytical"], goal: "Get a new job", comfort: 25,
      causes: ["Local businesses & jobs"], hoursPerWeek: 10, orgCode: "DEMO-UNI-2026", department: "Accounting & Finance", orgConsent: true,
      genres: ["Mystery"], hobbies: ["Baking"],
    },
  },
  {
    id: "technician",
    label: "Factory technician",
    who: "Ravi, 41, worried about automation",
    profile: {
      ...base,
      name: "Ravi (demo)", ageRange: "35–44", country: "India", situation: "Employed",
      eduLevel: "Certificate (TVET / SKM)", eduField: "Electrical maintenance", eduType: "TVET / polytechnic", eduYear: "2004",
      roles: [{
        title: "Maintenance technician", industry: "Manufacturing", years: "15",
        tasks: ["Repaired production line machines", "Did preventive maintenance checks", "Wired control panels", "Trained new staff on safety"],
        tools: ["Multimeter", "AutoCAD"],
      }],
      skills: [
        { name: "Machine maintenance", level: 3, lastUsed: "This year" },
        { name: "Electrical wiring", level: 3, lastUsed: "This year" },
        { name: "Troubleshooting", level: 2, lastUsed: "This year" },
        { name: "Health and safety", level: 2, lastUsed: "This year" },
      ],
      languages: ["Tamil", "English", "Hindi"],
      workTypes: ["Hands-on"], goal: "Future-proof my current job", comfort: 50,
      causes: ["The environment"], hoursPerWeek: 4,
      sports: ["Cricket"], hobbies: ["Gardening"],
    },
  },
];
