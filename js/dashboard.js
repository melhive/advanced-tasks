/* dashboard.js — stats view. No external chart library; bars and heatmap
   are plain DOM elements sized with CSS, so this works fully offline. */

async function renderDashboard() {
  const root = document.getElementById('dashboard-view');
  root.innerHTML = '';

  const boards = await DB.getAll('boards');
  const allCardsRaw = await DB.getAll('cards');
  const allCards = allCardsRaw.filter((c) => !c.archived);
  const allActivity = await DB.getAll('activity');

  if (!allCards.length) {
    root.appendChild(el('div', { class: 'dash-empty' }, 'No cards yet — add some tasks to see stats here.'));
    return;
  }

  const grid = el('div', { class: 'dash-grid' });

  grid.appendChild(overviewCard(boards, allCards));
  grid.appendChild(velocityCard(allActivity));
  grid.appendChild(boardDistributionCard(boards, allCards));

  const bbBoard = boards.find((b) => b.template_key === 'bug_bounty');
  if (bbBoard) {
    const bbCards = allCards.filter((c) => c.board_id === bbBoard.id);
    if (bbCards.length) grid.appendChild(tierDistributionCard(bbCards));
  }

  const trBoard = boards.find((b) => b.template_key === 'trading');
  if (trBoard) {
    const closedCol = trBoard.columns.find((c) => c.name === 'Closed');
    const trCards = closedCol ? allCards.filter((c) => c.board_id === trBoard.id && c.list === closedCol.id) : [];
    if (trCards.length) grid.appendChild(tradingStatsCard(trCards));
  }

  root.appendChild(grid);
  root.appendChild(heatmapCard(allActivity, allCards));
}

function overviewCard(boards, cards) {
  const card = el('div', { class: 'dash-card' });
  card.appendChild(el('h3', {}, 'overview'));
  const row = el('div', { style: 'display:flex; gap:24px; flex-wrap:wrap;' });
  row.appendChild(statBlock(cards.length, 'total cards'));
  row.appendChild(statBlock(boards.length, 'boards'));
  const doneCount = cards.filter((c) => {
    const b = boards.find((bd) => bd.id === c.board_id);
    const lastCol = b && b.columns[b.columns.length - 1];
    return lastCol && c.list === lastCol.id;
  }).length;
  row.appendChild(statBlock(doneCount, 'in final column'));
  card.appendChild(row);
  return card;
}

function statBlock(num, label) {
  const w = el('div');
  w.appendChild(el('div', { class: 'dash-stat-num' }, String(num)));
  w.appendChild(el('div', { class: 'dash-stat-label' }, label));
  return w;
}

function velocityCard(activity) {
  const card = el('div', { class: 'dash-card' });
  card.appendChild(el('h3', {}, 'moves this week'));
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const moves = activity.filter((a) => a.text.startsWith('moved') && new Date(a.at).getTime() > weekAgo);
  card.appendChild(statBlock(moves.length, 'cards moved in last 7 days'));
  return card;
}

function boardDistributionCard(boards, cards) {
  const card = el('div', { class: 'dash-card' });
  card.appendChild(el('h3', {}, 'cards per board'));
  const max = Math.max(1, ...boards.map((b) => cards.filter((c) => c.board_id === b.id).length));
  boards.forEach((b) => {
    const count = cards.filter((c) => c.board_id === b.id).length;
    if (!count) return;
    card.appendChild(barRow(b.name, count, max));
  });
  return card;
}

function tierDistributionCard(bbCards) {
  const card = el('div', { class: 'dash-card' });
  card.appendChild(el('h3', {}, 'bug bounty · tier distribution'));
  const tiers = ['Tier 1 — Financial', 'Tier 2 — Auth', 'Tier 3 — Data', 'Tier 4 — Input', 'Tier 5 — Infra'];
  const counts = tiers.map((t) => bbCards.filter((c) => c.custom_fields && c.custom_fields.tier === t).length);
  const max = Math.max(1, ...counts);
  tiers.forEach((t, i) => card.appendChild(barRow(t.replace(/^Tier \d — /, ''), counts[i], max)));
  return card;
}

function tradingStatsCard(closedCards) {
  const card = el('div', { class: 'dash-card' });
  card.appendChild(el('h3', {}, 'trading · closed positions'));
  const withPrices = closedCards.filter((c) => {
    const f = c.custom_fields || {};
    return f.entry_price != null && f.entry_price !== '' && f.exit_price != null && f.exit_price !== '';
  });
  const wins = withPrices.filter((c) => {
    const f = c.custom_fields;
    const isLong = f.direction !== 'Short';
    return isLong ? f.exit_price > f.entry_price : f.exit_price < f.entry_price;
  });
  const winRate = withPrices.length ? Math.round((wins.length / withPrices.length) * 100) : 0;
  const rValues = closedCards.map((c) => Number(c.custom_fields && c.custom_fields.r_multiple)).filter((n) => !isNaN(n) && n !== 0);
  const avgR = rValues.length ? (rValues.reduce((a, b) => a + b, 0) / rValues.length).toFixed(2) : '—';

  const row = el('div', { style: 'display:flex; gap:24px; flex-wrap:wrap;' });
  row.appendChild(statBlock(`${winRate}%`, 'win rate'));
  row.appendChild(statBlock(avgR, 'avg R multiple'));
  row.appendChild(statBlock(closedCards.length, 'closed trades'));
  card.appendChild(row);
  return card;
}

function barRow(label, value, max) {
  const row = el('div', { class: 'bar-row' });
  row.appendChild(el('div', { class: 'bar-label' }, label));
  const track = el('div', { class: 'bar-track' });
  const fill = el('div', { class: 'bar-fill' });
  fill.style.width = `${Math.max(4, (value / max) * 100)}%`;
  track.appendChild(fill);
  row.appendChild(track);
  row.appendChild(el('div', { class: 'bar-value' }, String(value)));
  return row;
}

function heatmapCard(activity, cards) {
  const card = el('div', { class: 'dash-card' });
  card.appendChild(el('h3', {}, 'activity — last 90 days'));

  const days = 90;
  const counts = {};
  const bump = (iso) => {
    const key = iso.slice(0, 10);
    counts[key] = (counts[key] || 0) + 1;
  };
  activity.forEach((a) => bump(a.at));
  cards.forEach((c) => bump(c.created_at));

  const cells = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ key, count: counts[key] || 0 });
  }
  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  const grid = el('div', { class: 'heatmap-grid' });
  cells.forEach((c) => {
    const intensity = c.count === 0 ? 0 : Math.min(4, Math.ceil((c.count / maxCount) * 4));
    const cell = el('div', { class: 'heatmap-cell', title: `${c.key}: ${c.count} event(s)` });
    if (intensity > 0) {
      const opacity = 0.25 + intensity * 0.18;
      cell.style.background = `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, var(--surface-3))`;
    }
    grid.appendChild(cell);
  });
  card.appendChild(grid);
  return card;
}
