export const PROGRAM_GUIDELINE_SOURCE =
  'https://github.com/framescalemarketing-code/osso-internal-quote-tool/tree/main';

export const DEFAULT_PROGRAM_GUIDELINES = [
  {
    title: 'Coverage Model',
    body:
      'Define coverage as one of: prescription safety only, prescription + non-prescription safety eyewear, or non-prescription only. Keep this fixed per company unless an approved exception is documented.',
  },
  {
    title: 'Allowance Scope',
    body:
      'Set allowance scope as companywide or department-based. Department-based programs should document which departments have add-on exceptions and why.',
  },
  {
    title: 'Side Shield Policy',
    body:
      'Use permanent/integrated side shields by default for higher-risk operations. Use removable side shields only where site policy explicitly allows flexible wear conditions.',
  },
  {
    title: 'Eligibility Cadence',
    body:
      'Set reorder cadence as annual, biennial, or by approval. By-approval programs should include explicit approver assignment and SLA expectations.',
  },
  {
    title: 'Approval Workflow',
    body:
      'When approval is required, keep orders in pending approval until an authorized approver responds. Record approver emails at the company level and review them quarterly.',
  },
  {
    title: 'Sunglass and Tint Controls',
    body:
      'Restrict non-medically required sunglass/tint options when policy requires cost and compliance control. Allow exceptions only with documented reason and approver traceability.',
  },
  {
    title: 'EU Package Governance',
    body:
      'Use Compliance, Comfort, Complete, or Covered as the package baseline. Add-ons and custom adjustments must be explicit so quote assumptions, order totals, and invoicing match.',
  },
  {
    title: 'Service Tier Governance',
    body:
      'Use Essential, Access, Premier, or Enterprise as the service baseline. Track included visits by tier and treat additional visits as separate line-item scope.',
  },
  {
    title: 'Enrollment Identity Rules',
    body:
      'Before program intake, verify first name + last name and at least one identifier (employee ID/token or email). No active enrollment match should fall back to regular retail intake.',
  },
  {
    title: 'CSV Roster Maintenance',
    body:
      'Upload enrollment CSV files at least monthly and on roster changes (new hires/terminations/transfers). Keep effective dates current so eligibility checks remain accurate.',
  },
  {
    title: 'Prescription Handling',
    body:
      'Prescription expiration date is required for Rx orders. Prescriber name/NPI can remain optional when expiration date and Rx values are sufficient for intake.',
  },
];
