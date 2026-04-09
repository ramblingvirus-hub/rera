# RERA Frontend

This frontend is a React + Vite single-page application for the RERA platform.

It handles:

- public landing pages
- authentication pages
- authenticated report and billing flows
- the Contact Us page wired to the Django backend

## Local development

Install dependencies and start the Vite dev server:

```bash
npm install
npm run dev
```

Run tests:

```bash
npm run test:run
```

Create a production build:

```bash
npm run build
```

## Environment variable

Required:

- `VITE_BACKEND_ORIGIN`

Example:

```env
VITE_BACKEND_ORIGIN=https://api-rera.heptageeks.com
```

This value must point at the Django backend origin, not the frontend domain.

Validation:

- Production builds now fail fast if `VITE_BACKEND_ORIGIN` is missing or invalid.
- See `.env.production.example` for the expected format.

## Key frontend behavior

- API requests are sent to the backend configured by `VITE_BACKEND_ORIGIN`.
- The Contact Us page submits to `POST /api/v1/contact/`.
- Contact success and error banners auto-dismiss after 5 seconds and can also be closed manually.
- Footer navigation includes Privacy Policy, Contact, and Terms of Service links across the public app.

## Deployment notes

- The frontend is deployed separately from Django.
- Any change to `VITE_BACKEND_ORIGIN` requires a rebuild and redeploy.
- Production frontend should point to the live backend domain, currently `https://api-rera.heptageeks.com`.
- If deployment variables are missing, `npm run build` exits with an error instead of generating a broken bundle.
- GitHub Actions now enforces this on `main` via `.github/workflows/frontend-env-guard.yml`.
- Configure repository secret `VITE_BACKEND_ORIGIN_PROD` so CI can validate and build with the same production backend origin.
