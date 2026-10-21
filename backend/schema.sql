-- Bridge database. Every row traces back to a row in `sources`.

CREATE TABLE sources (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  publisher    TEXT NOT NULL,
  url          TEXT NOT NULL,
  version      TEXT,
  retrieved_on TEXT NOT NULL,   -- ISO date, shown to users next to the data
  license      TEXT
);

-- Jobs (ESCO occupations), with their O*NET link and Holland interest types
CREATE TABLE occupations (
  uri          TEXT PRIMARY KEY, -- ESCO occupation URI
  title        TEXT NOT NULL,
  description  TEXT,
  isco_code    TEXT,             -- ISCO-08 group
  isco_title   TEXT,
  onet_code    TEXT,             -- via the ESCO-O*NET crosswalk
  onet_match   TEXT,             -- exactMatch / closeMatch / ...
  riasec       TEXT,             -- JSON list, top 2 interest types
  riasec_scores TEXT,            -- JSON object, all six scores
  category     TEXT,             -- Technical / Creative / People & care / Business & organising / Hands-on
  alt_labels   TEXT              -- JSON list of other names for the job
);

-- Skills and knowledge (ESCO)
CREATE TABLE skills (
  uri        TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  skill_type TEXT                -- skill / knowledge
);

-- Which skills each job needs
CREATE TABLE occupation_skills (
  occupation_uri TEXT NOT NULL REFERENCES occupations(uri),
  skill_uri      TEXT NOT NULL REFERENCES skills(uri),
  relation       TEXT NOT NULL,  -- essential / optional
  PRIMARY KEY (occupation_uri, skill_uri)
);
