import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeChartLayout } from '../js/lib/chartLayout.js';


const W = 400;
const H = 150;

test('linePoints has one entry per input point', () => {
  const layout = computeChartLayout(
    [{ date: 1, weight: 40 }, { date: 2, weight: 50 }, { date: 3, weight: 45 }],
    W, H
  );
  assert.equal(layout.linePoints.length, 3);
});

test('heavier weight yields a smaller y (higher on the chart)', () => {
  const layout = computeChartLayout([{ date: 1, weight: 40 }, { date: 2, weight: 80 }], W, H);
  assert.ok(layout.linePoints[1].y < layout.linePoints[0].y);
});

test('a flat (all-equal) weight series yields exactly one gridline and no NaN coordinates', () => {
  const layout = computeChartLayout([{ date: 1, weight: 40 }, { date: 2, weight: 40 }, { date: 3, weight: 40 }], W, H);
  assert.equal(layout.gridLines.length, 1);
  assert.equal(layout.gridLines[0].label, 40);
  assert.ok(layout.linePoints.every(p => !Number.isNaN(p.x) && !Number.isNaN(p.y)));
});

test('a non-flat series yields two gridlines labeled with the max and min weight', () => {
  const layout = computeChartLayout(
    [{ date: 1, weight: 40 }, { date: 2, weight: 60 }, { date: 3, weight: 50 }],
    W, H
  );
  assert.equal(layout.gridLines.length, 2);
  assert.equal(layout.gridLines[0].label, 60);
  assert.equal(layout.gridLines[1].label, 40);
});

test('curveSegments has one fewer entry than the number of points', () => {
  const layout = computeChartLayout(
    [{ date: 1, weight: 40 }, { date: 2, weight: 50 }, { date: 3, weight: 45 }, { date: 4, weight: 55 }],
    W, H
  );
  assert.equal(layout.curveSegments.length, 3);
});

test('each curve segment ends exactly at its corresponding line point', () => {
  const layout = computeChartLayout(
    [{ date: 1, weight: 40 }, { date: 2, weight: 50 }, { date: 3, weight: 45 }],
    W, H
  );
  layout.curveSegments.forEach((seg, i) => {
    assert.equal(seg.x, layout.linePoints[i + 1].x);
    assert.equal(seg.y, layout.linePoints[i + 1].y);
  });
});

test('xLabels has exactly two entries, at the first and last point, aligned inward', () => {
  const points = [{ date: 100, weight: 40 }, { date: 200, weight: 50 }, { date: 300, weight: 45 }];
  const layout = computeChartLayout(points, W, H);
  assert.equal(layout.xLabels.length, 2);
  assert.equal(layout.xLabels[0].label, 100);
  assert.equal(layout.xLabels[0].align, 'left');
  assert.equal(layout.xLabels[0].x, layout.linePoints[0].x);
  assert.equal(layout.xLabels[1].label, 300);
  assert.equal(layout.xLabels[1].align, 'right');
  assert.equal(layout.xLabels[1].x, layout.linePoints[2].x);
});
