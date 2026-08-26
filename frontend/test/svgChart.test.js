import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeightHistoryChart } from '../js/lib/svgChart.js';


test('returns empty string for zero points', () => {
  assert.equal(buildWeightHistoryChart([]), '');
});

test('renders a single centered point for one data point', () => {
  const svg = buildWeightHistoryChart([{ date: 1, weight: 50 }]);
  assert.match(svg, /<circle/);
  assert.doesNotMatch(svg, /<polyline/);
});

test('renders a polyline with one point per input for 2+ points', () => {
  const svg = buildWeightHistoryChart([
    { date: 1, weight: 40 }, { date: 2, weight: 50 }, { date: 3, weight: 45 },
  ]);
  const pointsAttr = svg.match(/points="([^"]+)"/)[1];
  assert.equal(pointsAttr.trim().split(' ').length, 3);
});

test('does not divide by zero when every weight is identical (flat line)', () => {
  const svg = buildWeightHistoryChart([{ date: 1, weight: 40 }, { date: 2, weight: 40 }]);
  assert.doesNotMatch(svg, /NaN/);
});

test('heavier weight yields a smaller y-coordinate (higher on the chart)', () => {
  const svg = buildWeightHistoryChart([{ date: 1, weight: 40 }, { date: 2, weight: 80 }]);
  const coords = [...svg.matchAll(/cx="([\d.]+)" cy="([\d.]+)"/g)].map(m => [+m[1], +m[2]]);
  assert.ok(coords[1][1] < coords[0][1]);
});
