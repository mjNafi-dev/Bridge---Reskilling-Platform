import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { fetchCandidates, fetchExampleProject } from "../../api.js";
import { readProject, sameCode, saveProject } from "../../lib/hire.js";
import { JourneyViewer } from "../journey/Journey.jsx";
import "./Hire.css";

/*
  A hiring project: the candidates whose codes were added, best fit with the brief first.
  Each journey shows how it lines up with the brief (backend/app/hire.py) and why.
*/

const byFit = (list) => [...list].sort((a, b) => (b.fit?.score ?? 0) - (a.fit?.score ?? 0));

export default function HireProject() {
  const { id } = useParams();
  const [project, setProject] = useState(() => readProject(id));
  const [found, setFound] = useState([]);
  const [missing, setMissing] = useState([]);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [exampleError, setExampleError] = useState(false);

  // Load once per project (and on retry); codes added later are merged in by add()
  useEffect(() => {
    if (!project) return;
    if (!project.codes.length) return setStatus("ready");
    let cancelled = false;
    setStatus("loading");
    fetchCandidates(project.codes, project.brief)
      .then((res) => {
        if (cancelled) return;
        setFound(byFit(res.candidates));
        setMissing(res.missing);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, attempt]);

  if (!project) return <Navigate to="/org?panel=hire" replace />;

  async function add(list) {
    const res = await fetchCandidates(list, project.brief);
    const fresh = res.candidates.filter((c) => !found.some((f) => sameCode(f.code, c.code)));
    if (fresh.length) {
      setFound((f) => byFit([...f, ...fresh]));
      setProject(saveProject({ ...project, codes: [...project.codes.filter((c) => !fresh.some((f) => sameCode(f.code, c))), ...fresh.map((c) => c.code)] }));
    }
    return { missing: res.missing, added: fresh.map((c) => c.code) };
  }

  async function addExamples() {
    setExampleError(false);
    try {
      const example = await fetchExampleProject();
      await add(example.codes);
    } catch {
      setExampleError(true);
    }
  }

  const empty = (
    <section className="ds-head night hire-empty rise">
      <p className="label-mono">{project.brief.role || "Hiring project"}</p>
      <h1 className="ds-head__title">Add your first candidates</h1>
      <p className="ds-head__sub">
        Ask each candidate for their code: they make one under “Share my journey” on their Bridge dashboard. Then add it with the + button at the top. Several at once? Separate them with commas or spaces.
      </p>
      <div className="hire-empty__actions">
        <button type="button" className="btn hire-empty__demo" onClick={addExamples}>Add the made-up example candidates</button>
        <Link className="hire-empty__link" to={`/hire/${project.id}/brief`}>Edit the brief</Link>
      </div>
      {exampleError && <p className="hire-empty__error" role="alert">We couldn't load the example candidates right now. Try again in a moment.</p>}
    </section>
  );

  return (
    <JourneyViewer
      candidates={found}
      status={status}
      missing={missing}
      onAdd={add}
      onRetry={() => setAttempt((a) => a + 1)}
      project={project}
      empty={empty}
    />
  );
}
