/**
 * @typedef {{ date: number, weight: number }} HistoryPoint
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number }} CurveSegment
 * @typedef {{ y: number, label: number }} GridLine
 * @typedef {{ x: number, label: number, align: 'left' | 'right' }} XLabel
 * @typedef {{
 *  linePoints: Point[]
 *  curveSegments: CurveSegment[]
 *  gridLines: GridLine[]
 *  xLabels: XLabel[]
 *  plotBottom: number
 * }} ChartLayout
 */

const PAD_TOP = 22;
const PAD_BOTTOM = 24;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;

/**
 * Pure pixel-layout math for the weight-history chart - no DOM/canvas
 * access, so this stays unit-testable (per this repo's frontend-test
 * convention). Takes 2+ chronological history points and the canvas's
 * logical (CSS) pixel size, returns everything a draw layer needs: point
 * positions, a Catmull-Rom-smoothed curve through them, gridlines (max/min
 * weight, or a single one if every weight is equal), and first/last date
 * labels.
 * @param {HistoryPoint[]} points Chronological, length >= 2.
 * @param {number} width
 * @param {number} height
 * @returns {ChartLayout}
 */
function computeChartLayout(points, width, height) {
  const plotTop = PAD_TOP;
  const plotBottom = height - PAD_BOTTOM;
  const plotLeft = PAD_LEFT;
  const plotRight = width - PAD_RIGHT;

  const weights = points.map(p => p.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const flat = maxW === minW;

  const xFor = i => plotLeft + (i / (points.length - 1)) * (plotRight - plotLeft);
  const yFor = w => flat
    ? (plotTop + plotBottom) / 2
    : plotBottom - ((w - minW) / (maxW - minW)) * (plotBottom - plotTop);

  const linePoints = points.map((p, i) => ({ x: xFor(i), y: yFor(p.weight) }));

  const curveSegments = [];
  for (let i = 0; i < linePoints.length - 1; i++) {
    const p0 = linePoints[Math.max(i - 1, 0)];
    const p1 = linePoints[i];
    const p2 = linePoints[i + 1];
    const p3 = linePoints[Math.min(i + 2, linePoints.length - 1)];
    curveSegments.push({
      cp1x: p1.x + (p2.x - p0.x) / 6,
      cp1y: p1.y + (p2.y - p0.y) / 6,
      cp2x: p2.x - (p3.x - p1.x) / 6,
      cp2y: p2.y - (p3.y - p1.y) / 6,
      x: p2.x,
      y: p2.y,
    });
  }

  const gridLines = flat
    ? [{ y: yFor(maxW), label: maxW }]
    : [{ y: plotTop, label: maxW }, { y: plotBottom, label: minW }];

  const xLabels = [
    { x: linePoints[0].x, label: points[0].date, align: /** @type {'left'} */('left') },
    { x: linePoints[linePoints.length - 1].x, label: points[points.length - 1].date, align: /** @type {'right'} */('right') },
  ];

  return { linePoints, curveSegments, gridLines, xLabels, plotBottom };
}

export { computeChartLayout };
