# ShopQR Admin

The platform administration interface is a React and TypeScript application.
`src/main.tsx` starts the app, `src/app/` contains session and layout wiring,
`src/pages/` contains one page per admin section, and `src/shared/adminApi.ts`
owns authenticated API requests. Components use Tailwind utility classes; the
single global stylesheet only loads Tailwind and base styles.

## Run

Run `npm run dev` for development on port 5175, or `npm run build` followed by
`npm start` to serve the production build on port 5174. The server proxies
`/api/*` to `http://127.0.0.1:4000` by default; set `BACKEND_URL` to change it.
Set `PORT` to change the Admin server port.

On a local, non-production backend with no platform admin account, the app
offers the one-time bootstrap form. After setup, sign in to manage shops, users,
audit history, and system status. Admin routes and actions are enforced by the
backend as well as hidden or disabled in the interface according to role.

### First admin on production

To create the first production admin, or recover the configured admin account,
set a one-time secret in the backend environment before restarting the API:

```sh
openssl rand -hex 32
```

Copy the generated value to `ADMIN_BOOTSTRAP_TOKEN` in the backend `.env`. To
recover an existing active admin, also set `ADMIN_BOOTSTRAP_EMAIL` to that
account's email. Keep both values private. Open the admin site, create or reset
the configured account using the secret and a new password, then remove both
variables from the backend environment and restart the API. Setup is available
only while there are no admins, except for recovery of the specifically
configured active admin account.

Generated files in `dist/` are build output. Edit the TypeScript source under
`src/`, never the generated JavaScript bundles.
