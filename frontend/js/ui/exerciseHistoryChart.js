import { $new, getCssVar } from "../lib/dom.js";
import { timeAgo } from "../lib/date.js";
import { computeChartLayout } from "../lib/chartLayout.js";

/**
 * @typedef {import("../lib/chartLayout.js").HistoryPoint} HistoryPoint
 */

const GRID_COLOR = '--surface-3';
const LABEL_COLOR = '--text-muted';
const LINE_COLOR = '--accent';
const POINT_COLOR = '--accent-strong';
const RING_COLOR = '--surface-1';

const POINT_RADIUS = 4.5; // >= 8px diameter, per the dataviz skill's marker spec
const RING_PADDING = 2; // 2px surface-color ring around each point

/**
 * Tracks the last-rendered points per container so a window resize can
 * redraw at the new size. A plain Map (not a WeakMap) is fine and needs to
 * be, since redraw-on-resize requires iterating it - this app only ever
 * has the one persistent .exercise-history-chart container queried once at
 * module load in set-ui.js, not dynamically created/destroyed nodes, so
 * there's nothing here for a WeakMap's GC behavior to actually help with.
 * @type {Map<HTMLElement, HistoryPoint[]>}
 */
const lastPointsByContainer = new Map();

/**
 * @param {string} hex
 * @param {number} alpha
 */
function hexToRgba(hex, alpha) {
  const clean = hex.trim().replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Renders the weight-history chart into `container` (expected to have an
 * explicit CSS height, e.g. .exercise-history-chart) as a <canvas>, replacing
 * any previous content. Always fully redraws from scratch - this app's data
 * volumes (a few dozen sessions at most) make incremental updates pointless.
 * @param {HTMLElement} container
 * @param {HistoryPoint[]} points Chronological, length >= 2.
 */
function renderWeightHistoryChart(container, points) {
  lastPointsByContainer.set(container, points);
  container.innerHTML = '';

  /** @type {HTMLCanvasElement} */ // @ts-ignore
  const canvas = $new({ tag: 'canvas', class: 'exercise-history-canvas' });
  canvas.dataset.points = String(points.length);
  container.append(canvas);

  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (width === 0 || height === 0) { return; } // container not laid out yet - nothing to draw

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) { return; }
  ctx.scale(dpr, dpr);

  const layout = computeChartLayout(points, width, height);
  paint(ctx, layout, width, height);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import("../lib/chartLayout.js").ChartLayout} layout
 * @param {number} width
 * @param {number} height
 */
function paint(ctx, layout, width, height) {
  const gridColor = getCssVar(GRID_COLOR);
  const labelColor = getCssVar(LABEL_COLOR);
  const lineColor = getCssVar(LINE_COLOR);
  const pointColor = getCssVar(POINT_COLOR);
  const ringColor = getCssVar(RING_COLOR);

  ctx.clearRect(0, 0, width, height);
  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'middle';

  // Gridlines + their max/min weight labels.
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = labelColor;
  for (const grid of layout.gridLines) {
    ctx.beginPath();
    ctx.moveTo(0, grid.y);
    ctx.lineTo(width, grid.y);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillText(`${grid.label}kg`, 0, grid.y - 7);
  }

  // Gradient area fill under the curve.
  ctx.beginPath();
  ctx.moveTo(layout.linePoints[0].x, layout.linePoints[0].y);
  for (const seg of layout.curveSegments) {
    ctx.bezierCurveTo(seg.cp1x, seg.cp1y, seg.cp2x, seg.cp2y, seg.x, seg.y);
  }
  ctx.lineTo(layout.linePoints[layout.linePoints.length - 1].x, layout.plotBottom);
  ctx.lineTo(layout.linePoints[0].x, layout.plotBottom);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, layout.gridLines[0]?.y ?? 0, 0, layout.plotBottom);
  gradient.addColorStop(0, hexToRgba(lineColor, 0.10));
  gradient.addColorStop(1, hexToRgba(lineColor, 0));
  ctx.fillStyle = gradient;
  ctx.fill();

  // The curve itself.
  ctx.beginPath();
  ctx.moveTo(layout.linePoints[0].x, layout.linePoints[0].y);
  for (const seg of layout.curveSegments) {
    ctx.bezierCurveTo(seg.cp1x, seg.cp1y, seg.cp2x, seg.cp2y, seg.x, seg.y);
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Point markers: a surface-color ring behind an accent-strong dot.
  for (const p of layout.linePoints) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, POINT_RADIUS + RING_PADDING, 0, Math.PI * 2);
    ctx.fillStyle = ringColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = pointColor;
    ctx.fill();
  }

  // First/last date labels.
  ctx.fillStyle = labelColor;
  for (const xLabel of layout.xLabels) {
    ctx.textAlign = xLabel.align;
    ctx.fillText(timeAgo(new Date(xLabel.label)), xLabel.x, layout.plotBottom + 14);
  }
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    for (const [container, points] of lastPointsByContainer) {
      if (document.body.contains(container)) {
        renderWeightHistoryChart(container, points);
      }
    }
  }, 150);
});

export { renderWeightHistoryChart };
