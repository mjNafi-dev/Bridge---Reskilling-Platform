import { useEffect, useRef, useState } from "react";
import "./ConnectAI.css";

/*
  "Learn with your own AI": connect Claude, ChatGPT, Gemini or any MCP-capable assistant
  to Bridge. DEMO ONLY: nothing is actually connected; we remember the choice in the browser.
  The real version would be a Bridge MCP server exposing the profile (interests), the
  pathway and progress, plus a tool for the AI to *suggest* progress updates the user approves.

  Steps: choose an AI -> set it up (connector URL, where to paste it, one-time code)
  -> test the connection -> connected. Opening it while connected shows the connection.
*/

// colour: the mark's brand colour (none = ink)
export const AI_PROVIDERS = [
  { id: "claude", name: "Claude", note: "Anthropic", color: "#d97757" },
  { id: "chatgpt", name: "ChatGPT", note: "OpenAI" },
  { id: "gemini", name: "Gemini", note: "Google", color: "#8e75b2" },
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

/* Brand marks for Claude, Gemini and MCP from Simple Icons (CC0). OpenAI's mark isn't
   available there, so ChatGPT gets a neutral chat icon. */
const ICON_PATHS = {
  claude:
    "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z",
  gemini:
    "M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81",
  other:
    "M13.85 0a4.16 4.16 0 0 0-2.95 1.217L1.456 10.66a.835.835 0 0 0 0 1.18.835.835 0 0 0 1.18 0l9.442-9.442a2.49 2.49 0 0 1 3.541 0 2.49 2.49 0 0 1 0 3.541L8.59 12.97l-.1.1a.835.835 0 0 0 0 1.18.835.835 0 0 0 1.18 0l.1-.098 7.03-7.034a2.49 2.49 0 0 1 3.542 0l.049.05a2.49 2.49 0 0 1 0 3.54l-8.54 8.54a1.96 1.96 0 0 0 0 2.755l1.753 1.753a.835.835 0 0 0 1.18 0 .835.835 0 0 0 0-1.18l-1.753-1.753a.266.266 0 0 1 0-.394l8.54-8.54a4.185 4.185 0 0 0 0-5.9l-.05-.05a4.16 4.16 0 0 0-2.95-1.218c-.2 0-.401.02-.6.048a4.17 4.17 0 0 0-1.17-3.552A4.16 4.16 0 0 0 13.85 0m0 3.333a.84.84 0 0 0-.59.245L6.275 10.56a4.186 4.186 0 0 0 0 5.902 4.186 4.186 0 0 0 5.902 0L19.16 9.48a.835.835 0 0 0 0-1.18.835.835 0 0 0-1.18 0l-6.985 6.984a2.49 2.49 0 0 1-3.54 0 2.49 2.49 0 0 1 0-3.54l6.983-6.985a.835.835 0 0 0 0-1.18.84.84 0 0 0-.59-.245",
};

export function AIIcon({ id, size = 20 }) {
  if (id === "chatgpt") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />
        <path d="M8.5 11h7M8.5 14.5h4.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d={ICON_PATHS[id] || ICON_PATHS.other} />
    </svg>
  );
}

// Where each assistant takes an MCP connector (demo copy: nothing is connected for real)
const SETUP = {
  claude: { where: "In Claude, open Settings → Connectors → Add custom connector, and paste the URL." },
  chatgpt: { where: "In ChatGPT, open Settings → Connectors, add a custom connector (MCP) and paste the URL." },
  gemini: { where: "Add Bridge to your Gemini CLI settings file:", config: (url) => ({ mcpServers: { bridge: { httpUrl: url } } }) },
  other: { where: "Add Bridge to your assistant's MCP settings:", config: (url) => ({ mcpServers: { bridge: { url } } }) },
};

const newCode = () => {
  const part = () => Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
  return `BRG-${part()}-${part()}`;
};

