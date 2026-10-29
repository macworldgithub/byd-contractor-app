# BYD Contractor Hub

Responsive React PWA for contractor job allocation, the six-stage Kanban workflow, task timers, evidence capture, GPS history, issue escalation, reporting, and Delivery Centre synchronization.

## Development

```sh
npm ci
npm run dev
npm test
npm run build
npm run lint
```

Set `VITE_API_URL` to the HTTPS `shaun-backend` origin and `VITE_DELIVERY_CENTRE_URL` to the Delivery Centre frontend. Vite development runs on port 5174. `vercel.json` provides SPA routing; production service workers and push notifications require HTTPS.

The paired backend's `CONTRACTOR_DEPLOYMENT.md` documents encryption keys, legacy media encryption, authenticated webhook contracts, remote polling, retries, and deployment checks. Deploy the two repos together. Trello migration behavior is unchanged.

## Offline work

Sign in and load your jobs online once before working offline. The app caches job data in IndexedDB and keeps an unexpired session available offline. Clocking, checklist updates, notes, issues, locations, and evidence are saved to an account-specific queue before being submitted. Photos and videos are encrypted on the device. Uploads use stable action identities and original timestamps.

Reconnection automatically retries pending work in order. Settings shows pending actions and errors, with a manual retry button. Another signed-in account cannot replay your work. Do not clear browser/site data while work is pending.

## Permissions and reports

Workers can access only their assigned jobs. Admins manage contractors and job assignments; Super Admins can grant Admin rights and configure integrations. Shared cross-platform accounts retain the central Sales CRM controls.

Dashboards refresh while visible and on focus. Analytics supports creation-date range, contractor, model, and status filters; CSV, Excel, and PDF exports use the same filters. Weekly/monthly breakdowns, completion trends, task averages, and completed jobs per VIN are available.

`npm test` exercises persistent offline data, encrypted media, retry ordering, account isolation, concurrent uploads, pagination, and cache behavior using an IndexedDB test implementation. It does not connect to production.
