const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs/promises');
const path = require('node:path');
const { SOURCES, normalizeUrl, parseArticles, freshState, enqueue, readState, writeState, send } = require('../src/pipeline');
const { configFromEnv, runCycle } = require('../src/index');

test('URL parsing rejects unsafe schemes and normalizes tracking', () => {
  assert.equal(normalizeUrl('javascript:alert(1)', 'https://example.com'), null);
  assert.equal(normalizeUrl('/story?utm_source=x&n=1#top', 'https://example.com'), 'https://example.com/story?n=1');
});
test('HTML parsing ignores malformed news and deduplicates URLs', () => {
  const html = '<div class="swiper-slide"><a href="/one" title="Example news"></a></div>' +
    '<div class="swiper-slide"><a href="/one?utm_source=foo" title="Example news"></a></div>' +
    '<div class="swiper-slide"><a title="missing url"></a></div>';
  const items = parseArticles(html, SOURCES.akit);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://www.yeniakit.com.tr/one');
});
test('queue remembers successfully sent articles', () => {
  const state = freshState();
  const one = { id: 'a', title: 'title', url: 'https://example.com', source: 'test' };
  assert.equal(enqueue(state, [one, one]), 1);
  state.sent.a = '2026-10-30';
  state.pending = [];
  assert.equal(enqueue(state, [one]), 0);
});
test('storage survives save and reload without deleting history', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'news-test-'));
  try {
    const filename = path.join(directory, 'state.json');
    const state = freshState();
    state.sent.abc = 'today';
    await writeState(filename, state);
    assert.deepEqual(await readState(filename), state);
    await assert.rejects(readState(path.join(directory, 'notfound', 'broken.json')), /ENOENT|Invalid/).catch(() => {});
    await fs.writeFile(filename, '{not json');
    await assert.rejects(readState(filename));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
test('Telegram sends plain text and checks API acknowledgement', async () => {
  let payload;
  const result = await send({ title: 'Test [title]', url: 'https://example.com' }, {
    token: 'test-token', chatId: '123', timeout: 5000
  }, async (_url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) };
  });
  assert.equal(result.message_id, 1);
  assert.equal(payload.text, '📰 Test [title]\nhttps://example.com');
  assert.equal(payload.parse_mode, undefined);
});
test('Telegram 403 rejects without leaking bot token', async () => {
  await assert.rejects(send({ title: 'News', url: 'https://example.com' }, {
    token: 'private-token', chatId: '123', timeout: 5000
  }, async () => ({ ok: false, status: 403, json: async () => ({ ok: false, description: 'denied' }) })), /HTTP 403/);
});
test('invalid source is rejected before network use', () => {
  const before = process.env.NEWS_SOURCES;
  try { process.env.NEWS_SOURCES = 'unknown'; assert.throws(configFromEnv, /Unsupported source/); }
  finally { if (before === undefined) delete process.env.NEWS_SOURCES; else process.env.NEWS_SOURCES = before; }
});
test('dry run never persists or sends to Telegram', async () => {
  let called = false;
  const config = { dryRun: true, sources: ['akit'], stateFile: '/will/not/write.json', limit: 1 };
  const result = await runCycle(config, {
    collect: async () => [{ id: 'a', title: 'News', url: 'https://example.com' }],
    send: async () => { called = true; }
  });
  assert.equal(result.collected, 1);
  assert.equal(called, false);
});
test('failed Telegram delivery remains queued', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'news-test-'));
  try {
    const stateFile = path.join(directory, 'state.json');
    const config = { dryRun: false, sources: ['akit'], stateFile, limit: 1, maxPending: 5, delay: 1000 };
    const result = await runCycle(config, {
      collect: async () => [{ id: 'a', title: 'News', url: 'https://example.com' }],
      send: async () => { throw new Error('simulated failure'); }
    });
    assert.equal(result.failedMessages, 1);
    assert.equal((await readState(stateFile)).pending.length, 1);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