export default function ConnectAI({ open, onDone, interests = [], continueLabel = "Continue" }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const [pick, setPick] = useState("claude");
  const [state, setState] = useState("choose"); // choose | setup | testing | connected
  const [code, setCode] = useState(newCode);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      const saved = readAI();
      setPick(saved?.provider || "claude");
      setState(saved ? "connected" : "choose");
      setCode(newCode());
      setCopied("");
      d.showModal();
    }
    if (!open && d.open) d.close();
    if (!open) clearTimeout(timer.current); // closing mid-test never connects anything
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const provider = AI_PROVIDERS.find((p) => p.id === pick);
  const example = interests[0] || "football";
  const url = `${window.location.origin}/mcp`;
  const setup = SETUP[pick];

  function test() {
    setState("testing");
    timer.current = setTimeout(() => {
      saveAI({ provider: pick, connectedAt: new Date().toISOString() });
      setState("connected");
    }, 1600);
  }

  function disconnect() {
    saveAI(null);
    setState("choose");
  }

  function copy(text, what) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(what);
    setTimeout(() => setCopied((c) => (c === what ? "" : c)), 1600);
  }

  const close = () => {
    clearTimeout(timer.current);
    onDone(readAI()?.provider || null);
  };

  return (
    <dialog ref={ref} className="connect ui-modal" onCancel={(e) => (e.preventDefault(), close())} aria-labelledby="connect-title">
      {state === "choose" && (
        <>
          <header className="ui-modal__band night">
            <p className="label-mono">Optional · Demo</p>
            <h2 id="connect-title">Learn with your own AI</h2>
            <p className="connect__lead">
              Connect the AI you already use and it can explain each topic through things you love, like a{" "}
              <strong>{example.toLowerCase()}</strong> analogy for a tricky chapter.
            </p>
          </header>

          <div className="connect__inner ui-modal__body">
            <div className="connect__cols">
              <div>
                <h3><EyeIcon /> What it can see</h3>
                <ul>
                  <li>Your interests from onboarding</li>
                  <li>Your pathway and progress</li>
                </ul>
                <p className="connect__muted">Never your CV file or your password.</p>
              </div>
              <div>
                <h3><SparkIcon /> What it can do</h3>
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
                  className={`connect__provider connect__provider--${p.id}${pick === p.id ? " is-picked" : ""}`}
                  onClick={() => setPick(p.id)}
                >
                  <span className="connect__mark"><AIIcon id={p.id} /></span>
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
              <button type="button" className="btn btn--ghost" onClick={close}>Maybe later</button>
              <button type="button" className="btn btn--primary" onClick={() => setState("setup")}>
                Set up {provider.name}
              </button>
            </footer>
          </div>
        </>
      )}

      {(state === "setup" || state === "testing") && (
        <>
          <header className="ui-modal__band night connect__band">
            <span className={`connect__mark connect__mark--lg connect__provider--${pick}`}><AIIcon id={pick} size={24} /></span>
            <div>
              <p className="label-mono">Demo · nothing really connects</p>
              <h2 id="connect-title">Connect {provider.name} to Bridge</h2>
            </div>
          </header>

          <div className="connect__inner ui-modal__body">
            <ol className="connect__steps">
              <li>
                <span className="connect__step-num num">1</span>
                <div>
                  <p className="connect__step-title">Copy your Bridge connector URL</p>
                  <div className="connect__field">
                    <code>{url}</code>
                    <button type="button" className="connect__copy" onClick={() => copy(url, "url")}>
                      {copied === "url" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </li>
              <li>
                <span className="connect__step-num num">2</span>
                <div>
                  <p className="connect__step-title">Add it to {provider.name}</p>
                  <p className="connect__step-text">{setup.where}</p>
                  {setup.config && <pre className="connect__code">{JSON.stringify(setup.config(url), null, 2)}</pre>}
                </div>
              </li>
              <li>
                <span className="connect__step-num num">3</span>
                <div>
                  <p className="connect__step-title">Sign in with your one-time code</p>
                  <p className="connect__step-text">When {provider.name} asks to sign in to Bridge, enter this code. It lets {provider.name} see your pathway, never your CV or password.</p>
                  <div className="connect__field connect__field--code">
                    <code className="num">{code}</code>
                    <button type="button" className="connect__copy" onClick={() => copy(code, "code")}>
                      {copied === "code" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </li>
            </ol>

            <footer className="connect__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setState("choose")} disabled={state === "testing"}>
                Back
              </button>
              <button type="button" className="btn btn--primary" onClick={test} disabled={state === "testing"}>
                {state === "testing" ? <><span className="connect__spinner" aria-hidden="true" /> Waiting for {provider.name}…</> : "Test connection"}
              </button>
            </footer>
          </div>
        </>
      )}

      {state === "connected" && (
        <div className="connect__inner ui-modal__body">
          <div className="connect__done">
            <span className={`connect__mark connect__mark--xl connect__provider--${pick}`}><AIIcon id={pick} size={30} /></span>
            <span className="connect__badge"><span aria-hidden="true">✓</span> Connected</span>
            <h2 id="connect-title">{provider.name} is connected to Bridge</h2>
            <p className="connect__lead">
              Ask it about any topic on your pathway. When it thinks you've learned something, you'll see a suggestion to approve.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => onDone(pick)}>
              {continueLabel}
            </button>
            <button type="button" className="connect__link" onClick={disconnect}>
              Disconnect or switch AI
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
  </svg>
);
