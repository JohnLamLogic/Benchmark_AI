# Restaurant Shift Scheduler

This project is a self-contained web scheduler for a restaurant manager. It allows a single manager to create or update employees, plan weekly shifts by day, re-use past weeks, and export the finalized plan as a PDF. The interface is intentionally lightweight and does not rely on external APIs or services.

## Stack

- Node.js built-in `http` server (no additional npm dependencies) handles REST endpoints and serves static assets.
- Data is persisted in `data/db.json` so employees and saved schedules survive across restarts.
- The front-end is vanilla HTML/CSS/JavaScript and manages shift creation, editing, and deletion through a grid-based view.

## Local development

1. Ensure you are in this folder and install any dependencies (none required). If requested in the future, run `npm install`.
2. Start the server:
   ```sh
   npm start
   ```
3. Visit `http://localhost:3000` in your browser.

Use the calendar controls in the hero section to pick a week (defaults to the current Monday), add or edit employees, assign shifts in the grid, and save or export the schedule.

## Data model

- `data/db.json` keeps `employees`, `weeks`, and simple counters (`meta`) to allocate IDs.
- Saving a schedule (`Save schedule`) creates or updates a week record keyed by the chosen Monday.
- Previous weeks are available from the `Saved schedules` dropdown and can be loaded into the current grid for adjustments.

## File structure

- `server.js` – handles HTTP routing, JSON parsing, and simple validation.
- `public/` – static assets (HTML, CSS, JS).
- `data/db.json` – persistent store for employees and saved schedules.
- `README.md` – this guide.
