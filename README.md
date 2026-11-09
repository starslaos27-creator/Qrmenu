# ShopQR

ShopQR is organized as three independently built applications:

| Application | Source | Run/build |
| --- | --- | --- |
| Restaurant/customer frontend | `frontend/src/` | `cd frontend; npm run dev` / `npm run build` |
| Platform admin | `admin/src/` | `cd admin; npm run dev` / `npm run build` |
| API backend | `backend/src/` | `cd backend; npm run dev` / `npm run build` |

React pages and components use TypeScript `.tsx`; non-UI modules use `.ts`.
Frontend and admin use Tailwind classes for page styling, with one global
stylesheet per app for Tailwind directives and base styles. The backend API is
Fastify with TypeScript and PostgreSQL.

The admin interface and backend run from TypeScript source. Backend HTTP
registrations are in `backend/src/routes/` and request handlers are in
`backend/src/controllers/`. Frontend screens
have page-specific TypeScript modules under `frontend/src/pages/`; update the
matching page folder and its route in `frontend/src/app/App.tsx`. A compatibility
app in `frontend/dist/legacy-app.html` remains as a fallback for paths that have
not been migrated. `dist/`, `build/`, and bundled assets are generated output;
avoid editing them directly.

Whole-page language translation uses Google Cloud Translation Basic. Set
`GOOGLE_TRANSLATE_API_KEY` in `backend/.env.local`; keep the key on the backend
and set an API quota in Google Cloud before enabling it. The login page keeps
its built-in translations, and the selected language is reused in the rest of
the app.

Local `.env` files, backend uploads, dependencies, and generated admin/backend
build output are excluded from Git. Use the app `.env.example` files for local
settings. Production Backend settings are documented in
`backend/.env.production.example`; run the three app builds with the commands
listed above before starting their production servers.

For the restored local Windows database, run
`powershell -ExecutionPolicy Bypass -File ./start-local.ps1` to start PostgreSQL,
the built API, and the frontend. Use `-Service backend` for the database and API
only. The script maps this folder to `Q:` because the bundled PostgreSQL requires
an ASCII path. Keep `.local/`: it contains the database, PostgreSQL binaries,
and local logs, and is excluded from Git. Do not delete it when cleaning builds.

Pro package requests use a history-only approval workflow. The restaurant owner
selects a package and clicks the checkout button to submit a pending request.
No payment, slip or entitlement change occurs. Owners see their request history
on checkout; platform admins review requests at
`http://localhost:5174/?section=pro` (development server: port 5175).
Super admins and support can approve or reject with a note; viewers can read.
The amount is a snapshot of the configured price when submitted, not verified revenue.
Platform admins set the base monthly USD price at `?section=pro-pricing`.
New requests use this server-side price; existing requests retain their original
amounts. Price changes have an audit record and stale checkout quotes are rejected.
Reviews are recorded with the reviewer, timestamp and platform audit entry.
Only one request per restaurant can be pending, and retries do not duplicate it.
Run backend migrations before using this workflow. To verify the API against
PostgreSQL, build the backend and run `node scripts/check-pro-requests.mjs` from
`backend/`; test fixtures roll back. `start-local.ps1` also starts the built admin;
`-Service admin` starts the API/database and admin only.
