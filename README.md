# OSSO Hub — Ordering System

A full-stack Point of Sale system for **On-Sight Safety Optics** — handles customer intake, prescriptions (with PDF upload), glasses orders (safety Rx, non-Rx, non-safety), two order flows (regular customers + program employees with approvals), and syncs to all downstream systems.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Data Warehouse**: Google BigQuery
- **Integrations**: ClickUp, NetSuite, QuickBooks, Mailchimp, Nassau, ABB Optical
- **Email**: Resend
- **Compliance**: HIPAA + California CCPA

## Setup

### 1. Install

```bash
cd osso-hub-ordering-system
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Run the SQL to create all tables, RLS policies, and storage buckets
4. Go to Settings → API to get your URL and keys

### 3. Environment Variables

```bash
cp .env.example .env.local
```

Fill in your Supabase keys + any integration API keys.

### 4. Create First Employee

In Supabase dashboard:
1. Go to Authentication → Users → Invite User
2. After setting password, run in SQL Editor:

```sql
INSERT INTO employees (auth_user_id, email, first_name, last_name, role)
VALUES ('YOUR_AUTH_USER_UUID', 'your@email.com', 'Your', 'Name', 'admin');
```

### 5. Run

```bash
npm run dev
```

## Integrations (Plug-and-Play)

Each integration activates when its API keys are present in `.env.local`. Leave blank to disable.

| Integration | Required Keys |
|---|---|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **ClickUp** | `CLICKUP_API_KEY`, `CLICKUP_LIST_ID` |
| **BigQuery** | `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` |
| **NetSuite** | `NETSUITE_ACCOUNT_ID`, `NETSUITE_CONSUMER_KEY`, etc. |
| **QuickBooks** | `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_REALM_ID`, etc. |
| **Mailchimp** | `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX`, `MAILCHIMP_LIST_ID` |
| **Nassau** | `NASSAU_API_URL`, `NASSAU_API_KEY` |
| **ABB Optical** | `ABB_OPTICAL_API_URL`, `ABB_OPTICAL_API_KEY` |
| **Resend** | `RESEND_API_KEY`, `EMAIL_FROM` |
