import { useEffect, useRef, useState } from "react";
import "./ConnectAI.css";

/*
  "Learn with your own AI": connect Claude, ChatGPT, Gemini or any MCP-capable assistant
  to Bridge. DEMO ONLY: nothing is actually connected; we remember the choice in the browser.
  The real version would be a Bridge MCP server exposing the profile (interests), the
  pathway and progress, plus a tool for the AI to *suggest* progress updates the user approves.
*/

export const AI_PROVIDERS = [
  { id: "claude", name: "Claude", note: "Anthropic" },
  { id: "chatgpt", name: "ChatGPT", note: "OpenAI" },
  { id: "gemini", name: "Gemini", note: "Google" },
  { id: "other", name: "Other", note: "Any MCP assistant" },
];

export function readAI() {
  try {
    return JSON.parse(localStorage.getItem("bridge.ai") || "null");
  } catch {
    return null;
  }
}

export function saveAI(value) {
  try {
    if (value) localStorage.setItem("bridge.ai", JSON.stringify(value));
    else localStorage.removeItem("bridge.ai");
  } catch {
    /* storage blocked */
  }
}

export default function ConnectAI({ open, onDone, interests = [], continueLabel = "Continue" }) {
  const ref = useRef(null);
  const [pick, setPick] = useState("claude");
  const [state, setState] = useState("choose"); // choose | connecting | connected

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setState("choose");
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  function connect() {
    setState("connecting");
    setTimeout(() => {
      saveAI({ provider: pick, connectedAt: new Date().toISOString() });
      setState("connected");
    }, 1400);
  }

  const provider = AI_PROVIDERS.find((p) => p.id === pick);
  const example = interests[0] || "football";

  return (
    <dialog ref={ref} className="connect ui-modal" onCancel={(e) => (e.preventDefault(), onDone(null))} aria-labelledby="connect-title">
      <div className="connect__inner">
        {state !== "connected" ? (
          <>
            <header className="ui-modal__band night">
              <p className="label-mono">Optional · Demo</p>
              <h2 id="connect-title">Learn with your own AI</h2>
              <p className="connect__lead">
                Connect the AI you already use and it can explain each topic through things you love, like a{" "}
                <strong>{example.toLowerCase()}</strong> analogy for a tricky chapter.
              </p>
            </header>

            <div className="connect__cols">
              <div>
                <h3>What it can see</h3>
                <ul>
                  <li>Your interests from onboarding</li>
                  <li>Your pathway and progress</li>
                </ul>
                <p className="connect__muted">Never your CV file or your password.</p>
              </div>
              <div>
                <h3>What it can do</h3>
                <ul>
                  <li>Explain topics with your own examples</li>
                  <li>Quiz you on what you've learned</li>
                  <li>Suggest progress updates, which you approve</li>
                </ul>
              </div>
            </div>

            <div className="connect__providers" role="radiogroup" aria-label="Choose your AI">
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={pick === p.id}
                  className={`connect__provider${pick === p.id ? " is-picked" : ""}`}
                  onClick={() => setPick(p.id)}
                  disabled={state === "connecting"}
                >
                  <span className="connect__mark" aria-hidden="true">{p.name.charAt(0)}</span>
                  <span className="connect__name">{p.name}</span>
                  <span className="connect__note">{p.note}</span>
                </button>
              ))}
            </div>

            <p className="connect__muted">
              Works through MCP (Model Context Protocol), the open standard AI assistants use to connect to apps.
              This demo doesn't connect anything for real.
            </p>

            <footer className="connect__foot">
              <button type="button" className="btn btn--ghost" onClick={() => onDone(null)} disabled={state === "connecting"}>
                Maybe later
              </button>
              <button type="button" className="btn btn--primary" onClick={connect} disabled={state === "connecting"}>
                {state === "connecting" ? "Connecting…" : `Connect ${provider.name}`}
              </button>
            </footer>
          </>
        ) : (
          <div className="connect__done">
            <span className="connect__tick" aria-hidden="true">✓</span>
            <h2 id="connect-title">Connected to {provider.name}</h2>
            <p className="connect__lead">
              Ask it about any topic on your pathway. When it thinks you've learned something, you'll see a suggestion to approve.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => onDone(pick)}>
              {continueLabel}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
