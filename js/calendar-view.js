/* calendar-view.js — month grid keyed off card.due_date. Good fit for the
   workout board (planned sessions) and YouTube board (publish dates). */

const calendarViewState = { monthDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1) };

function renderCalendarView(board, cards) {
  const wrap = el('div', { class: 'calendar-view-wrap' });
  const visibleCards = cards.filter((c) => !c.archived && c.due_date);

  const nav = el('div', { class: 'calendar-nav' });
  const prevBtn = el('button', { class: 'icon-btn' }, '‹');
  const nextBtn = el('button', { class: 'icon-btn' }, '›');
  const label = el('div', { class: 'calendar-month-label' },
    calendarViewState.monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
  prevBtn.addEventListener('click', () => {
    calendarViewState.monthDate = new Date(calendarViewState.monthDate.getFullYear(), calendarViewState.monthDate.getMonth() - 1, 1);
    refreshCurrentBoardView();
  });
  nextBtn.addEventListener('click', () => {
    calendarViewState.monthDate = new Date(calendarViewState.monthDate.getFullYear(), calendarViewState.monthDate.getMonth() + 1, 1);
    refreshCurrentBoardView();
  });
  nav.appendChild(prevBtn); nav.appendChild(label); nav.appendChild(nextBtn);
  wrap.appendChild(nav);

  const grid = el('div', { class: 'calendar-grid' });
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) => {
    grid.appendChild(el('div', { class: 'calendar-dow' }, d));
  });

  const year = calendarViewState.monthDate.getFullYear();
  const month = calendarViewState.monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cardsByDay = {};
  visibleCards.forEach((c) => {
    const key = c.due_date.slice(0, 10);
    (cardsByDay[key] = cardsByDay[key] || []).push(c);
  });

  for (let i = 0; i < startOffset; i++) grid.appendChild(el('div', { class: 'calendar-cell empty' }));

  const todayKey = new Date().toISOString().slice(0, 10);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const key = dateObj.toISOString().slice(0, 10);
    const cell = el('div', { class: 'calendar-cell' + (key === todayKey ? ' today' : '') });
    cell.appendChild(el('div', { class: 'calendar-day-num' }, String(day)));
    (cardsByDay[key] || []).slice(0, 3).forEach((c) => {
      const chip = el('div', { class: 'calendar-card-chip' }, c.title || 'Untitled');
      chip.addEventListener('click', () => openCardModal(c.id));
      cell.appendChild(chip);
    });
    if ((cardsByDay[key] || []).length > 3) {
      cell.appendChild(el('div', { class: 'calendar-more' }, `+${cardsByDay[key].length - 3} more`));
    }
    grid.appendChild(cell);
  }

  wrap.appendChild(grid);
  return wrap;
}
