/**
 * @typedef {{ date: number, weight: number }} HistoryPoint
 */

const PAD = 8; // keep circles/stroke from clipping at the viewBox edges

/**
 * Builds an inline-SVG line-chart string from chronological history points -
 * normalized to a 0-100 viewBox so it scales with whatever size the
 * container/CSS gives it (matches the existing bar-chart widgets'
 * "imperative width/height, styled via CSS" convention, just via SVG
 * coordinates instead of style.width/height).
 * @param {HistoryPoint[]} points Chronological (oldest first).
 * @returns {string} Empty string if there are no points - the caller decides
 * what empty-state UI to show instead.
 */
function buildWeightHistoryChart(points) {
  if (points.length === 0) return '';

  if (points.length === 1) {
    // A single point can't define a line or a y-scale - render just the one
    // dot, centered, rather than dividing by zero.
    return svgWrap('<circle class="chart-point" cx="50" cy="50" r="2.5"></circle>');
  }

  const weights = points.map(p => p.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const flat = maxW === minW;

  const xFor = i => PAD + (i / (points.length - 1)) * (100 - 2 * PAD);
  // Heavier weight -> higher on the chart -> smaller y. All-same-weight
  // (flat) is placed at mid-height rather than dividing by (maxW - minW) = 0.
  const yFor = w => flat
    ? 50
    : PAD + (1 - (w - minW) / (maxW - minW)) * (100 - 2 * PAD);

  const coords = points.map((p, i) => [xFor(i), yFor(p.weight)]);
  const polylinePoints = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const circles = coords.map(([x, y]) => `<circle class="chart-point" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.5"></circle>`).join('');

  return svgWrap(`<polyline class="chart-line" points="${polylinePoints}"></polyline>${circles}`);
}

/**
 * @param {string} inner
 */
function svgWrap(inner) {
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="exercise-history-svg">${inner}</svg>`;
}

export { buildWeightHistoryChart };
