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
  eyeing: "Video editor",
  causes: ["Education"],
  hoursPerWeek: 8,
  budget: "Free only",
  learnStyle: ["Videos", "Hands-on practice"],
  genres: ["Mystery", "Sci-fi"],
  hobbies: ["Photography walks"],
};
