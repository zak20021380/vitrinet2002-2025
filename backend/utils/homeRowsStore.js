const { readFile, writeFile, mkdir, appendFile } = require('fs/promises');
const { dirname, join } = require('path');
const crypto = require('crypto');

const DATA_FILE = process.env.HOME_ROWS_FILE || join(__dirname, '../../data/homeRows.json');
const AUDIT_FILE = process.env.HOME_ROWS_AUDIT || join(__dirname, '../../data/homeRows-audit.log');

async function ensureFile(filePath, fallback = '[]') {
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeFile(filePath, fallback, 'utf8');
    } else {
      throw err;
    }
  }
}

let queue = Promise.resolve();

function runExclusive(task) {
  queue = queue.then(() => task()).catch((err) => {
    // Reset the queue so future operations don't get stuck
    queue = Promise.resolve();
    throw err;
  });
  return queue;
}

function sanitiseText(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/[\u202E\u202D\u202A\u202B\u202C]/g, '') // remove RTL override chars
    .replace(/[<>]/g, '')
    .trim();
}

function sanitiseUrl(value) {
  const text = sanitiseText(value);
  if (!text) return '';
  try {
    const url = new URL(text, 'https://placeholder.local');
    if (!/^https?:$/i.test(url.protocol)) {
      return '';
    }
    // Preserve original absolute URLs
    if (/^https?:/i.test(text)) {
      return url.toString();
    }
    // Keep relative paths
    if (text.startsWith('/')) {
      return text;
    }
    return url.pathname + url.search + url.hash;
  } catch (err) {
    return '';
  }
}

function validateRowTitle(title, rows, currentId = null) {
  if (!title) {
    const error = new Error('ROW_TITLE_REQUIRED');
    error.statusCode = 400;
    throw error;
  }
  const normalized = title.toLowerCase();
  const hasDuplicate = rows.some((row) =>
    row.id !== currentId && row.title.toLowerCase() === normalized
  );
  if (hasDuplicate) {
    const error = new Error('ROW_TITLE_DUPLICATE');
    error.statusCode = 409;
    throw error;
  }
}

function validateCards(cards, maxCards) {
  if (!Array.isArray(cards)) {
    const error = new Error('CARDS_INVALID');
    error.statusCode = 400;
    throw error;
  }
  if (cards.length < 1) {
    const error = new Error('CARDS_MIN');
    error.statusCode = 400;
    throw error;
  }
  if (cards.length > maxCards) {
    const error = new Error('CARDS_MAX');
    error.statusCode = 400;
    throw error;
  }
}

function normaliseCardPayload(rawCard) {
  const title = sanitiseText(rawCard?.title);
  const linkUrl = sanitiseUrl(rawCard?.linkUrl);
  if (!title) {
    const error = new Error('CARD_TITLE_REQUIRED');
    error.statusCode = 400;
    throw error;
  }
  if (!linkUrl) {
    const error = new Error('CARD_LINK_REQUIRED');
    error.statusCode = 400;
    throw error;
  }
  const description = sanitiseText(rawCard?.description);
  const badge = sanitiseText(rawCard?.badge);
  const imageUrl = sanitiseUrl(rawCard?.imageUrl);
  return {
    id: rawCard?.id || crypto.randomUUID(),
    title,
    description,
    imageUrl,
    linkUrl,
    badge,
  };
}

async function loadRows() {
  await ensureFile(DATA_FILE);
  const raw = await readFile(DATA_FILE, 'utf8');
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch (err) {
    return [];
  }
}

