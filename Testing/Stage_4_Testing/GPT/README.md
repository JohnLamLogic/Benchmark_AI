# Shiftwise Scheduler

A restaurant scheduling cockpit built with Next.js (App Router) that combines:

- Manager console for building weekly grids, archiving schedules, and firing off personalized Gmail attachments.
- Employee hub showing their own pay rate, weekly/archived schedules, hours history, and time-off requests.
- SQLite storage for employees, weeks, shifts, and time-off requests (auto-created the first time the server runs).

## Getting started

1. Copy `.env.example` to `.env.local` and provide your values:
   - `DATABASE_FILE` (defaults to `./data/schedule.sqlite`).
   - Gmail OAuth 2.0 values:
     - `GMAIL_CLIENT_ID`
     - `GMAIL_CLIENT_SECRET`
     - `GMAIL_REFRESH_TOKEN` (must be from the Gmail OAuth flow, with the `https://mail.google.com/` scope for sending only).
     - `GMAIL_SENDER_EMAIL` (the manager account that will send the PDFs).
2. Install dependencies with `npm install`.
3. Run the dev server with `npm run dev` and open the UI.

## Gmail integration

- The app uses the Gmail API only to send emails; it never reads, stores, or modifies inbox data.
- A refresh token must be generated for the manager account with the `https://mail.google.com/` scope. After acquiring the token, drop it into `.env.local`.
- Every email (schedule or time-off decision) will be sent one-by-one to each employee with the generated PDF attached.

## Features

- **Manager console**
  - Create/edit/delete employees (name, positions, email, pay rate).
  - Build schedules on a weekly grid, add multiple shifts per employee/day, edit and remove shifts.
  - Archive weeks and preload any archived shifts into the current week or download the PDF.
  - Send a PDF of the current week to every employee via Gmail with one email per person.
  - Track and approve/deny time-off requests; decisions trigger an automated notification email.

- **Employee hub**
  - Select your profile to view current and previous weekly schedules plus PDF downloads.
  - See your personal pay rate and a history of the hours logged each week.
  - Submit time-off requests with a reason and monitor the approval status.

## Data storage

- SQLite lives at the path defined by `DATABASE_FILE`. The schema is automatically created on first run and includes tables for `employees`, `schedules`, `shifts`, and `time_off_requests`.
- When an employee is deleted, all their shifts and requests are automatically removed because the tables enforce foreign keys with cascades.

## Scripts

- `npm run dev` — Runs the Next.js dev server.
- `npm run build` — Builds the Next.js app for production.
- `npm run start` — Starts the production server after building.
- `npm run lint` — Runs `next lint` using the default configuration.

## Notes

- If you want to seed initial data, you can `INSERT` directly into the SQLite file, or build simple scripts that call the API routes.
- The `data/schedule.sqlite` file is git-ignored. Back it up separately if you need to preserve production data.
