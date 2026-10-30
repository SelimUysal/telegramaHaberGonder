const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const axios = require('axios');
const cheerio = require('cheerio');

const SOURCES = {
  sozcu: { url: 'https://www.sozcu.com.tr/', selector: '.swiper-slide a', title: ($, a) => $(a).find('img').attr('alt') },
  mashable: { url: 'https://tr.mashable.com/', selector: 'ul#wn li.blogroll a', title: ($, a) => $(a).find('.caption').text() },
  sondakika: { url: 'https://www.sondakika.com/', selector: 'li[id^="manset"] a', dynamic: true, title: ($, a) => $(a).attr('title') },
  akit: { url: 'https://www.yeniakit.com.tr/', selector: '.swiper-slide a', dynamic: true, title: ($, a) => $(a).attr('title') }
};

function normalizeUrl(href, base) {
  if (!href || typeof href !== 'string') return null;
  try {
    const u = new URL(href, base);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key)) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    return u.toString().length <= 2048 ? u.toString() : null;
  } catch { return null; }
}

function parseArticles(html, source) {
  const $ = cheerio.load(html);
  const items = new Map();
  $(source.selector).each((_index, element) => {
    const title = String(source.title($, element) || '').replace(/\s+/g, ' ').trim();
    const url = normalizeUrl($(element).attr('href'), source.url);
    if (title.length < 3 || !url || url === source.url || /manşetlerin devamı/i.test(title)) return;
    const id = crypto.createHash('sha256').update(url).digest('hex');
    items.set(id, { id, title: title.slice(0, 500), url });
  });
  return [...items.values()];
}

async function collect(id, timeout) {
  const source = SOURCES[id];
  if (!source) throw new Error('Unknown news source: ' + id);
  let html;
  if (source.dynamic) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForSelector(source.selector, { timeout: Math.min(timeout, 10000) });
      html = await page.content();
    } finally { await browser.close(); }
  } else {
    const response = await axios.get(source.url, { timeout, responseType: 'text' });
    html = response.data;
  }
  const results = parseArticles(html, source);
  if (!results.length) throw new Error('No matching headlines; check the selector');
  return results;
}

function freshState() { return { version: 1, sent: {}, pending: [] }; }
async function readState(filename) {
  try {
    const value = JSON.parse(await fs.readFile(filename, 'utf8'));
    if (value.version !== 1 || !value.sent || !Array.isArray(value.pending)) throw new Error('Invalid state');
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return freshState();
    throw error;
  }
}
async function writeState(filename, state) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const tmp = filename + '.' + process.pid + '.tmp';
  try {
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await fs.rename(tmp, filename);
  } finally { await fs.rm(tmp, { force: true }).catch(() => {}); }
}
function enqueue(state, items, maxPending = 500) {
  const seen = new Set(state.pending.map(a => a.id));
  let added = 0;
  for (const item of items) {
    if (state.sent[item.id] || seen.has(item.id) || state.pending.length >= maxPending) continue;
    state.pending.push(item); seen.add(item.id); added++;
  }
  return added;
}
async function send(article, config, fetchFn = fetch) {
  const message = '📰 ' + article.title + '\n' + article.url;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response, payload;
    try {
      response = await fetchFn('https://api.telegram.org/bot' + config.token + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: config.chatId, text: message, link_preview_options: { is_disabled: true } }),
        signal: AbortSignal.timeout(config.timeout)
      });
      payload = await response.json();
    } catch {
      if (attempt === 2) throw new Error('Telegram network failure after retries');
      await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
      continue;
    }
    if (response.ok && payload.ok === true) return payload.result;
    if (response.status !== 429 && response.status < 500) throw new Error('Telegram rejected request: HTTP ' + response.status);
    if (attempt === 2) throw new Error('Telegram temporarily unavailable: HTTP ' + response.status);
    const retry = Math.min(60, Math.max(1, Number(payload.parameters?.retry_after) || attempt + 1));
    await new Promise(resolve => setTimeout(resolve, retry * 1000));
  }
}
module.exports = { SOURCES, normalizeUrl, parseArticles, collect, freshState, readState, writeState, enqueue, send };
