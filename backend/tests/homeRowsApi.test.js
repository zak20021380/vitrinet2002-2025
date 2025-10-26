const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const ADMIN_TOKEN = jwt.sign({ id: 'admin-test', role: 'admin' }, 'vitrinet_secret_key');

async function setupServer() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'home-rows-api-'));
  process.env.HOME_ROWS_FILE = path.join(tmpDir, 'rows.json');
  process.env.HOME_ROWS_AUDIT = path.join(tmpDir, 'audit.log');
  delete require.cache[require.resolve('../utils/homeRowsStore')];
  delete require.cache[require.resolve('../controllers/homeRowsController')];
  delete require.cache[require.resolve('../routes/homeRows')];
  const router = require('../routes/homeRows');
  const app = express();
  app.use(express.json());
  app.use('/api/home/rows', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { tmpDir, server, baseUrl: `http://127.0.0.1:${port}/api/home/rows` };
}

async function teardown({ tmpDir, server }) {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmpDir, { recursive: true, force: true });
}

test('homeRows API CRUD flow', async () => {
  const ctx = await setupServer();
  try {
    const { baseUrl } = ctx;

    const initialRes = await fetch(baseUrl);
    assert.equal(initialRes.status, 200);
    const initial = await initialRes.json();
    assert.equal(Array.isArray(initial), true);
    assert.equal(initial.length, 0);

    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        title: 'ردیف اول',
        cards: [
          { title: 'کارت', linkUrl: 'https://example.com' },
        ],
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.title, 'ردیف اول');

    const updateRes = await fetch(`${baseUrl}/${created.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        title: 'ردیف ویرایش‌شده',
        cards: [
          { id: created.cards[0].id, title: 'کارت', linkUrl: 'https://example.com' },
        ],
      }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.title, 'ردیف ویرایش‌شده');

    const reorderRes = await fetch(`${baseUrl}/reorder`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({ order: [created.id] }),
    });
    assert.equal(reorderRes.status, 200);

    const deleteRes = await fetch(`${baseUrl}/${created.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
    });
    assert.equal(deleteRes.status, 204);

    const afterDelete = await fetch(baseUrl);
    const afterData = await afterDelete.json();
    assert.equal(afterData.length, 0);
  } finally {
    await teardown(ctx);
  }
});
