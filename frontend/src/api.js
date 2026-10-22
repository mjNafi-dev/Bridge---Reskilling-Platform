// Calls to the Bridge backend. Vite forwards /api to the Python server (see vite.config.js).

// pin: a job uri the server always returns as `pinned`, even if it drops out of the top 5
export async function fetchMatch(profile, comfort = 0.5, pin = null) {
  const res = await fetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, comfort, pin }),
  });
  if (!res.ok) throw new Error(`Match failed (${res.status})`);
  return res.json();
}

// Upload a CV to be read into onboarding answers. onProgress(0..100) follows the upload;
// the promise resolves once the server has read it. The server never stores the file.
export function readCv(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/cv");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.upload.onload = () => onProgress(100);
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON: handled below */
      }
      if (xhr.status === 200 && body) resolve(body);
      else reject(new Error(body?.detail || "We couldn't read your CV right now."));
    };
    xhr.onerror = () => reject(new Error("We couldn't reach the CV reader. Check your connection and try again."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

// Sources, catalogue size, the RunPod embedding job and the live snapshot (Data sources page)
export async function fetchDataOverview() {
  const res = await fetch("/api/data");
  if (!res.ok) throw new Error(`Data overview failed (${res.status})`);
  return res.json();
}

// Checked courses for pathway topics, filtered by the budget answer and ordered by learning style
export async function fetchCourses(topics, budget, learnStyle) {
  const res = await fetch("/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topics, budget: budget || null, learnStyle: learnStyle || [] }),
  });
  if (!res.ok) throw new Error(`Courses failed (${res.status})`);
  return res.json();
}

// Anonymous, combined numbers for an organisation (Org heatmap page)
export async function fetchOrg(code) {
  const res = await fetch(`/api/org/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(res.status === 404 ? "No organisation with that code." : `Org view failed (${res.status})`);
  return res.json();
}
