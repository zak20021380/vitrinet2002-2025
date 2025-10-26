const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function setupStore() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'home-rows-'));
  process.env.HOME_ROWS_FILE = path.join(tmpDir, 'rows.json');
  process.env.HOME_ROWS_AUDIT = path.join(tmpDir, 'audit.log');
  delete require.cache[require.resolve('../utils/homeRowsStore')];
  const store = require('../utils/homeRowsStore');
  return { tmpDir, store };
}

async function cleanup(tmpDir) {
  await rm(tmpDir, { recursive: true, force: true });
}

test('homeRowsStore adds and retrieves rows with sanitisation', async () => {
  const { tmpDir, store } = await setupStore();
  try {
    const payload = {
      title: '  ردیف تست  ',
      cards: [
        {
          title: 'کارت 1<script>alert(1)</script>',
          linkUrl: 'https://example.com/page',
          description: ' تست ',
        },
      ],
    };
    const created = await store.addRow(payload, { actorId: 'admin-1' });
    assert.ok(created.id, 'should assign id');
    assert.equal(created.title, 'ردیف تست');
    assert.equal(created.cards[0].title.includes('<'), false);

    const rows = await store.getRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, 'ردیف تست');
  } finally {
    await cleanup(tmpDir);
  }
});

test('homeRowsStore prevents duplicate titles', async () => {
  const { tmpDir, store } = await setupStore();
  try {
    const cards = [
      { title: 'A', linkUrl: 'https://example.com/a' },
    ];
    await store.addRow({ title: 'دسته', cards });
    await assert.rejects(
      () => store.addRow({ title: 'دسته', cards }),
      (err) => err.message === 'ROW_TITLE_DUPLICATE'
    );
  } finally {
    await cleanup(tmpDir);
  }
});

test('homeRowsStore enforces card limits', async () => {
  const { tmpDir, store } = await setupStore();
  try {
    const cards = new Array(7).fill(0).map((_, idx) => ({
      title: `کارت ${idx}`,
      linkUrl: 'https://example.com/' + idx,
    }));
    await assert.rejects(
      () => store.addRow({ title: 'بیش از حد', cards }, { maxCards: 6 }),
      (err) => err.message === 'CARDS_MAX'
    );
  } finally {
    await cleanup(tmpDir);
  }
});
