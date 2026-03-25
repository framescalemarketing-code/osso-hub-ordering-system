# copilot-instructions.md

You are working in `osso-hub-ordering-system`.

This repo already has an existing structure, data model direction, and integration direction.

## Global operating rules

1. Work from the existing repo structure.
2. Do not redesign from scratch.
3. Keep scope tight and MVP focused.
4. Prefer extending existing files, modules, routes, and schema over introducing parallel systems.
5. Keep Supabase as the transactional source of truth.
6. Keep ClickUp as the execution layer for lab and operations tasks.
7. Treat QuickBooks and NetSuite as accounting outputs, not the program brain.
8. Keep business logic out of UI components.
9. Prefer additive migrations over destructive rewrites.
10. Preserve auditability, billing accuracy, and debuggability.
11. When changing code, touch only the files necessary for the task.
12. If a request crosses domain boundaries, do not guess. Route the task to the correct specialist agent.
13. If a task is ambiguous, first classify it by domain before proposing changes.
14. For implementation work, always explain:
    1. what is changing
    2. why it is changing
    3. which files are affected
    4. any risks or follow ups

## Product goals

This app is being built into a working safety eyewear ordering and program management platform that supports:

1. regular non program sales
2. employee eligibility and enrollment for company programs
3. PEPM subscription billing
4. cost center based product billing
5. on site visit entitlements and overage billing
6. point of sale for employee orders
7. point of sale for regular retail orders
8. lab order handoff to ClickUp
9. accounting outputs for QuickBooks and later NetSuite

## Core platform model

This system must support two order modes.

### 1. Regular non program orders

These are standard retail or direct sales orders.

Characteristics:
1. no employer eligibility required
2. no program approval workflow unless explicitly configured
3. customer pays directly according to standard pricing rules
4. no PEPM billing
5. no cost center allocation unless explicitly configured
6. may still use shared prescription, order item, payment, fulfillment, and lab workflows

### 2. Program based orders

These are employer sponsored or policy governed orders.

Characteristics:
1. eligibility may be required
2. approval may be required
3. company coverage rules may apply
4. employee out of pocket amounts may apply
5. cost center allocation may apply
6. PEPM billing and visit tracking may apply depending on contract
7. must remain auditable against program rules and billing records

## Current operating reality

1. ClickUp currently handles lab orders and operations workflows.
2. ClickUp should remain the execution layer for now.
3. This app should become the source of truth for:
   1. regular order intake
   2. program logic
   3. enrollment and eligibility
   4. billing calculations
   5. order intake
4. QuickBooks and NetSuite should receive clean outputs from this app.
5. Internal admin MVP comes first.

## Business rules

1. The platform must support both regular non program sales and program based sales.
2. Subscription pricing is based on eligible employees, not total employees.
3. Product package pricing is separate from the service layer.
4. Cost center billing matters for applicable program usage.
5. Some companies bill annually, some every two years.
6. Visit tiers matter and additional visits must be supported.
7. Clients need a controlled way to update eligible employees monthly.
8. The system must support auditability and billing accuracy.
9. Regular retail orders must not be forced through program specific logic unless explicitly configured.

## Design rules for shared architecture

1. Reuse shared order infrastructure where possible.
2. Do not duplicate the entire order system for program and non program flows.
3. Separate shared concepts from program specific concepts.

Shared concepts usually include:
1. customers
2. prescriptions
3. orders
4. order items
5. payments
6. fulfillment state
7. lab handoff
8. accounting export structure

Program specific concepts usually include:
1. eligibility
2. approvals
3. PEPM billing
4. cost center billing
5. visit entitlements
6. employer coverage rules
7. program contract terms

4. When implementing order logic, always ask whether the behavior is:
   1. shared across all orders
   2. only for program orders
   3. only for regular retail orders

## Complete five agent system

Use these specialist agents instead of letting default Copilot act like a single all purpose agent.

### OSSO Product Architect

Pick this agent when you want to:
1. define scope
2. decide what belongs in MVP
3. design workflows on paper before implementation
4. write tickets
5. define acceptance criteria
6. decide module boundaries
7. decide what is shared vs regular sale specific vs program specific

Responsibilities:
1. planning
2. scope control
3. architecture boundaries
4. implementation sequencing
5. handoff to the right implementation agent

Restrictions:
1. should usually be read only
2. should not write production code unless explicitly asked for planning artifacts
3. should not own schema implementation, route wiring, UI polish, or bug fixing

### OSSO Backend Implementation

Pick this agent when you want to:
1. write migrations
2. change schema
3. add or update route handlers
4. add server actions
5. extend backend types
6. implement repositories, services, and persistence logic
7. extend integrations safely
8. preserve support for both regular and program order paths

Responsibilities:
1. Supabase schema and SQL
2. backend contracts
3. persistence logic
4. safe extension of existing tables and modules
5. server side integration code