async function saveRows(rows) {
  await ensureFile(DATA_FILE);
  await writeFile(DATA_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

async function appendAudit(entry) {
  const payload = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const line = `${JSON.stringify(payload)}\n`;
  await ensureFile(AUDIT_FILE, '');
  await appendFile(AUDIT_FILE, line, 'utf8');
}

async function getRows() {
  return loadRows();
}

async function addRow(payload, options = {}) {
  const maxCards = Number(options.maxCards || 6) || 6;
  return runExclusive(async () => {
    const rows = await loadRows();
    const title = sanitiseText(payload?.title);
    validateRowTitle(title, rows);

    const cardsInput = Array.isArray(payload?.cards) ? payload.cards : [];
    validateCards(cardsInput, maxCards);
    const cards = cardsInput.map(normaliseCardPayload);

    const now = new Date().toISOString();
    const newRow = {
      id: crypto.randomUUID(),
      title,
      cards,
      order: Number.isFinite(payload?.order) ? payload.order : rows.length,
      createdAt: now,
      updatedAt: now,
    };

    const nextRows = [...rows, newRow].sort((a, b) => a.order - b.order);
    nextRows.forEach((row, index) => {
      row.order = index;
    });

    await saveRows(nextRows);
    await appendAudit({ action: 'create', rowId: newRow.id, actorId: options.actorId, details: { title: newRow.title } });
    return newRow;
  });
}

async function updateRow(rowId, payload, options = {}) {
  const maxCards = Number(options.maxCards || 6) || 6;
  return runExclusive(async () => {
    const rows = await loadRows();
    const index = rows.findIndex((row) => row.id === rowId);
    if (index === -1) {
      const error = new Error('ROW_NOT_FOUND');
      error.statusCode = 404;
      throw error;
    }
    const title = sanitiseText(payload?.title ?? rows[index].title);
    validateRowTitle(title, rows, rowId);

    const cardsInput = Array.isArray(payload?.cards) ? payload.cards : rows[index].cards;
    validateCards(cardsInput, maxCards);
    const cards = cardsInput.map(normaliseCardPayload);

    const updated = {
      ...rows[index],
      title,
      cards,
      updatedAt: new Date().toISOString(),
    };

    if (Number.isFinite(payload?.order)) {
      updated.order = payload.order;
    }

    const nextRows = [...rows];
    nextRows[index] = updated;
    nextRows.sort((a, b) => a.order - b.order);
    nextRows.forEach((row, idx) => {
      row.order = idx;
    });

    await saveRows(nextRows);
    await appendAudit({ action: 'update', rowId, actorId: options.actorId, details: { title: updated.title } });
    return updated;
  });
}

async function removeRow(rowId, options = {}) {
  return runExclusive(async () => {
    const rows = await loadRows();
    const index = rows.findIndex((row) => row.id === rowId);
    if (index === -1) {
      const error = new Error('ROW_NOT_FOUND');
      error.statusCode = 404;
      throw error;
    }
    const [removed] = rows.splice(index, 1);
    rows.sort((a, b) => a.order - b.order);
    rows.forEach((row, idx) => {
      row.order = idx;
    });
    await saveRows(rows);
    await appendAudit({ action: 'delete', rowId, actorId: options.actorId, details: { title: removed.title } });
    return removed;
  });
}

async function reorderRows(ids, options = {}) {
  if (!Array.isArray(ids) || !ids.length) {
    const error = new Error('REORDER_PAYLOAD_INVALID');
    error.statusCode = 400;
    throw error;
  }
  return runExclusive(async () => {
    const rows = await loadRows();
    if (ids.length !== rows.length || new Set(ids).size !== ids.length) {
      const error = new Error('REORDER_IDS_MISMATCH');
      error.statusCode = 400;
      throw error;
    }
    const map = new Map(rows.map((row) => [row.id, row]));
    const nextRows = ids.map((id, index) => {
      const row = map.get(id);
      if (!row) {
        const error = new Error('ROW_NOT_FOUND');
        error.statusCode = 404;
        throw error;
      }
      return { ...row, order: index, updatedAt: new Date().toISOString() };
    });
    await saveRows(nextRows);
    await appendAudit({ action: 'reorder', actorId: options.actorId, details: { order: ids } });
    return nextRows;
  });
}

module.exports = {
  getRows,
  addRow,
  updateRow,
  removeRow,
  reorderRows,
  sanitiseText,
  sanitiseUrl,
  normaliseCardPayload,
};
