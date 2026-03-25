<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# OSSO Agent Index

This repository uses an eight-agent specialist model. Detailed definitions live in `.github/agents/*.agent.md`, and shared governance lives in `.github/copilot-instructions.md`.

## Model Policy

Use a hybrid model policy:

1. Prefer `gpt-5.3-codex` for implementation-heavy agents when available.
2. Use a lighter model for planning and governance-focused agents when available.
3. Keep frontmatter model IDs compatible with currently supported workspace models.

## Active Agents

1. OSSO Product Architect (`.github/agents/osso-product-architect.agent.md`) — planning and scope control
2. OSSO Billing & Eligibility Logic (`.github/agents/osso-billing-eligibility.agent.md`) — formulas and billing rules
3. OSSO Backend Implementation (`.github/agents/osso-backend-implementation.agent.md`) — schema and server implementation
4. OSSO App Flow & Integration (`.github/agents/osso-app-flow-integration.agent.md`) — orchestration and side effects
5. OSSO Security & Compliance (`.github/agents/osso-security-compliance.agent.md`) — auth/data safety and auditability checks
6. OSSO QA & Release Validation (`.github/agents/osso-qa-release-validation.agent.md`) — acceptance and release gating
7. OSSO Design System & UX (`.github/agents/osso-design-system-ux.agent.md`) — visual system and interaction consistency
8. OSSO UI & Debugging (`.github/agents/osso-ui-debugging.agent.md`) — targeted front-end bug fixes and usability improvements

## Routing Priority

1. OSSO Product Architect
2. OSSO Billing & Eligibility Logic
3. OSSO Backend Implementation
4. OSSO App Flow & Integration
5. OSSO Security & Compliance
6. OSSO QA & Release Validation
7. OSSO Design System & UX
8. OSSO UI & Debugging

If a task crosses domains, use the narrowest valid owner first and hand off explicitly.
