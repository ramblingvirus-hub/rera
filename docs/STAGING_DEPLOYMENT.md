# RERA Staging Deployment

This repository is set up as a split deployment:

- Django serves the API and admin panel.
- React/Vite builds a static frontend.
- Nginx serves the frontend and proxies `/api/` and `/admin/` to Django.

If your current hosting only supports static files or shared hosting, do not try to run Django there. Use that hosting for the frontend only, and run the Django backend on a VPS or Python-capable app host.

## 1. Recommended staging host layout

- OS: Ubuntu 24.04 LTS or similar Linux distribution
- App path: `/srv/rera/current`
- Shared environment file: `/srv/rera/shared/.env`
- Process manager: `systemd`
- Reverse proxy: `nginx`
- Database: PostgreSQL

## 2. First-time server bootstrap

Install system packages:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm postgresql postgresql-contrib nginx
```

Create the app user and folders:

```bash
sudo useradd --system --create-home --shell /bin/bash rera || true
sudo mkdir -p /srv/rera/current /srv/rera/shared
sudo chown -R rera:www-data /srv/rera
```

Clone the repository into `/srv/rera/current`, then create the virtual environment:

```bash
cd /srv/rera/current
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 3. Configure environment variables

Copy the sample file and fill in real values:

```bash
cp .env.staging.example /srv/rera/shared/.env
cp frontend/.env.staging.example frontend/.env.staging
```

Minimum backend variables:

- `RERA_ENV=staging`
- `SECRET_KEY`
- `ALLOWED_HOSTS`
- `DATABASE_URL` or the `DB_*` variables below
- `DB_SSLMODE=require` for Railway Postgres
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`

Frontend variable:

- `VITE_BACKEND_ORIGIN=https://your-backend-host`

If frontend and backend are split across different domains:

- `VITE_BACKEND_ORIGIN` must point to the backend domain.
- `CORS_ALLOWED_ORIGINS` must contain the frontend domain.
- `CSRF_TRUSTED_ORIGINS` must contain the frontend domain if browser-authenticated POST requests will originate there.

## 4. Railway PostgreSQL

If you plan to keep PostgreSQL on Railway, use the connection string Railway provides and place it in `DATABASE_URL`.

Example:

```env
DATABASE_URL=postgresql://postgres:password@centerbeam.proxy.rlwy.net:12345/railway
DB_SSLMODE=require
```

This repository now supports `DATABASE_URL` directly, so you do not need to split the Railway connection into separate `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` variables unless you want to.

## 5. Create the PostgreSQL database

```bash
sudo -u postgres psql
```

Then run:

```sql
CREATE USER rera_staging WITH PASSWORD 'replace-with-db-password';
CREATE DATABASE rera_staging OWNER rera_staging;
```

Skip this section if Railway is already managing the database for you.

## 6. Install systemd and nginx configs

Install the service unit:

```bash
sudo cp deploy/staging/rera-staging.service /etc/systemd/system/rera-staging.service
sudo systemctl daemon-reload
sudo systemctl enable rera-staging
```

Install the nginx site:

```bash
sudo cp deploy/staging/nginx-rera-staging.conf /etc/nginx/sites-available/rera-staging
sudo ln -sf /etc/nginx/sites-available/rera-staging /etc/nginx/sites-enabled/rera-staging
sudo nginx -t
sudo systemctl reload nginx
```

If the server terminates TLS at nginx, add your certificate config to the site file before go-live.

## 7. First release

From the server:

```bash
chmod +x deploy/staging/release.sh
./deploy/staging/release.sh
```

That script will:

- install Python dependencies
- build the frontend
- apply database migrations
- collect Django static files
- run `manage.py check --deploy`
- restart the staging service

## 8. Validation checklist

Verify all of the following after deployment:

- `https://staging.rera.example.com` loads the frontend
- `https://staging.rera.example.com/admin/` loads the Django admin login
- `https://staging.rera.example.com/api/token/` responds
- `sudo systemctl status rera-staging --no-pager` shows the service as active
- `sudo journalctl -u rera-staging -n 100 --no-pager` shows no boot errors

If the frontend is on one host and the API is on another:

- confirm browser requests are reaching the API host
- confirm there are no CORS failures in browser dev tools
- confirm the backend host is listed in `VITE_BACKEND_ORIGIN`

## 9. Release workflow for updates

For each update:

```bash
cd /srv/rera/current
git pull
./deploy/staging/release.sh
```

## 10. Notes for this repository

- Django selects settings from `RERA_ENV`; use `staging` on the server.
- Production-like security settings are environment-driven, not hard-coded.
- The frontend must be rebuilt whenever `VITE_BACKEND_ORIGIN` changes.
- Railway PostgreSQL is supported through `DATABASE_URL` plus optional `DB_SSLMODE`.