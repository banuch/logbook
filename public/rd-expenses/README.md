# Wintek R&D Expense Tracker

An offline-first expense tracker for Wintek Solutions' IoT R&D work. It records
spending per project, keeps photos of the bills, tracks payments and
reimbursements, and produces statements you can hand to your accountant.

It is a Progressive Web App (PWA): open it in Chrome on Android and choose
**Add to Home screen** / **Install app**. It then runs full-screen and works
without internet.

## What it tracks

| Area | Details |
|------|---------|
| **Projects** | Code, name, budget, status (Active / On hold / Completed), start date, funding/client. Shows spent against budget and warns at 85% and over 100%. |
| **Expenses** | Date, project, category, item, vendor, invoice no., qty × unit price, GST % (0/5/12/18/28), shipping/other, auto-computed total. |
| **Categories** (editable) | Electronic components (ESP32, EC200U, sensors, relays…), PCB fabrication & assembly, enclosure / mechanical / 3D printing, tools & test equipment, dev boards & modules, SIM cards & data plans, cloud/server/software, certification & testing, field trials & travel, courier & shipping, consumables, contractor/labour, misc. |
| **Payments** | Mode (UPI, bank, card, cash, cheque, credit), status (Paid / Pending / Reimbursable / Reimbursed), paid by, UTR / transaction reference. |
| **Bills** | Snap a photo with the camera or attach images/PDFs. Photos are shrunk to 1600 px JPEG to save space. Entries with no bill are flagged. |

## Reports

- Dashboard: total spend, this month, pending payments, amounts to reimburse,
  GST (input) paid, project budget bars, category split, last 12 months.
- Reports tab: filter by project and date range, group by category, project,
  month, vendor or person who paid. Shows a summary table plus a detailed ledger.
  - **Print / PDF**: prints a clean statement (on Android: Share → Print → Save as PDF).
  - **Export CSV**: opens in Excel or Tally import tools, with ₹ shown correctly.

## Data and backup

All data is stored **only on the device** (browser IndexedDB). There is no
server sync. Go to **Settings → Download backup** regularly. The JSON file
includes every bill image, so you can restore everything on a new phone with
**Restore backup**. The app reminds you if you haven't backed up for a week.

Clearing Chrome's site data for the app deletes your records, so back up first.

## Running it

The folder is static. Use either of these:

- With the existing logbook server (`npm start`), open `http://<server>:<port>/rd-expenses/`.
- Or any static host / `python3 -m http.server` inside `public/`.

Installing it on a phone and running it offline needs HTTPS, or `localhost`.

## Files

- `index.html` – layout and dialogs
- `app.js` – all logic (IndexedDB storage, views, reports, CSV, backup)
- `styles.css` – responsive styles, dark mode, print layout
- `sw.js` – service worker for offline use
- `manifest.webmanifest`, `icon.svg` – install metadata
