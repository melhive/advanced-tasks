/* table-view.js — flat sortable table, useful once a board has too many
   cards to scan as a Kanban board, or when due dates matter more than
   column position (e.g. workout log, YouTube schedule). */

const tableViewState = { sortKey: 'due_date', sortDir: 'asc' };

function renderTableView(board, cards) {
  const wrap = el('div', { class: 'table-view-wrap' });
  const visibleCards = cards.filter((c) => !c.archived);

  const headers = [
    { key: 'title', label: 'Title' },
    { key: 'list', label: 'Column' },
    { key: 'due_date', label: 'Due' },
    { key: 'labels', label: 'Labels' },
  ];
  if (board.fields[0]) headers.push({ key: `cf:${board.fields[0].key}`, label: board.fields[0].label });
  if (board.fields[1]) headers.push({ key: `cf:${board.fields[1].key}`, label: board.fields[1].label });

  const table = el('table', { class: 'data-table' });
  const thead = el('thead');
  const headRow = el('tr');
  headers.forEach((h) => {
    const th = el('th', { class: 'sortable-th' });
    const arrow = tableViewState.sortKey === h.key ? (tableViewState.sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    th.textContent = h.label + arrow;
    th.addEventListener('click', () => {
      if (tableViewState.sortKey === h.key) tableViewState.sortDir = tableViewState.sortDir === 'asc' ? 'desc' : 'asc';
      else { tableViewState.sortKey = h.key; tableViewState.sortDir = 'asc'; }
      renderTableView(board, cards).replaceWith ? null : null;
      refreshCurrentBoardView();
    });
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const sorted = [...visibleCards].sort((a, b) => {
    const val = (c) => {
      if (tableViewState.sortKey === 'list') {
        const col = board.columns.find((cc) => cc.id === c.list);
        return col ? col.name : '';
      }
      if (tableViewState.sortKey.startsWith('cf:')) {
        const key = tableViewState.sortKey.slice(3);
        return c.custom_fields[key] ?? '';
      }
      if (tableViewState.sortKey === 'labels') return (c.label_ids || []).length;
      return c[tableViewState.sortKey] ?? '';
    };
    const av = val(a), bv = val(b);
    if (av < bv) return tableViewState.sortDir === 'asc' ? -1 : 1;
    if (av > bv) return tableViewState.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const tbody = el('tbody');
  if (!sorted.length) {
    const tr = el('tr');
    const td = el('td', { colspan: String(headers.length), class: 'dash-empty' }, 'No cards on this board yet.');
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  sorted.forEach((c) => {
    const col = board.columns.find((cc) => cc.id === c.list);
    const tr = el('tr', { class: 'data-row' });
    tr.appendChild(el('td', {}, c.title || 'Untitled'));
    tr.appendChild(el('td', {}, col ? col.name : '—'));
    tr.appendChild(el('td', {}, c.due_date ? formatDateShort(c.due_date) : '—'));

    const labelCell = el('td');
    (c.label_ids || []).forEach((lid) => {
      const lbl = board.labels.find((l) => l.id === lid);
      if (lbl) {
        const dot = el('span', { class: 'label-dot', style: `background:${lbl.color}; margin-right:4px;` });
        labelCell.appendChild(dot);
      }
    });
    tr.appendChild(labelCell);

    if (board.fields[0]) tr.appendChild(el('td', {}, String(c.custom_fields[board.fields[0].key] ?? '—')));
    if (board.fields[1]) tr.appendChild(el('td', {}, String(c.custom_fields[board.fields[1].key] ?? '—')));

    tr.addEventListener('click', () => openCardModal(c.id));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}
