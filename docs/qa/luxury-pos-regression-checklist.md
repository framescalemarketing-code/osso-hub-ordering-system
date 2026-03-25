# Luxury POS Regression Checklist

## Scope
- Shell/navigation, dashboard, orders list/detail, new order flow
- Customers, programs, settings premium rollout
- New company intake route: `/programs/new`

## Automated Checks
- `npm run check:fast`
- Optional pre-release: `npm run build`

## Role and Access Validation
- `admin` and `manager` can open:
  - `/settings`
  - `/settings/pricing`
  - `/settings/programs`
  - `/programs/new`
- non-admin roles are redirected away from settings and company intake page.
- customer and company edit managers are visible only for `admin` and `manager` on detail pages.

## Core Flow Validation
- Create a regular order end-to-end from `/orders/new` and verify final status page loads.
- Create a program order end-to-end and verify approval-oriented status behavior is unchanged.
- Open order detail and verify operational IDs (invoice/clickup/tracking/lens order ID) are only visible for privileged roles.
- Create a company via `/programs/new` and confirm it appears in `/programs` and links to profile.

## UI and Responsiveness
- Desktop checks at 1280px+ for dashboard, orders, customers, programs, settings.
- Tablet checks around 768px for table overflow and card fallback behavior.
- Mobile checks around 390px for navigation drawer, stepper readability, and form inputs.
- Verify status badges remain readable and color contrast is acceptable.

## Data Safety and Privacy
- Non-privileged roles should not see restricted customer fields where gated (email/phone/dob in customers list).
- Confirm no raw secrets are rendered in settings; only connected/not configured states.
- Verify no `dangerouslySetInnerHTML` usage in touched surfaces.

## Release Recommendation Rule
- Go if all automated checks pass and all role/core flow checks pass.
- Conditional go if only non-blocking cosmetic issues remain.
- No-go if role gating or order creation flow regressions are present.
