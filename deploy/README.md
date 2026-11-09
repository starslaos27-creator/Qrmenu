# Deploy ShopQR to starsmenu.org

This folder contains the Nginx virtual hosts and the backend systemd service.
The routes are configured as follows:

- `https://starsmenu.org` and `https://www.starsmenu.org` → `frontend/dist`
- `https://admin.starsmenu.org` → `admin/dist`
- `https://api.starsmenu.org` and frontend/admin `/api/*` → backend on `127.0.0.1:4000`

Cloudflare DNS must point the apex, `www`, `admin`, and `api` records to the VPS
IP. The supplied screenshot showed those records pointing at `178.128.126.15`.
The Nginx config starts on port 80 so Certbot can issue certificates; once
certificates are installed, use Cloudflare SSL/TLS **Full (strict)**.

## Copy the project

Upload the project folder to `/opt/shopqr` (or copy its contents there). Do not
copy local `node_modules`, `.local`, or `backend/.env` to the server. Windows
`node_modules` cannot be used on Linux. Keep the committed lockfiles and the
built `frontend/dist`, `admin/dist`, and `backend/build` folders.

Install a supported Node.js LTS release, PostgreSQL, Nginx, and Certbot on the
Ubuntu server. Then, from `/opt/shopqr`, install production backend packages:

```sh
cd /opt/shopqr/backend
npm ci --omit=dev
```

Create the server-only environment file from `backend/.env.production.example`
at `/etc/shopqr/backend.env`, then replace every placeholder with the real
production database, JWT, and Cloudflare R2 credentials. Keep this file out of
the project folder and restrict access (`sudo chown root:www-data` and
`sudo chmod 640 /etc/shopqr/backend.env`). Configure
Google Translation and Supabase values only if those integrations are used.
The local `backend/.env` is development-only and points to a local database.

The frontend production build uses `frontend/.env.production`:

```dotenv
VITE_API_URL=https://api.starsmenu.org
SHOPQR_PUBLIC_URL=https://starsmenu.org
```

These values are already set in this project. If source files are changed,
rebuild the frontend and admin on the server (or on a compatible Linux build
machine) before serving them. The frontend/admin `dist` folders must exist.

Create `/etc/shopqr/backend.env` before this step. Run the DB migrations once
with the production environment loaded, then install the service and Nginx config:

```sh
sudo install -d -m 0755 /etc/shopqr
cd /opt/shopqr/backend
set -a
. /etc/shopqr/backend.env
set +a
npm run db:migrate

sudo install -m 0644 /opt/shopqr/deploy/systemd/shopqr-backend.service /etc/systemd/system/shopqr-backend.service
sudo install -m 0644 /opt/shopqr/deploy/nginx/shopqr.conf /etc/nginx/sites-available/shopqr
sudo ln -sfn /etc/nginx/sites-available/shopqr /etc/nginx/sites-enabled/shopqr
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now shopqr-backend
sudo systemctl reload nginx
```

Issue TLS certificates for all hostnames using Certbot's Nginx plugin, then set
Cloudflare SSL/TLS mode to **Full (strict)**:

```sh
sudo certbot --nginx -d starsmenu.org -d www.starsmenu.org -d admin.starsmenu.org -d api.starsmenu.org
```

Check the API with `https://api.starsmenu.org/health` and inspect service logs
with `sudo journalctl -u shopqr-backend -n 100 --no-pager`.

## Important before first start

This project folder cannot contain your production database password, JWT secret,
or R2 credentials because those are unique server secrets. `backend/.env.production.example`
is a template, not a ready-to-run production environment. The service intentionally
fails validation until the real values are supplied. Uploading files alone does
not install Nginx/PostgreSQL, issue TLS certificates, or start the service.
