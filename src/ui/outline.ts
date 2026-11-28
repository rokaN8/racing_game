// Top-down outline of a whole Track, for Track select and the HUD's minimap (docs/game-spec.md → Screens): centred in
// its canvas, Gaps left open, the start line marked and a tick across each other Checkpoint. +z up the screen; the
// Bike's starting right (−x) to the right, so it reads the way the Lap is ridden.
export interface Outline {
  colors: [string, string];                          // the stroke's gradient: the Track's primary and secondary
  outline: { x: number; z: number; gap: boolean }[]; // the baked Track's samples
  checkpoints: number[];                             // the sample at each Checkpoint; the first is the start line
}

// Draws it, line widths × `scale`, and returns where a world (x, z) lands on the canvas.
export function drawOutline(cv: HTMLCanvasElement, t: Outline, scale = 1) {
  const g = cv.getContext('2d'), pts = t.outline, pad = 12 * scale;
  const xs = pts.map(p => -p.x), zs = pts.map(p => -p.z);
  const x0 = Math.min(...xs), z0 = Math.min(...zs), w = Math.max(...xs) - x0 || 1, h = Math.max(...zs) - z0 || 1;
  const k = Math.min((cv.width - 2 * pad) / w, (cv.height - 2 * pad) / h);
  const ox = (cv.width - w * k) / 2, oz = (cv.height - h * k) / 2;
  const at = (x: number, z: number) => [ox + (-x - x0) * k, oz + (-z - z0) * k] as const;
  if (!g || !pts.length) return at;
  const P = (i: number) => at(pts[i % pts.length].x, pts[i % pts.length].z);
  const grad = g.createLinearGradient(0, 0, cv.width, 0);
  grad.addColorStop(0, t.colors[0]); grad.addColorStop(1, t.colors[1]);
  g.lineWidth = 3 * scale; g.lineCap = 'round'; g.strokeStyle = grad; g.shadowColor = t.colors[0]; g.shadowBlur = 8 * scale;
  g.beginPath();
  pts.forEach((p, i) => { if (p.gap) return; g.moveTo(...P(i)); g.lineTo(...P(i + 1)); });
  g.stroke();
  g.shadowBlur = 0; g.fillStyle = '#fff'; g.strokeStyle = '#fffc'; g.lineWidth = 1.5 * scale;
  const [sx, sy] = P(0); g.fillRect(sx - 6 * scale, sy - 1.5 * scale, 12 * scale, 3 * scale);
  g.beginPath();
  for (const i of t.checkpoints.slice(1)) { // across the Track, from its heading over the next few samples
    const [x, y] = P(i), [x1, y1] = P(i + 3), len = Math.hypot(x1 - x, y1 - y) || 1, nx = ((y - y1) / len) * 5 * scale, ny = ((x1 - x) / len) * 5 * scale;
    g.moveTo(x - nx, y - ny); g.lineTo(x + nx, y + ny);
  }
  g.stroke();
  return at;
}
