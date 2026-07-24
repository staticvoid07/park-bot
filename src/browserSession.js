const { chromium } = require('playwright');

const BASE_URL = 'https://reservations.ontarioparks.ca/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseIsoDate(isoStr) {
  const [year, month, day] = isoStr.split('-').map(Number);
  return { year, month, day }; // month is 1-based here
}

async function launchBrowser({ headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  return { browser, context, page };
}

async function detectWaitingRoom(page) {
  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const title = await page.title().catch(() => '');
  const haystack = `${title}\n${bodyText}`.toLowerCase();
  if (haystack.includes('queue-it') || haystack.includes('waiting room') || haystack.includes('you are in line')) {
    return true;
  }
  return false;
}

async function openHomeAndConsent(page) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 45000 });

    // The same page/context is reused across every check in a session, so once the consent
    // cookie is set it stays set - no need to keep re-attempting clicks (previously up to four
    // 3-second timeouts, ~12s wasted) on a banner that's already gone after the first check.
    if (!page.__consentHandled) {
      for (const consentText of ['text=I Consent', 'text=Accept', 'text=Accept All', 'text=I Agree']) {
        try {
          await page.click(consentText, { timeout: 800 });
          break;
        } catch (e) {
          // That particular consent wording wasn't shown - try the next, or none may be needed.
        }
      }
      page.__consentHandled = true;
    }

    try {
      await page.waitForSelector('#park-autocomplete-input', { timeout: 20000 });
      return; // Page loaded and the search form is ready.
    } catch (e) {
      const inWaitingRoom = await detectWaitingRoom(page);
      if (inWaitingRoom) {
        throw new Error(
          'The reservations site is showing a waiting room / queue (it does this during high-traffic periods). Will retry next cycle.'
        );
      }
      if (attempt === 3) {
        throw new Error(
          `The reservations site did not show its search form after ${attempt} attempts. It may be slow, down, or its layout may have changed.`
        );
      }
      // Otherwise, loop around and try loading the page again.
    }
  }
}

async function resolveParkOptions(page, searchTerm) {
  await page.click('#park-autocomplete-input');
  await page.fill('#park-autocomplete-input', '');
  await page.fill('#park-autocomplete-input', searchTerm);
  await page.waitForSelector('[role="option"]', { timeout: 5000 }).catch(() => {});
  const options = await page.$$eval('[role="option"]', (els) => els.map((e) => e.textContent.trim()));
  await page.keyboard.press('Escape').catch(() => {});
  return options;
}

async function readCurrentCalendarMonth(page) {
  const label = await page.getAttribute('#monthDropdownPicker', 'aria-label');
  const match = label && label.match(/^([A-Za-z]+) (\d{4}),/);
  if (!match) throw new Error(`Could not read calendar month from label: ${label}`);
  return { monthIndex: MONTH_NAMES.indexOf(match[1]), year: Number(match[2]) };
}

async function navigateCalendarToMonth(page, targetYear, targetMonthIndex) {
  for (let guard = 0; guard < 36; guard += 1) {
    const { monthIndex, year } = await readCurrentCalendarMonth(page);
    const currentTotal = year * 12 + monthIndex;
    const targetTotal = targetYear * 12 + targetMonthIndex;
    if (currentTotal === targetTotal) return;
    const buttonClass = currentTotal < targetTotal ? 'button.next-button' : 'button.prev-button';
    await page.click(buttonClass);
    await page.waitForTimeout(150);
  }
  throw new Error('Could not navigate the date picker to the target month after 36 attempts');
}

