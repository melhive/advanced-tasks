/* migrate.js — brings older saved data up to the current schema.
   Runs once at startup, is idempotent (safe to run every launch),
   and never deletes user data — only reshapes it. */

async function runMigrations() {
  const boards = await DB.getAll('boards');
  const cards = await DB.getAll('cards');

  for (const board of boards) {
    let boardChanged = false;

    // 1. Columns: string[] -> [{id, name, wip_limit}]
    if (board.columns.length && typeof board.columns[0] === 'string') {
      const nameToId = {};
      board.columns = board.columns.map((name) => {
        const id = uid('col');
        nameToId[name] = id;
        return { id, name, wip_limit: null };
      });
      boardChanged = true;

      // Repoint every card in this board from column-name to column-id.
      const boardCards = cards.filter((c) => c.board_id === board.id);
      for (const card of boardCards) {
        const newId = nameToId[card.list];
        card.list = newId || board.columns[0].id;
        card._needsSave = true;
      }
    }

    // 2. Fields: board didn't used to own fields — clone from its template.
    if (!board.fields) {
      const tpl = BOARD_TEMPLATES[board.template_key] || BOARD_TEMPLATES.blank;
      board.fields = cloneFieldsForBoard(tpl.fields);
      boardChanged = true;
    }

    // 3. Labels: give existing boards a default label set if missing.
    if (!board.labels) {
      board.labels = defaultLabelsForBoard();
      boardChanged = true;
    }

    if (boardChanged) await DB.put('boards', board);
  }

  for (const card of cards) {
    let changed = !!card._needsSave;
    delete card._needsSave;

    // 4. Single checklist array -> named checklists[]
    if (card.checklist && !card.checklists) {
      card.checklists = card.checklist.length
        ? [{ id: uid('cl'), name: 'Checklist', items: card.checklist }]
        : [];
      delete card.checklist;
      changed = true;
    }
    if (!card.checklists) { card.checklists = []; changed = true; }

    // 5. New fields with safe defaults.
    if (!card.label_ids) { card.label_ids = []; changed = true; }
    if (!card.time_entries) { card.time_entries = []; changed = true; }
    if (card.blocks === undefined) { card.blocks = []; changed = true; }
    if (card.blocked_by === undefined) { card.blocked_by = []; changed = true; }
    if (card.archived === undefined) { card.archived = false; changed = true; }
    if (card.archived_at === undefined) { card.archived_at = null; changed = true; }

    if (changed) await DB.put('cards', card);
  }
}
