import { setCurrentView } from "../common/state.js";
import { syncUrl } from "../common/router.js";
import { $queryOne, $new } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { timeAgo } from "../lib/date.js";
import { apiFetchAnalyticsSummary } from "../api-caller/apiCaller.js";
import { pageTitle } from "./ui.js";


const muscleBalanceList = $queryOne('#analyticsView .muscle-balance-list');
const frequencyChart = $queryOne('#analyticsView .frequency-chart');
const personalRecordsList = $queryOne('#analyticsView .pr-list');

const DAYS_PER_WEEK = 7;

/**
 * Opens the Analytics view and loads its summary fresh every time - cheap
 * (a handful of small SQL aggregations server-side, no local caching -
 * deliberate, see CLAUDE.md's "Analytics" section for why) so it can never
 * show data that's gone stale since the last set was logged.
 */
async function openAnalytics() {
  setCurrentView('Analytics');
  pageTitle.innerText = 'Análisis';
  syncUrl('/analytics');
  await renderAnalytics();
}

async function renderAnalytics() {
  const result = await apiFetchAnalyticsSummary();
  if (!result.data) {
    _error(' __ Error fetching analytics summary', result.error);
    return;
  }
  renderMuscleBalance(result.data.muscleBalance);
  renderFrequency(result.data.frequency);
  renderPersonalRecords(result.data.personalRecords);
}

/**
 * @param {{muscle: string, sets: number}[]} balance Already sorted
 *   most-worked first by the backend.
 */
function renderMuscleBalance(balance) {
  muscleBalanceList.innerHTML = '';
  if (!balance.length) {
    muscleBalanceList.append($new({
      class: 'analytics-empty',
      text: 'Todavía no hay sets registrados en los últimos 30 días.',
    }));
    return;
  }

  const maxSets = balance[0].sets;
  balance.forEach(({ muscle, sets }) => {
    const fill = $new({ class: 'muscle-bar-fill' });
    fill.style.width = `${(sets / maxSets) * 100}%`;

    muscleBalanceList.append($new({
      class: 'muscle-balance-row',
      children: [
        $new({ class: 'muscle-name', text: muscle }),
        $new({ class: 'muscle-bar', children: [fill] }),
        $new({ class: 'muscle-count', text: String(sets) }),
      ],
    }));
  });
}

/**
 * @param {{weekStart: number, daysTrained: number}[]} frequency Oldest to
 *   newest; the last entry is the current (possibly still in-progress) week.
 */
function renderFrequency(frequency) {
  frequencyChart.innerHTML = '';
  frequency.forEach(({ daysTrained }, i) => {
    const isCurrentWeek = i === frequency.length - 1;

    const bar = $new({ class: 'frequency-bar' + (isCurrentWeek ? ' current' : '') });
    bar.style.height = `${(daysTrained / DAYS_PER_WEEK) * 100}%`;

    frequencyChart.append($new({
      class: 'frequency-col',
      children: [
        $new({ class: 'frequency-bar-track', children: [bar] }),
        $new({ class: 'frequency-count', text: String(daysTrained) }),
      ],
    }));
  });
}

/**
 * @param {{exerciseId: number, name: string, maxWeight: number, maxWeightDate: number, bestOneRepMax: number, bestOneRepMaxDate: number}[]} records
 *   Already sorted most-recent-PR-first by the backend.
 */
function renderPersonalRecords(records) {
  personalRecordsList.innerHTML = '';
  if (!records.length) {
    personalRecordsList.append($new({
      class: 'analytics-empty',
      text: 'Todavía no hay récords - registrá algunos sets.',
    }));
    return;
  }

  records.forEach(pr => {
    const mostRecentDate = Math.max(pr.maxWeightDate, pr.bestOneRepMaxDate);

    personalRecordsList.append($new({
      class: 'pr-row',
      children: [
        $new({ class: 'pr-name', text: pr.name }),
        $new({
          class: 'pr-stats',
          children: [
            $new({ class: 'pr-stat', text: `${pr.maxWeight}kg máx` }),
            $new({ class: 'pr-stat', text: `1RM est. ${pr.bestOneRepMax}kg` }),
          ],
        }),
        $new({ class: 'pr-date', text: timeAgo(new Date(mostRecentDate)) }),
      ],
    }));
  });
}


export { openAnalytics };
