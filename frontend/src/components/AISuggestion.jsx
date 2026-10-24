import { useEffect, useRef } from "react";
import { AIIcon } from "./ConnectAI.jsx";
import "./AISuggestion.css";

/*
  "Your AI suggests an update": the connected AI proposes a progress change and the learner
  approves it. DEMO ONLY: nothing is really connected, so the popup is opened with Alt+O
  (on the dashboard) after a chat about the Up next topic. The real version would be the
  Bridge MCP server's "suggest progress" tool, with the same approve / not yet choice.
*/
export default function AISuggestion({ provider, topic, interest, onAccept, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (topic && !d.open) d.showModal();
    if (!topic && d.open) d.close();
  }, [topic]);

  return (
    <dialog ref={ref} className="suggest ui-modal" onCancel={(e) => (e.preventDefault(), onClose())} aria-labelledby="suggest-title">
      {topic && (
        <>
          <header className="ui-modal__band night">
            <p className="label-mono suggest__from">
              <AIIcon id={provider.id} size={14} /> From your chat with {provider.name}
            </p>
            <h2 id="suggest-title">{provider.name} suggests an update</h2>
          </header>
          <div className="ui-modal__body suggest__body">
            <p>
              You worked through <strong>{topic.title.toLowerCase()}</strong> with {provider.name}, using {interest.toLowerCase()} as
              the example, and answered its check questions. It thinks you've got this one.
            </p>
            <ul className="suggest__changes">
              <li>
                <span className="suggest__tick" aria-hidden="true" />
                <span>Mark <strong>{topic.title}</strong> as done</span>
              </li>
              <li>
                <span className="suggest__tick" aria-hidden="true" />
                <span>Log 1 hour of learning this week</span>
              </li>
            </ul>
            <p className="f__hint">Nothing changes until you accept. You can undo it from your path.</p>
          </div>
          <footer className="ui-modal__foot suggest__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Not yet
            </button>
            <button type="button" className="btn btn--primary" onClick={onAccept}>
              Accept
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}
