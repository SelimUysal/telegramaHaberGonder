# 📰 Automated News Delivery to Telegram

A news aggregation and delivery prototype built with **Node.js and Python**. It collects headlines and article links from multiple news websites, saves the results as JSON files, and sends new headlines to a configured **Telegram chat or channel**.

[![Watch the walkthrough](https://img.shields.io/badge/Watch_Project_Walkthrough-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=R9HX1uPrGEg)

**🎥 [Watch the project presentation on YouTube](https://www.youtube.com/watch?v=R9HX1uPrGEg)**

> **Project status:** Educational prototype. This repository requires local configuration before it can run on another computer; it is not a ready-to-deploy Telegram bot.

## ✨ What It Does

1. **Collects news** from site-specific scrapers for Sözcü, Mashable, Son Dakika, and Akit.
2. **Extracts headlines and links** from webpage content using Axios/Cheerio or Puppeteer.
3. **Saves the results** into JSON files inside a local `haber/` directory.
4. **Checks for previously sent headlines** using `sent_titles.txt` and submits new items to the Telegram Bot API.
5. **Repeats the workflow:** `always.js` runs the scrapers sequentially, launches the Python sender, and schedules another cycle approximately 20 minutes after the sender exits.

```text
News websites
      |
      v
Node.js scrapers (Axios / Cheerio / Puppeteer)
      |
      v
haber/haberler_1.json ... haberler_4.json
      |
      v
Python sender (haber-gönder.py)
      |
      +--> sent_titles.txt (previously processed titles)
      |
      v
Telegram Bot API --> Telegram chat / channel
```

## 🗂️ Repository Guide

| File | Purpose |
| --- | --- |
| `news_Sozcu.js` | Scrapes Sözcü headlines and links |
| `news_Mashable.js` | Scrapes Mashable content |
| `news_SonDakika.js` | Browser-based Son Dakika scraping |
| `news_Akit.js` | Browser-based Akit scraping |
| `haber-gönder.py` | Reads news JSON files and sends messages to Telegram |
| `always.js` | Runs the collection and sending scripts in sequence |
| `package.json` | Lists the JavaScript dependencies |

**Stack:** JavaScript, Node.js, Python, Axios, Cheerio, Puppeteer, Telegram Bot API, JSON.

## 🚀 Running the Prototype Locally

### Prerequisites

- Node.js and npm
- Python 3 and pip
- A Telegram bot and the destination chat/channel identifier
- A desktop environment capable of running browser-based Puppeteer scrapers

### 1. Get the project

```bash
git clone https://github.com/SelimUysal/telegramaHaberGonder.git
cd telegramaHaberGonder
npm install
python -m pip install requests
```

> This repository is **private**. Cloning requires an account with permission to access it.

### 2. Prepare the local environment

Create a `haber` directory in the project root if it does not exist. The scrapers write files there, and the sender expects to read files named `haberler_1.json` through `haberler_4.json`.

**Configuration required before running:**

- Set up your own Telegram bot and target chat/channel in `haber-gönder.py`. **Never publish real bot tokens or credentials.**
- Replace the machine-specific absolute Windows paths in `always.js` with paths valid on your computer (prefer paths resolved from the project directory).
- Review the individual scrapers' website URLs and CSS selectors. Website layouts change over time, so extraction may need updating.

### 3. Run and inspect the stages

You can test the source-specific scripts individually:

```bash
node news_Sozcu.js
node news_Mashable.js
node news_SonDakika.js
node news_Akit.js
```

Inspect the generated files in `haber/`, then run the Telegram sender **only after you have configured a bot and verified the intended destination**:

```bash
python haber-gönder.py
```

For the complete repeating workflow, adjust the paths in `always.js` and start:

```bash
node always.js
```

Stop the process with `Ctrl+C`. Because the orchestrator uses fixed Windows paths in its current form, **it will not work unchanged on a different computer**.

## 🔐 Security & Reliability Notes

This code is a learning prototype and should be reviewed before deployment:

- **Secrets:** The current sender stores Telegram configuration in source code. Move tokens and chat identifiers to environment variables and rotate any token that has been exposed before sharing the repository publicly.
- **HTTPS verification:** Some requests disable TLS certificate verification (`verify=False` or `rejectUnauthorized: false`). Restore certificate verification for secure use.
- **Duplicate handling:** Headlines are tracked in `sent_titles.txt`, but the current logic is not a transactional delivery guarantee; failed sends may still leave entries in the local history file.
- **Scraping compatibility:** Selectors, consent dialogs, anti-bot measures, and site terms can change. Use respectful request rates and check website rules.
- **Local setup:** This project currently has machine-specific paths, and browser-based scrapers may need manual troubleshooting.

## 📺 Project Walkthrough

A video demonstration and explanation of the original project is available here:

**[Watch on YouTube](https://www.youtube.com/watch?v=R9HX1uPrGEg)**

---

**Purpose:** Explore web scraping, data processing, task orchestration, and Telegram message automation through a practical end-to-end project.