async function clickCalendarDay(page, { year, month, day }) {
  const label = `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
  await page.click(`button[aria-label="${label}"]`, { timeout: 8000 });
}

async function setDateRange(page, arrivalIso, departureIso) {
  await page.click('#arrival-date-field');
  await page.waitForSelector('#monthDropdownPicker', { timeout: 5000 });

  const arrival = parseIsoDate(arrivalIso);
  const departure = parseIsoDate(departureIso);

  await navigateCalendarToMonth(page, arrival.year, arrival.month - 1);
  await clickCalendarDay(page, arrival);
  await page.waitForTimeout(200);

  await navigateCalendarToMonth(page, departure.year, departure.month - 1);
  await clickCalendarDay(page, departure);
  await page.waitForTimeout(200);

  await page.keyboard.press('Escape').catch(() => {});
}

async function setEquipment(page, equipmentLabel) {
  await page.click('#equipment-field');
  await page.waitForSelector('[role="option"]', { timeout: 5000 });
  await page.click(`[role="option"]:has-text("${equipmentLabel}")`, { timeout: 8000 });
  await page.keyboard.press('Escape').catch(() => {});
}

async function setPartySize(page, partySize) {
  await page.fill('#party-size-field', String(partySize));
}

function extractResultSnippet(bodyText) {
  const startMarkers = ['List\n', 'Map\n'];
  const endMarkers = ['\nSimilar', '\nSupport'];
  let start = -1;
  for (const marker of startMarkers) {
    const idx = bodyText.indexOf(marker);
    if (idx !== -1) { start = idx + marker.length; break; }
  }
  if (start === -1) start = 0;
  let end = bodyText.length;
  for (const marker of endMarkers) {
    const idx = bodyText.indexOf(marker, start);
    if (idx !== -1 && idx < end) end = idx;
  }
  return bodyText.slice(start, end).trim().slice(0, 600);
}

async function selectPark(page, parkOptionText) {
  await page.click('#park-autocomplete-input');
  await page.fill('#park-autocomplete-input', '');
  await page.fill('#park-autocomplete-input', parkOptionText);
  await page.waitForSelector('[role="option"]', { timeout: 5000 });
  await page.click(`[role="option"]:has-text("${parkOptionText}")`, { timeout: 8000 });
  await page.waitForTimeout(200);
}

async function switchToListView(page) {
  try {
    await page.click('button:has-text("List"), [role="tab"]:has-text("List")', { timeout: 5000 });
    await page.waitForTimeout(600);
  } catch (e) {
    // Already in list view, or the toggle wasn't found - proceed with whatever is on screen.
  }
}

// Fast pre-check: search "All Parks" (the park field's default, untouched state) and see whether
// the given park name appears at all in the root results list. Confirmed against known
// ground-truth dates that this is reliable *only* when done this way: the initial "Search" click
// alone can return stale data, but reloading the results page afterwards makes it recompute
// correctly - a park with zero matching availability disappears from the list entirely, one that
// has any match appears with "Available". This is currently only known to be trustworthy for
// "Algonquin" specifically, which shows up as its own top-level entry in that list (most other
// park names are nested inside a region and would never appear here regardless of availability -
// callers must not use this for those, since an "absent" result would be meaningless for them).
async function checkParkListedAtRootLevel(page, watch, parkNameSubstring) {
  await setDateRange(page, watch.arrivalDate, watch.departureDate);
  await setEquipment(page, watch.equipment);
  await setPartySize(page, watch.partySize);

  await page.click('#actionSearch');
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);

  await page.reload({ waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1200);

  await switchToListView(page);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const needle = parkNameSubstring.trim().toLowerCase();
  const listed = bodyText
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .some((line) => line === needle);

  return { listed };
}

async function checkAvailability(page, watch, parkOptionText) {
  await selectPark(page, parkOptionText);
  await setDateRange(page, watch.arrivalDate, watch.departureDate);
  await setEquipment(page, watch.equipment);
  await setPartySize(page, watch.partySize);

  await page.click('#actionSearch');
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);

  await switchToListView(page);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const noneAvailable =
    bodyText.includes('No Available Sites') || bodyText.includes('There are no available sites');

  return {
    available: !noneAvailable,
    snippet: extractResultSnippet(bodyText),
  };
}

module.exports = {
  launchBrowser,
  openHomeAndConsent,
  resolveParkOptions,
  checkAvailability,
  checkParkListedAtRootLevel,
};
