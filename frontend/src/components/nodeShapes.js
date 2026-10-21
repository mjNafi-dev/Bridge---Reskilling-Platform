/*
  Outlines the dot cloud can turn into (centred on 0,0; SVG units, y points down).
  Each shape is a list of paths; dots are spread along them evenly by length.
*/

function arc(cx, cy, r, from, to, steps = 24) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

const SHAPES = {
  // Envelope: the card outline and the folded flap
  email: [
    { closed: true, pts: [[-140, -95], [140, -95], [140, 95], [-140, 95]] },
    { closed: false, pts: [[-140, -95], [0, 20], [140, -95]] },
  ],
  // Padlock: shackle, body and keyhole
  lock: [
    { closed: false, pts: [[-70, -5], [-70, -55], ...arc(0, -55, 70, Math.PI, 2 * Math.PI), [70, -55], [70, -5]] },
    { closed: true, pts: [[-115, -5], [115, -5], [115, 150], [-115, 150]] },
    { closed: true, pts: arc(0, 55, 20, 0, 2 * Math.PI, 16).slice(0, -1) },
    { closed: false, pts: [[0, 75], [0, 112]] },
  ],
};

function pathLength(path) {
  const pts = path.closed ? [...path.pts, path.pts[0]] : path.pts;
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

function pointAt(path, dist) {
  const pts = path.closed ? [...path.pts, path.pts[0]] : path.pts;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (dist <= seg || i === pts.length - 1) {
      const t = seg ? Math.min(1, dist / seg) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    dist -= seg;
  }
  return pts[pts.length - 1];
}

/*
  Returns { points: [{x,y,z}] (one per dot), links: [[i, j]] } for a shape.
  Links join neighbouring dots on the same path, so the outline is drawn.
*/
export function buildShape(name, count) {
  const paths = SHAPES[name];
  const lengths = paths.map(pathLength);
  const total = lengths.reduce((a, b) => a + b, 0);
  // Share the dots out by path length (at least 3 each)
  const shares = lengths.map((l) => Math.max(3, Math.round((l / total) * count)));
  while (shares.reduce((a, b) => a + b, 0) > count) shares[shares.indexOf(Math.max(...shares))]--;
  while (shares.reduce((a, b) => a + b, 0) < count) shares[shares.indexOf(Math.max(...shares))]++;

  const points = [];
  const links = [];
  paths.forEach((path, p) => {
    const n = shares[p];
    const first = points.length;
    for (let k = 0; k < n; k++) {
      const d = path.closed ? (lengths[p] * k) / n : (lengths[p] * k) / Math.max(1, n - 1);
      const [x, y] = pointAt(path, d);
      // a little depth so the flat icon still feels 3D as it sways
      points.push({ x, y, z: Math.sin(k * 1.7 + p) * 10 });
      if (k > 0) links.push([points.length - 2, points.length - 1]);
    }
    if (path.closed && n > 2) links.push([points.length - 1, first]);
  });
  return { points, links };
}