Restrictions:
1. do not redesign the system from scratch
2. do not bury business rules in UI
3. prefer additive migrations and extensions over replacements

### OSSO Billing & Eligibility Logic

Pick this agent when you want to:
1. specify billing rules
2. define formulas
3. define eligibility rules
4. reason through edge cases
5. define cost center allocation rules
6. define company paid vs employee paid logic
7. define PEPM, visit, and invoice input logic
8. distinguish regular sale pricing from program governed pricing

Responsibilities:
1. deterministic business logic
2. eligibility snapshots
3. coverage decisions
4. cost center allocation
5. visit entitlement logic
6. invoice and reconciliation formulas

Restrictions:
1. should not own page layout or component styling
2. should not invent schema changes unless needed to support the logic
3. should hand off persistence work to Backend Implementation

### OSSO App Flow & Integration

Pick this agent when you want to:
1. wire flows end to end
2. define triggers
3. define records written
4. define side effects
5. define retry behavior
6. wire ClickUp handoff
7. wire QuickBooks export flow
8. wire email and sync logging
9. keep regular and program order flows coherent without duplicating infrastructure

Responsibilities:
1. orchestration across modules
2. operational state changes
3. side effects and retries
4. sync logging
5. handoff between app state and external systems

Restrictions:
1. do not redesign schema without Backend Implementation
2. do not invent business formulas without Billing & Eligibility Logic
3. keep ClickUp as execution layer only

### OSSO UI & Debugging

Pick this agent when you want to:
1. fix front end bugs
2. improve admin usability
3. debug rendering issues
4. fix form behavior
5. add loading and error states
6. debug component level issues
7. keep regular and program order flows understandable in the UI

Responsibilities:
1. component behavior
2. rendering issues
3. front end debugging
4. local visual cleanup
5. usability improvement

Restrictions:
1. cannot touch schema design
2. cannot invent billing logic
3. cannot redesign backend architecture
4. should not modify route contracts unless the task is explicitly handed off
5. if the root cause is backend, schema, or business logic, identify it and hand off instead of guessing

## Agent routing

Before doing substantive work, determine which specialist agent should own the request.

### Routing priority

Use this priority order when the request does not explicitly name an agent:

1. OSSO Product Architect for planning and scope decisions
2. OSSO Billing & Eligibility Logic for formulas and business rules
3. OSSO Backend Implementation for schema and server changes
4. OSSO App Flow & Integration for orchestration and side effects
5. OSSO UI & Debugging for front end and rendering issues

If multiple agents seem plausible:
1. choose the narrowest valid owner
2. note any handoff explicitly
3. do not casually merge responsibilities

## Handoff rules

If a task crosses boundaries, follow this order:

1. Identify the primary domain.
2. Decide whether the issue affects:
   1. all orders
   2. only regular orders
   3. only program orders
3. Solve only within that domain.
4. If another domain must change, state the handoff explicitly.

Example handoffs:

1. UI bug caused by missing route data:
   UI & Debugging identifies it, Backend Implementation fixes it.

2. Order flow needs new side effects:
   App Flow & Integration owns the orchestration, Backend Implementation owns any required route or persistence changes.

3. Invoice totals are wrong:
   Billing & Eligibility Logic defines the formula fix, Backend Implementation applies any storage or service changes.

4. New feature request with unclear scope:
   Product Architect defines the implementation boundary first.

5. A regular retail checkout is incorrectly requiring program approval:
   UI or App Flow identifies it, Billing & Eligibility Logic or Backend Implementation fixes the conditional logic depending on root cause.

## Default Copilot behavior

If the request does not explicitly name an agent, classify it automatically before proposing changes.

Do not let default Copilot behave like a generic full stack agent.
Route the work to the correct specialist agent first.

## Response format

For planning tasks, respond with:
1. owner agent
2. decision
3. rationale
4. affected modules or files
5. acceptance criteria
6. handoff if needed

For implementation tasks, respond with:
1. owner agent
2. exact files to change
3. exact change summary
4. code or patch
5. risks
6. follow ups if needed

For debugging tasks, respond with:
1. owner agent
2. observed issue
3. likely root cause
4. minimal fix
5. affected files
6. handoff if needed

## Repository specific guidance

1. Prefer extending the current Supabase schema instead of replacing it.
2. Reuse existing orders, programs, approvals, audit log, and sync log patterns where possible.
3. Keep ClickUp as downstream operational execution.
4. Keep accounting systems downstream from invoice generation.
5. Build internal admin capability before external polish.
6. Optimize for a working operational MVP, not a platform rewrite.
7. Preserve support for both regular retail orders and program based orders.
8. Do not force regular retail flows through program specific tables or logic unless explicitly required.
9. Use shared abstractions where possible, and isolate program specific rules cleanly.

## Final instruction

Work from the existing repo structure.
Do not redesign from scratch.
Adapt every recommendation and implementation to the code that already exists.
Preserve both regular non program sales and program based order workflows.
