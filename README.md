# OSSO Hub Ordering System

Full-stack ordering workflow for On-Sight Safety Optics:
- Customer intake + prescription capture
- Regular and program order flows
- Program enrollment linkage + approvals
- Downstream integration sync queue (ClickUp, NetSuite, QuickBooks, BigQuery, Mailchimp)

## Tech stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase (Postgres, Auth, RLS, Storage)
- Integrations: ClickUp, NetSuite, QuickBooks, BigQuery, Mailchimp, Resend

## Local setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env.local
```

3. Run database migrations in order (`001` through latest) in your Supabase SQL editor.

4. Create your first employee row (after inviting auth user):
```sql
INSERT INTO employees (auth_user_id, email, first_name, last_name, role)
VALUES ('YOUR_AUTH_USER_UUID', 'your@email.com', 'Your', 'Name', 'admin');
```

5. Start dev server:
```bash
npm run dev
```

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `JOB_RUNNER_SECRET` (used to secure `/api/jobs/process` and `/api/reminders/process`)
- `ENABLE_EXTERNAL_NOTIFICATIONS` (`false` keeps outbound emails paused until you intentionally re-enable them)

## BigQuery

BigQuery writes are optional and activate when `GOOGLE_CLOUD_PROJECT_ID` is set. The code uses Application Default Credentials at runtime, so local auth can be handled with `gcloud auth application-default login`.

On the first successful sync, the app will create or evolve these tables in the target dataset:

- `orders`
- `order_items`
- `customers`
- `programs`

The schema is additive. New columns can be introduced without breaking existing data, and streaming inserts use stable `insertId` values to avoid duplicate rows during retries.

Recommended env values:

- `GOOGLE_CLOUD_PROJECT_ID`
- `BIGQUERY_DATASET` defaulting to `osso_hub`

Operational notes:

- If the dataset does not exist yet, the app creates it automatically.
- Unknown extra fields are ignored on insert so future schema additions stay safe.

## Supabase Operational Setup

- Run the full migration set through `011_supabase_hardening_and_indexes.sql`.
- Keep the client on `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the server on `SUPABASE_SECRET_KEY`.
- Enable leaked password protection in Supabase Auth settings.
- Use the new search and recency indexes when validating customer, program, order, and enrollment flows at scale.
- Keep `JOB_RUNNER_SECRET` aligned with your cron configuration so scheduled processors stay locked down.

## Integration job queue

Order integrations are enqueued in `integration_jobs` and processed by `/api/jobs/process`:
- Retries with exponential backoff
- Writes success/failure records to `sync_log`
- Updates order external IDs when integrations succeed

## Scheduler / server readiness

Scheduled Vercel cron jobs are currently paused for development in `vercel.json`.

When you are ready to resume them:
- `0 9 * * *` -> `/api/jobs/process`
- `30 9 * * *` -> `/api/reminders/process`

Set `CRON_SECRET` in Vercel, restore the cron entries in `vercel.json`, and keep `JOB_RUNNER_SECRET` aligned so cron calls are authorized.

## Quality automation

- GitHub Actions CI (`.github/workflows/ci.yml`): push/PR validation with cached install, lint, typecheck, and build
- Daily Health (`.github/workflows/daily-health.yml`): manual-only while development notifications are paused
- Security (`.github/workflows/security.yml`): push/PR validation plus manual runs
- Autofix (`.github/workflows/autofix.yml`): manual-only while development notifications are paused
- Dependabot (`.github/dependabot.disabled.yml`): disabled backup of the previous daily/weekly update schedule

## Branching model

- `main`: production branch
- `develop`: integration branch
- `feature/*`, `fix/*`, `chore/*`: day-to-day development branches (PR into `develop`)
- `hotfix/*`: urgent production patches (branch from `main`, merge back to `main` and `develop`)

Branch protections can be re-applied with:

```bash
npm run repo:protect
```

## Commands

- `npm run dev`
- `npm run dev:debug`
- `npm run lint`
- `npm run lint:fix`
- `npm run typecheck`
- `npm run check:fast`
- `npm run check`
- `npm run build`
- `npm run start`
