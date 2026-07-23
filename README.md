# Park Bot

Watches Ontario Parks reservations and pops up an on-screen alert the moment a matching
site becomes available. Checks every 15 minutes (configurable) by driving a real (invisible)
browser, the same way you would search by hand — so it sees exactly what you'd see on the
website.

## One-time setup

You need [Node.js](https://nodejs.org/) installed first (the regular "LTS" download button on
that site — just run the installer with all the defaults).

**Windows:** double-click `setup.bat`.
**Linux:** open a terminal in this folder and run `./setup.sh`.

This downloads everything the bot needs (including its own private copy of a web browser).
It only needs to be done once, and takes a few minutes.

## Configure what to watch

Open `config.json` in Notepad (Windows) or any text editor (Linux) and edit it. Example:

```json
{
  "checkEveryMinutes": 15,
  "notify": {
    "popup": true,
    "ntfyTopic": ""
  },
  "watches": [
    {
      "park": "Algonquin",
      "arrivalDate": "2026-08-01",
      "departureDate": "2026-08-03",
      "partySize": 1,
      "equipment": "Single Tent"
    }
  ]
}
```

- **park** — a park or campground name. A partial name like `"Algonquin"` automatically
  covers all 9 Algonquin campgrounds (Mew Lake, Canisbay Lake, Kiosk, etc.) — you don't need
  to list them individually. Use the same spelling you'd type into the search box on the
  reservations website.
- **arrivalDate** / **departureDate** — the exact stay you want, in `YYYY-MM-DD` format.
- **partySize** — number of people.
- **equipment** — must match one of the site's equipment options exactly:
  `Single Tent`, `2 Tents`, `3 Tents`, `Trailer or RV up to 18ft (5.5m)`,
  `Trailer or RV up to 25ft (7.6m)`, `Trailer or RV up to 32ft (9.7m)`,
  `Trailer or RV over 32ft (9.7m)`.

You can add more than one entry to `watches` (comma-separated) if you want to track several
parks or date ranges at once — just copy the `{ ... }` block and adjust it.

Save the file after editing.

### Push notifications on your phone (optional)

If you'd rather get a phone notification than (or in addition to) the on-screen popup:

1. Install the **ntfy** app: [iOS](https://apps.apple.com/us/app/ntfy/id1625396347) /
   [Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) — or just visit
   [ntfy.sh](https://ntfy.sh) in a browser on your phone, no account needed.
2. Pick a topic name that's hard to guess (it works like a shared password — anyone who
   knows it can read your alerts or post fake ones), e.g. `vinis-algonquin-9f2k`.
3. In the app, tap **Subscribe to topic** and enter that same name.
4. In `config.json`, set `"ntfyTopic"` to that same name, e.g. `"ntfyTopic": "vinis-algonquin-9f2k"`.
5. Next time you start the bot, it sends a "Park Bot started" test push right away so you can
   confirm it's working without waiting for a real opening.

Set `"popup": false` if you only want the phone push and not the on-screen window.

## Run it

**Windows:** double-click `start.bat`.
**Linux:** run `./start.sh` (or double-click it if your file manager supports "Run in Terminal").

A window will open and stay open — **leave it running**. Every 15 minutes it re-checks, and
prints what it found. The moment a site becomes available, a window will pop up on top of
everything else saying so. To stop the bot, close that window (or press Ctrl+C).

If you change `config.json` while the bot is running, stop it and start it again for the
change to take effect.

## Notes

- This machine needs to be turned on and the window left open for alerts to keep coming.
  If you want it running 24/7, use a computer that stays on (not one that sleeps).
- Popular sites can get booked within minutes of opening, so don't step away from the
  computer for too long once you're in the target date window — the bot will alert you,
  but it won't book the site for you.
- If Ontario Parks changes their website layout, the bot may start erroring on every check
  (you'll see `ERROR checking ...` lines). It saves a screenshot into the `logs/` folder
  each time that happens, which is useful for figuring out what changed.
- The bot only reports what the site's own "List" view says (down to reading its literal
  "No Available Sites" message), so it's exactly as accurate as looking at the results
  page yourself.
