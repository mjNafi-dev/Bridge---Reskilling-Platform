/*
  The onboarding questions, described as data.
  Each step has fields; each field has a `type` that fields.jsx knows how to draw.
  `required: true` fields must be filled before "Next" works.
  `when` hides a field until a condition on the profile is true.
  Custom steps (CV upload, Review) are drawn by their own components.
*/

// Country list built from ISO 3166 codes; names come from the browser in English
const COUNTRY_CODES = "AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW".split(" ");
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRIES = COUNTRY_CODES.map((c) => regionNames.of(c)).sort((a, b) => a.localeCompare(b));


const INDUSTRIES = [
  "Creative & media", "Education", "Finance & banking", "Government & public sector",
  "Healthcare", "Hospitality & tourism", "IT & software", "Logistics & transport",
  "Manufacturing", "Oil, gas & energy", "Retail & e-commerce", "Telecommunications", "Other",
];

export const SKILL_LEVELS = ["Heard of it", "Know the basics", "Comfortable", "Could teach it"];

export const STEPS = [
  {
    id: "basics",
    title: "About you",
    nav: "Basics",
    required: true,
    intro: "A few basics so we can tailor data sources and courses to where you are.",
    fields: [
      { key: "name", label: "What should we call you?", type: "text", required: true, placeholder: "Your name or a nickname" },
      { key: "ageRange", label: "Age range", type: "select", required: true, options: ["18–24", "25–34", "35–44", "45–54", "55+"] },
      { key: "country", label: "Which country are you based in?", type: "select", required: true, options: COUNTRIES },
      {
        key: "situation", label: "What best describes you right now?", type: "cards", required: true, max: 1,
        options: ["Student", "Employed", "Between jobs", "On a career break", "Freelancer"],
      },
      { key: "orgCode", label: "Organisation join code", type: "text", placeholder: "e.g. DEMO-UNI-2026", hint: "Got a code from your HR team or university? Add it to join their group." },
      { key: "department", label: "Your programme or department", type: "text", when: (p) => !!p.orgCode, placeholder: "e.g. Bachelor of Accounting" },
      {
        key: "orgConsent", type: "checkbox", required: true, when: (p) => !!p.orgCode,
        label: "I agree that my university or organisation's staff can see my progress on Bridge by name: my programme, how I'm doing in each module, my best-match role and how much I'm learning. They never see my CV file.",
      },
    ],
  },
  {
    id: "cv",
    title: "Upload your CV",
    nav: "CV upload",
    required: false,
    custom: "cv",
  },
  {
    id: "education",
    title: "Your education",
    nav: "Education",
    required: true,
    intro: "Your highest level so far. Self-taught counts too.",
    fields: [
      { key: "eduLevel", label: "Highest level", type: "select", required: true, options: ["SPM", "STPM / A-Levels / Foundation", "Certificate (TVET / SKM)", "Diploma", "Bachelor's degree", "Master's degree", "PhD", "Self-taught"] },
      { key: "eduField", label: "Field of study", type: "text", required: true, placeholder: "e.g. Graphic design, Accounting" },
      { key: "eduType", label: "Where did you study?", type: "cards", required: true, max: 1, options: ["University", "TVET / polytechnic", "College", "Online / self-taught"] },
      { key: "eduYear", label: "Year finished (or expected)", type: "number", placeholder: "e.g. 2022", min: 1960, max: 2035 },
    ],
  },
  {
    id: "experience",
    title: "Your work experience",
    nav: "Experience",
    required: true,
    intro: "The tasks you actually did matter more than job titles. They show which skills you already have.",
    fields: [
      { key: "noExperience", type: "checkbox", label: "I don't have work experience yet" },
      {
        key: "roles", label: "Roles", type: "repeat", required: true, when: (p) => !p.noExperience,
        addLabel: "Add another role", itemLabel: "Role",
        subfields: [
          { key: "title", label: "Job title", type: "text", required: true, placeholder: "e.g. Graphic designer" },
          { key: "industry", label: "Industry", type: "select", options: INDUSTRIES },
          { key: "years", label: "Years in this role", type: "number", min: 0, max: 50, placeholder: "e.g. 3", suffix: "years" },
          { key: "tasks", label: "Main tasks", type: "tags", required: true, placeholder: "Type a task, press Enter", hint: "e.g. Designed social media posters, Retouched product photos" },
          { key: "tools", label: "Tools & software", type: "tags", placeholder: "e.g. Photoshop, Excel" },
        ],
      },
    ],
  },
  {
    id: "skills",
    title: "Your skills",
    nav: "Skills",
    required: true,
    intro: "Add skills you have, then tell us how confident you feel. Be honest. Nobody is grading you.",
    fields: [
      { key: "skills", label: "Skills", type: "skills", required: true },
      { key: "languages", label: "Languages you speak", type: "tags", placeholder: "e.g. English, Bahasa Melayu" },
    ],
  },
  {
    id: "courses",
    title: "Courses & certificates",
    nav: "Courses",
    required: false,
    intro: "Anything you've completed, so we don't suggest it again.",
    fields: [
      {
        key: "courses", label: "Courses", type: "repeat", addLabel: "Add a course", itemLabel: "Course",
        subfields: [
          { key: "name", label: "Course or certificate", type: "text", required: true, placeholder: "e.g. Google Data Analytics" },
          { key: "provider", label: "Provider", type: "text", placeholder: "e.g. Coursera, HRD Corp" },
          { key: "year", label: "Year", type: "number", min: 1980, max: 2035 },
        ],
      },
    ],
  },
  {
    id: "projects",
    title: "Projects, side work & volunteering",
    nav: "Projects",
    required: false,
    intro: "Freelance gigs, club roles, personal projects. This is often where hidden skills live.",
    fields: [
      {
        key: "projects", label: "Projects", type: "repeat", addLabel: "Add a project", itemLabel: "Project",
        subfields: [
          { key: "what", label: "What was it?", type: "text", required: true, placeholder: "e.g. Ran the photography club's Instagram" },
          { key: "role", label: "What did you do?", type: "text", placeholder: "e.g. Planned posts, edited photos" },
          { key: "skills", label: "Skills it used", type: "tags", placeholder: "Type a skill, press Enter" },
        ],
      },
    ],
  },
  {
    id: "direction",
    title: "Where you'd like to head",
    nav: "Direction",
    required: true,
    intro: "No wrong answers. This just helps us rank what to show first.",
    fields: [
      {
        key: "workTypes", label: "What kind of work do you enjoy?", type: "cards", required: true, max: 2,
        hint: "Pick up to 2. Based on the Holland interest types used by O*NET.",
        options: ["Hands-on", "Analytical", "Creative", "Helping people", "Leading & persuading", "Organising"],
      },
      {
        key: "goal", label: "What's your main goal?", type: "cards", required: true, max: 1,
        options: ["Get a new job", "Get promoted", "Switch to a new field", "Future-proof my current job"],
      },
      {
        // No hint: the note under the slider already says what each stop does to the ranking
        key: "comfort", label: "How far are you willing to stretch?", type: "comfort", required: true, default: 50,
      },
      { key: "industries", label: "Industries you're curious about", type: "chips", options: INDUSTRIES.filter((i) => i !== "Other") },
      { key: "eyeing", label: "A role you're already eyeing", type: "text", placeholder: "e.g. Video editor" },
      {
        key: "causes", label: "Which of these would you like your work to help with?", type: "chips",
        hint: "Linked to the UN Sustainable Development Goals. Matching roles get a small boost.",
        options: ["People's health", "The environment", "Education", "Fair opportunities", "Better cities", "Local businesses & jobs"],
      },
    ],
  },
  {
    id: "constraints",
    title: "Your time & budget",
    nav: "Time & budget",
    required: true,
    intro: "So the plan fits your real life.",
    fields: [
      { key: "hoursPerWeek", label: "Hours per week you can spend learning", type: "slider", required: true, min: 1, max: 20, unit: "h / week" },
      { key: "budget", label: "Budget for courses", type: "cards", required: true, max: 1, options: ["Free only", "Low-cost", "HRD Corp claimable", "Any"] },
      { key: "learnStyle", label: "How do you learn best?", type: "chips", options: ["Videos", "Reading", "Hands-on practice", "Learning with others"] },
    ],
  },
  {
    id: "interests",
    title: "Your interests",
    nav: "Interests",
    required: false,
    intro: "Totally optional. We use this to explain new topics with examples you'll relate to. It barely affects your matches.",
    fields: [
      { key: "books", label: "Books you've enjoyed", type: "books" },
      { key: "movies", label: "Movies or TV shows you've enjoyed", type: "list", placeholder: "Type a title, press Enter" },
      { key: "genres", label: "Favourite genres", type: "chips", options: ["Mystery", "Sci-fi", "Fantasy", "Drama", "Documentary", "Comedy", "Thriller", "Romance", "Action", "History"] },
      { key: "sports", label: "Sports you play or follow", type: "list", placeholder: "e.g. Badminton, press Enter" },
      { key: "hobbies", label: "Hobbies", type: "list", placeholder: "e.g. Fishing, press Enter" },
    ],
  },
  {
    id: "review",
    title: "Check everything",
    nav: "Review",
    required: true,
    custom: "review",
  },
];
