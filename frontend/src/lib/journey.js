/*
  "Share my journey" links. The snapshot lives in the link itself, after the #,
  which browsers never send to a server: nothing is stored anywhere, and the person
  holding the link sees exactly what was shared. No scores or rankings go in it.
*/

export function journeyLink(snapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, ...snapshot }));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const data = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${window.location.origin}/journey#${data}`;
}

export function readJourney(hash) {
  try {
    const data = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(data + "===".slice((data.length + 3) % 4));
    const snap = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return snap && snap.v === 1 && typeof snap.role === "string" ? snap : null;
  } catch {
    return null;
  }
}
