const path = require('node:path');
const fs = require('node:fs/promises');
const { SOURCES, collect, readState, writeState, enqueue, send } = require('./pipeline');

function integer(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(name + ' must be between ' + min + ' and ' + max);
  return n;
}
function configFromEnv() {
  const dryRun = process.env.DRY_RUN !== 'false';
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  if (!dryRun && (!token || !chatId)) throw new Error('Telegram bot token and chat ID required for live delivery');
  const sources = [...new Set((process.env.NEWS_SOURCES || 'sozcu,mashable,sondakika,akit').split(',').map(s => s.trim()).filter(Boolean))];
  for (const id of sources) if (!SOURCES[id]) throw new Error('Unsupported source: ' + id);
  if (!sources.length) throw new Error('Select at least one source');
  return { dryRun, token, chatId, sources,
    timeout: integer('REQUEST_TIMEOUT_MS', 25000, 5000, 120000),
    interval: integer('POLL_INTERVAL_MINUTES', 20, 1, 1440) * 60000,
    limit: integer('MAX_SEND_PER_CYCLE', 15, 1, 100),
    maxPending: integer('MAX_PENDING_ITEMS', 500, 20, 100000),
    delay: integer('SEND_DELAY_MS', 1200, 1000, 60000),
    stateFile: path.resolve(process.env.STATE_FILE || 'data/state.json') };
}
function event(level, type, data = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, type, ...data }));
}
async function runCycle(config, dependencies = {}) {
  const collectFn = dependencies.collect || collect;
  const sendFn = dependencies.send || send;
  const state = config.dryRun ? null : await readState(config.stateFile);
  const summary = { collected: 0, failedSources: 0, queued: 0, sent: 0, failedMessages: 0 };
  for (const id of config.sources) {
    try {
      const articles = await collectFn(id, config.timeout);
      summary.collected += articles.length;
      if (config.dryRun) event('info', 'preview', { source: id, count: articles.length, examples: articles.slice(0, 3) });
      else {
        summary.queued += enqueue(state, articles, config.maxPending);
        await writeState(config.stateFile, state);
        event('info', 'collected', { source: id, count: articles.length });
      }
    } catch (error) {
      summary.failedSources++;
      event('warn', 'source_failed', { source: id, reason: error.message });
    }
  }
  if (!config.dryRun) {
    for (const article of state.pending.slice(0, config.limit)) {
      try {
        await sendFn(article, config);
        state.sent[article.id] = new Date().toISOString();
        state.pending = state.pending.filter(item => item.id !== article.id);
        await writeState(config.stateFile, state);
        summary.sent++;
        await new Promise(resolve => setTimeout(resolve, config.delay));
      } catch (error) {
        summary.failedMessages++;
        event('error', 'send_failed', { id: article.id, reason: error.message });
      }
    }
    summary.remaining = state.pending.length;
  }
  event('info', 'cycle_completed', summary);
  return summary;
}
async function main() {
  const config = configFromEnv();
  const lock = config.stateFile + '.lock';
  await fs.mkdir(path.dirname(lock), { recursive: true });
  let handle;
  try { handle = await fs.open(lock, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Another process may be running; inspect stale lock: ' + lock);
    throw error;
  }
  let stopping = false;
  process.on('SIGINT', () => { stopping = true; });
  process.on('SIGTERM', () => { stopping = true; });
  try {
    do {
      const started = Date.now();
      const result = await runCycle(config);
      if (process.argv.includes('--once')) {
        if (!result.collected && !result.sent) process.exitCode = 1;
        break;
      }
      if (stopping) break;
      await new Promise(resolve => setTimeout(resolve, Math.max(1000, config.interval - (Date.now() - started))));
    } while (!stopping);
  } finally { await handle.close(); await fs.rm(lock, { force: true }); }
}
if (require.main === module) main().catch(error => { event('error', 'fatal', { reason: error.message }); process.exitCode = 1; });
module.exports = { configFromEnv, runCycle, main };
