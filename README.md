# Telegram News Aggregator

A multi-source news scraping and Telegram delivery pipeline built with Node.js. Reads headlines from Sözcü, Mashable Türkiye, Son Dakika and Yeni Akit. Source HTML structures change; some sources may need selector maintenance.

**Status:** Refactored educational project. Use at your own risk. Publishing is OFF by default. There are no credentials in this repository.

[Original project walkthrough](https://www.youtube.com/watch?v=R9HX1uPrGEg)

## Requirements

- Node.js 22 or newer, npm
- Chromium prerequisites for Puppeteer if using browser-based sources
- A Telegram bot token and chat/channel ID only when publishing

## Start safely

```sh
git clone https://github.com/SelimUysal/telegramaHaberGonder.git
cd telegramaHaberGonder
npm ci
cp .env.example .env
# Load your .env into your shell using your preferred environment manager.
npm run once
```

Node.js does not automatically load `.env` when running the `npm` scripts. On Node.js 22, a simple alternative is:

```sh
node --env-file=.env src/index.js --once
```

To preview without Telegram: leave `DRY_RUN=true`. This prints up to three examples per source but neither sends nor creates a delivery backlog.

For real publishing, create a **new** bot token via BotFather (do not reuse historical keys), grant it posting permissions in the destination channel/chat, and set `DRY_RUN=false`, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in your untracked local `.env`. Run:

```sh
node --env-file=.env src/index.js --once
# Or continuously:
node --env-file=.env src/index.js
```

Set `NEWS_SOURCES` to a comma-separated subset of `sozcu,mashable,sondakika,akit`. To reduce browser requirements, start with `NEWS_SOURCES=sozcu,mashable`.

## Security and reliability

- **No embedded secrets:** values come from environment variables. `.env` is ignored by Git. Rotate any bot token previously committed; removing it from new files does not revoke it.
- **TLS verification and Chromium sandbox enabled by default.** Browsers in restrictive containers may fail to launch. Do not disable the sandbox on an untrusted host to bypass a setup issue.
- **Durable queue:** pending items persist in `data/state.json`; a message is marked sent only after Telegram acknowledges success. Failed requests remain pending for later retries.
- **At-least-once delivery:** if a process terminates just after Telegram accepts a message but before writing state, duplicate delivery is possible.
- **Single-process lock:** `data/state.json.lock` avoids simultaneous processes writing state. If interrupted abnormally, check the process is stopped before removing the stale lock.
- **Dry-run does not persist state.** Test with it first.
- **Bounded collection and dispatch:** request timeouts, a maximum pending backlog, a maximum messages per cycle, and minimum delay between messages.
- **Source outages are isolated:** one failed website does not prevent others from being collected. Watch logs for `source_failed`; empty selectors are treated as failures rather than successful empty results.
- **Privacy:** runtime state and `.env` are not tracked by Git. Do not publish bot tokens in issues, logs or screenshots.
- **Respect source terms and robots policies.** Prefer official RSS/APIs when available. Do not use this tool to bypass site access restrictions.

## Configuration

| Name | Default | Meaning |
|---|---|---|
| `DRY_RUN` | `true` | Only literal `false` enables sending |
| `TELEGRAM_BOT_TOKEN` | empty | New BotFather token |
| `TELEGRAM_CHAT_ID` | empty | Destination chat/channel |
| `NEWS_SOURCES` | all four | Comma-separated sources |
| `POLL_INTERVAL_MINUTES` | `20` | Scheduling interval |
| `REQUEST_TIMEOUT_MS` | `25000` | Request timeout |
| `MAX_SEND_PER_CYCLE` | `15` | Limit items per cycle |
| `MAX_PENDING_ITEMS` | `500` | Queue size cap |
| `SEND_DELAY_MS` | `1200` | Minimum interval after successful send |
| `STATE_FILE` | `data/state.json` | Persistent state file |

## Development and tests

```sh
npm ci
npm test
npm run check
```

`src/pipeline.js` provides selectors, URL normalization, collection, queue and transport; `src/index.js` provides the scheduler. `tests/pipeline.test.js` uses fixtures and simulated failures; no Telegram bot account is required.

The legacy Node/Python prototype was retained in Git history. The new implementation uses Node.js as the single runtime. Its functionality must be assessed against live website updates before treating it as production-ready.

## Known limitations

- Site CSS selectors can break when publishers redesign their pages.
- This file-backed queue is intended for one process and small workloads, not high-availability distributed delivery.
- Automatic retries cannot guarantee exactly-once message delivery.
- No unattended publishing is configured; no GitHub Actions workflow sends Telegram messages.
