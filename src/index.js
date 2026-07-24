const fs = require('fs');
const path = require('path');

const { launchBrowser, openHomeAndConsent, resolveParkOptions, checkAvailability } = require('./browserSession');
const { showPopup } = require('./notifyPopup');
const { sendNtfyPush } = require('./notifyPush');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const LOG_DIR = path.join(__dirname, '..', 'logs');
const RETRY_DELAY_MS = 2 * 60 * 1000;

// The reservations site silently starts returning false "nothing available" results once a
// browser session has done "enough" searches - confirmed by testing, but the exact trigger
// isn't a clean fixed count or a clean fixed time window (looks like some kind of rate limit
// tied to request bursts). A full page reload reliably restores correct results, so rather
// than try to model the exact threshold, every single check gets a fresh session.

function log(message) {
  console.log(`[${new Date().toLocaleString()}] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadConfig() {
  let raw;
  try {
    raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  } catch (e) {
    throw new Error(`Could not find config.json at ${CONFIG_PATH}. Did you rename or move it?`);
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `config.json has a formatting mistake and could not be read: ${e.message}\n` +
        'Common causes: a missing comma between entries, or a missing quote. ' +
        'Try pasting the file into an online JSON validator to find the exact spot.'
    );
  }
  if (!Array.isArray(config.watches) || config.watches.length === 0) {
    throw new Error('config.json must have a "watches" list with at least one entry.');
  }
  for (const watch of config.watches) {
    for (const field of ['park', 'arrivalDate', 'departureDate', 'partySize', 'equipment']) {
      if (watch[field] === undefined) {
        throw new Error(`Each entry in "watches" needs a "${field}" field. Check config.json.`);
      }
    }
  }
  const notify = config.notify || {};
  return {
    checkEveryMinutes: config.checkEveryMinutes || 15,
    watches: config.watches,
    notify: {
      popup: notify.popup !== false,
      ntfyTopic: notify.ntfyTopic || '',
    },
  };
}

function saveErrorScreenshot(page, label) {
  if (!page) return Promise.resolve();
  return page
    .screenshot({ path: path.join(LOG_DIR, `error-${label}-${Date.now()}.png`) })
    .catch(() => {});
}

async function runOneCycle(page, watches, notify) {
  for (const watch of watches) {
    for (const parkOptionText of watch.resolvedParks) {
      const description = `${parkOptionText} (${watch.arrivalDate} to ${watch.departureDate})`;
      try {
        await openHomeAndConsent(page); // Fresh session per check - see note above on why.
        const result = await checkAvailability(page, watch, parkOptionText);
        if (result.available) {
          log(`AVAILABLE: ${description}`);
          const title = 'Campsite available!';
          const message = `${parkOptionText}\n${watch.arrivalDate} to ${watch.departureDate}\n\n${result.snippet}`;
          if (notify.popup) showPopup(title, message);
          if (notify.ntfyTopic) await sendNtfyPush(notify.ntfyTopic, title, message);
        } else {
          log(`not available: ${description}`);
        }
      } catch (e) {
        log(`ERROR checking ${description}: ${e.message}`);
        await saveErrorScreenshot(page, parkOptionText.replace(/[^a-z0-9]/gi, '_'));
      }
    }
  }
}

async function resolveAllParks(page, watches) {
  log('Resolving park names from config.json...');
  for (const watch of watches) {
    try {
      const options = await resolveParkOptions(page, watch.park);
      if (options.length === 0) {
        log(`WARNING: no parks matched "${watch.park}" - this watch will do nothing. Check the spelling in config.json.`);
      } else {
        log(`"${watch.park}" matched: ${options.join(', ')}`);
      }
      watch.resolvedParks = options;
    } catch (e) {
      log(`ERROR resolving "${watch.park}": ${e.message}`);
      await saveErrorScreenshot(page, 'resolve-parks');
      watch.resolvedParks = [];
    }
  }
}

// Runs one full session: launch a browser, set it up, then check forever on a timer.
// Throws if anything goes wrong so the caller can restart a fresh session.
async function runSession(config) {
  const { browser, page } = await launchBrowser({ headless: true });
  try {
    await openHomeAndConsent(page);
    await resolveAllParks(page, config.watches);

    if (config.notify.ntfyTopic) {
      log(`Sending a startup test push to ntfy topic "${config.notify.ntfyTopic}"...`);
      await sendNtfyPush(
        config.notify.ntfyTopic,
        'Park Bot started',
        'If you see this, your push notifications are set up correctly.'
      );
    }

    const intervalMs = config.checkEveryMinutes * 60 * 1000;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      log('Checking availability...');
      await runOneCycle(page, config.watches, config.notify);
      log(`Done. Next check in ${config.checkEveryMinutes} minutes. Leave this window open.`);
      await sleep(intervalMs);
    }
  } catch (e) {
    await saveErrorScreenshot(page, 'session');
    throw e;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function main() {
  fs.mkdirSync(LOG_DIR, { recursive: true });

  log('Starting park-bot...');
  const config = loadConfig(); // Fatal (and intentionally not retried) if config.json itself is broken.

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await runSession(config);
    } catch (e) {
      log(`ERROR: ${e.message}`);
      log(`Something went wrong talking to the reservations website. Will try again in ${RETRY_DELAY_MS / 60000} minutes.`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

// Last-resort safety net: a bug anywhere (e.g. a notification helper) should never be able to
// silently kill an otherwise-healthy 24/7 bot. Log it and keep running instead of crashing.
process.on('uncaughtException', (e) => {
  log(`UNEXPECTED ERROR (recovered, bot keeps running): ${e && e.stack ? e.stack : e}`);
});
process.on('unhandledRejection', (e) => {
  log(`UNEXPECTED ERROR (recovered, bot keeps running): ${e && e.stack ? e.stack : e}`);
});

main().catch((e) => {
  console.error('park-bot could not start:', e.message);
  console.error('This window will stay open so you can read the error above.');
  console.error('Press Ctrl+C to close it.');
  setInterval(() => {}, 1 << 30); // keep the process (and window) alive so the error is visible
});
