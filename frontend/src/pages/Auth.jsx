import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGo } from "../lib/go.js";
import BrandMark from "../components/BrandMark.jsx";
import NodeNetwork from "../components/NodeNetwork.jsx";
import CyclingTagline from "../components/CyclingTagline.jsx";
import { DEMO_PROFILES } from "../data/sampleCv.js";
import { STEPS } from "./onboarding/steps.js";
import "./Auth.css";

/*
  Sign-up and log-in share this one page; `mode` switches the wording.
  Demo version: there is no server account yet. We only remember the email in the
  browser (never the password) and move on. Creating an account always starts fresh;
  logging in keeps what's in this browser only if it belongs to the same email. Social sign-in buttons are disabled
  with a hover note, like the re-analyse button.
*/

const COPY = {
  signup: {
    title: "Create an account",
    button: "Create account",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchTo: "/login",
    passwordLabel: "Create password",
  },
  login: {
    title: "Welcome back",
    button: "Log in",
    switchText: "New to Bridge?",
    switchLink: "Create an account",
    switchTo: "/signup",
    passwordLabel: "Password",
  },
};

export default function Auth({ mode }) {
  const copy = COPY[mode];
  const go = useGo(); // page transition: this panel morphs into the onboarding panel
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null); // "email" | "lock" | null: shapes the dot animation
  const [pickDemo, setPickDemo] = useState(false); // the demo-people popover is open
  const demoRef = useRef(null);

  // The popover closes on Escape or a click anywhere else
  useEffect(() => {
    if (!pickDemo) return;
    const onDown = (e) => !demoRef.current?.contains(e.target) && setPickDemo(false);
    const onKey = (e) => e.key === "Escape" && setPickDemo(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickDemo]);

  function handleSubmit(e) {
    e.preventDefault();
    // Demo: no checks, anything typed goes through.
    // Demo only: keep the email so onboarding can greet the user. Passwords are never stored.
    const typed = email.trim().toLowerCase() || "guest";
    let to = "/onboarding";
    try {
      const prev = JSON.parse(localStorage.getItem("bridge.account") || "null");
      const same = mode === "login" && prev && !prev.demo && prev.email === typed;
      if (same) {
        if (localStorage.getItem("bridge.selectedJob")) to = "/pathway"; // straight back to the dashboard
      } else {
        clearBridgeData(); // someone else's (or a demo person's) answers never carry over
      }
      localStorage.setItem("bridge.account", JSON.stringify({ email: typed }));
    } catch {
      /* storage blocked: carry on without it */
    }
    go(to);
  }

  function startDemo(demo) {
    // Load a complete made-up profile and jump to the Review step. Anything from an
    // earlier person (pathway, progress) is cleared so the two don't mix.
    try {
      clearBridgeData();
      localStorage.setItem("bridge.account", JSON.stringify({ email: "demo@bridge.app", demo: true }));
      localStorage.setItem("bridge.profile", JSON.stringify(demo.profile));
      localStorage.setItem("bridge.onboardingStep", JSON.stringify(STEPS.length - 1));
    } catch {
      /* ignore */
    }
    go("/onboarding");
  }

  return (
    <main className="auth">
      <div className="auth__inner">
      <section className="auth__panel night">
        <BrandMark />
        <div className="auth__visual">
          <NodeNetwork shape={focused} />
        </div>
        <div className="auth__panel-foot">
          <CyclingTagline className="auth__tagline" />
          <p className="auth__facts">117 roles · 2,981 skills · <Link to="/data">ESCO, O*NET and ILO data</Link></p>
        </div>
      </section>

      <section className="auth__form-side">
        <form className="auth__form" onSubmit={handleSubmit} noValidate>
          <p className="label-mono rise" style={{ "--i": 0 }}>{mode === "signup" ? "Start here" : "Welcome back"}</p>
          <h1 className="auth__title rise" style={{ "--i": 1 }}>{copy.title}</h1>

          <label className="field rise" style={{ "--i": 2 }}>
            <span className="field__label">Your email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              required
            />
          </label>

          <label className="field rise" style={{ "--i": 3 }}>
            <span className="field__label">{copy.passwordLabel}</span>
            <span className="field__password">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("lock")}
                onBlur={() => setFocused(null)}
                required
              />
              <button
                type="button"
                className="field__eye"
                onMouseDown={(e) => e.preventDefault()} // keep focus in the field (and the lock shape)
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </span>
          </label>

          <button type="submit" className="btn btn--primary rise" style={{ "--i": 4 }}>{copy.button}</button>

          <div className="auth__divider rise" style={{ "--i": 5 }}><span>or continue with</span></div>

          <div className="auth__socials rise" style={{ "--i": 6 }}>
            {["Google", "GitHub", "Apple"].map((name) => (
              <span key={name} className="social" tabIndex={0}>
                <button type="button" className="social__btn" disabled aria-label={`${name} sign-in (not available in the demo)`}>
                  <SocialIcon name={name} />
                </button>
                <span className="social__note" role="tooltip">
                  {name} sign-in is off in the demo. The full version will let you sign in with one tap.
                </span>
              </span>
            ))}
          </div>

          <div className="auth__demo-wrap rise" style={{ "--i": 7 }} ref={demoRef}>
            <button
              type="button"
              className="btn btn--ghost auth__demo"
              onClick={() => setPickDemo((v) => !v)}
              aria-expanded={pickDemo}
              aria-haspopup="true"
            >
              Try with a demo profile
            </button>
            {pickDemo && (
              <div className="auth__demos" role="menu" aria-label="Demo people (made up)">
                <p className="auth__demos-title">Pick a made-up person</p>
                {DEMO_PROFILES.map((d) => (
                  <button key={d.id} type="button" role="menuitem" className="auth__demo-pick" onClick={() => startDemo(d)}>
                    <strong>{d.label}</strong>
                    <span>{d.who}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="auth__switch rise" style={{ "--i": 8 }}>
            {copy.switchText} <Link to={copy.switchTo}>{copy.switchLink}</Link>
          </p>
          <p className="auth__switch auth__org rise" style={{ "--i": 9 }}>
            University or HR team? <Link to="/org">See the organisation view</Link>
          </p>
        </form>
      </section>
      </div>
    </main>
  );
}

/* Everything Bridge keeps in this browser (answers, pathway, progress, account) */
function clearBridgeData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("bridge."))
    .forEach((k) => localStorage.removeItem(k));
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

function SocialIcon({ name }) {
  if (name === "Google")
    return (
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8z" />
        <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.6-2.8z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.4 9.1 5.4 12 5.4z" />
      </svg>
    );
  if (name === "GitHub")
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 1.5a10.5 10.5 0 0 0-3.3 20.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.4-3.5-1.4-.5-1.2-1.2-1.5-1.2-1.5-1-.7 0-.6 0-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.2 3.1.9.1-.7.4-1.2.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.2 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8.7.7 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10.5 10.5 0 0 0 12 1.5z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
    </svg>
  );
}
