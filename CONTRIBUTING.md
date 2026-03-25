# Contributing

## Branch Strategy

- `main`: production-ready code only.
- `develop`: integration branch for completed features.
- `feature/<short-name>`: feature work.
- `fix/<short-name>`: bug fixes.
- `chore/<short-name>`: maintenance and tooling.
- `hotfix/<short-name>`: urgent production fixes (branch from `main`, then merge to both `main` and `develop`).

## Pull Request Flow

1. Branch from `develop` unless it is a production hotfix.
2. Keep PRs small and focused.
3. Run `npm run check:fast` before opening a PR.
4. Target PRs to `develop` for normal work.
5. Promote to production with `develop -> main` PRs.

## Local Dev and Debug

- Start dev server: `npm run dev`
- Debug server startup with inspector: `npm run dev:debug`
- Fast validation: `npm run check:fast`
- Full validation: `npm run check`

## GitHub Branch Protection

Use this command after cloning or if settings drift:

```bash
npm run repo:protect
```

It enforces:
- Pull-request-only merges
- 1 approving review minimum
- Code owner review required
- Stale review dismissal
- Conversation resolution
- Linear history
- No force-pushes/deletions
