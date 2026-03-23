#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/rera/current"

cd "$APP_DIR"

source venv/bin/activate
pip install -r requirements.txt

pushd frontend >/dev/null
npm ci
npm run build
popd >/dev/null

python manage.py migrate
python manage.py collectstatic --noinput
python manage.py check --deploy

sudo systemctl restart rera-staging
sudo systemctl status rera-staging --no-pager