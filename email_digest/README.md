# Free Daily News Email Digest

This optional, separate implementation does **not** send to Telegram. It collects selected RSS/Atom sources, applies Turkish-friendly keyword filters and date rules, removes previously delivered URLs and formats one HTML/text daily email. Written in Python 3.12+ **with standard library only**. No database, external email API subscription or paid host required.

## Status: SAFE / NOT YET CONFIGURED

The default `config.json` has `enabled: false` and no sources. The GitHub Actions workflow supports manual execution only; scheduling and sending are deliberately disabled until a personal source list and email delivery setup are ready.

## Set your sources and filtering later

Edit `email_digest/config.json`. Example structure (fictional URLs; replace with valid RSS/Atom feeds):

```json
{
  "enabled": true,
  "time_zone": "Europe/Istanbul",
  "lookback_hours": 36,
  "max_items": 20,
  "allow_undated": false,
  "include_keywords": ["yapay zeka", "LLM", "yazılım"],
  "exclude_keywords": ["reklam"],
  "sources": [
    {
      "name": "My selected publication",
      "url": "https://example.com/rss.xml",
      "include_keywords": [],
      "exclude_keywords": []
    }
  ]
}
```

An empty global include list means all topics; specifying words matches **any** word/phrase in title or summary, case-insensitively with Turkish character normalization. A source's include list further narrows the global rule; all exclude lists are applied. Missing article publication dates are rejected by default to prevent old content from repeatedly appearing. Only valid RSS/Atom feed URLs are supported at this stage. Respect publisher terms and use official feeds when possible.

## Local testing (never sends in preview)

```bash
python -m unittest discover -s email_digest/tests -v
python -m email_digest
```

After source configuration, the second command previews matching article titles without sending or modifying history.

## Gmail SMTP (later, when ready)

Create a separate Gmail app password where Google allows it, and store the values in GitHub repository **Settings → Secrets and variables → Actions**:
- `DIGEST_SMTP_USER`: your Gmail sending address
- `DIGEST_SMTP_PASSWORD`: your Gmail app password (not your normal password)
- `DIGEST_EMAIL_TO`: recipient address

When using locally, the application reads `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_TO` and defaults to `smtp.gmail.com:465`. The send command is `python -m email_digest --send`, but it will do nothing while the configuration is disabled. Never commit real credentials or put them into YAML.

## Scheduled operation and state (important)

GitHub Actions schedules execute **only on the repository's default branch**. The feature branch is intended for review and development. The commented-out schedule is an example; it is not running. A daily cron must only be enabled after secrets and test email are verified.

The email sender creates a local sent-ID history **after** SMTP accepts the message. GitHub-hosted runners are ephemeral, so for real daily use a persistence workflow must be configured and verified first. Otherwise duplicate emails may be sent on later days. Prefer a dedicated repository and a private, appropriately secured persistent state mechanism. Do not rely on runner-local files persisting between Actions runs. This infrastructure does not yet have that persistent workflow connected.

SMTP acceptance does not guarantee the email reached the inbox. Retry and duplicate behavior are best-effort; exact-once delivery is impossible to guarantee with SMTP and runner restarts. Scheduled Actions can also be delayed, and public repository schedules may be disabled after inactivity.

## Layout

- `collector.py`: RSS/Atom parsing, date checks, keyword filters, safe URL normalization
- `delivery.py`: plaintext and HTML email, SMTP, file-backed history
- `main.py`: preview/live command and isolated source handling
- `tests/`: offline regression suite

The Telegram implementation under `src/` is untouched.


## Smithsonian Mind & Body pilot (2026-10-30)

The pilot source is configured in `config.json` as:

- URL: `https://www.smithsonianmag.com/category/mind-body/`
- Collector mode: `smithsonian_category` (HTML links plus individual article metadata; not an unverified category RSS feed)
- Freshness window: **45 days** per source; this does NOT limit fast RSS sources to the same window.
- Maximum category articles inspected per run: 12.
- Global topic filters are currently empty: all topics in this category are eligible.
- **Example article for regression fixtures:** `This Lollipop Could Help Blind Women Independently Detect Pregnancy` (2026-10-06). This example is NOT hardcoded as a message to send.

The HTML collector is best-effort. Sites can change templates, pagination, publication markup or return blocking responses; the available tests use offline fixtures, NOT proof that every current live Smithsonian article is extracted. If the HTML structure changes the collector will fail rather than quietly report zero results.

### Fast-moving sources later

Add future RSS/Atom sources with `"mode": "rss"` and for example `"lookback_hours": 36`; the Smithsonian category retains `"lookback_hours": 1080`. Every delivered article is identified by a normalized URL hash, not by calendar date alone. Collection frequency, the RSS feed's page depth, and durable state across GitHub Actions runs still determine whether high-volume feeds can be covered without gaps. For busy sources a daily run might miss older items pushed out of the feed; increase polling frequency and provide durable history before enabling them.

**Operational status:** the pilot is configured for local preview, but automated production delivery remains disabled. The manual workflow and CI do not send emails. No scheduled run is enabled until the user supplies email configuration and persistent delivery state is wired and verified.
