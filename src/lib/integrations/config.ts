// Integration configuration — checks which integrations are enabled
function hasEnabledFlag(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export const integrations = {
  clickup: {
    enabled: () => !!process.env.CLICKUP_API_KEY && !!process.env.CLICKUP_LIST_ID,
    apiKey: () => process.env.CLICKUP_API_KEY!,
    listId: () => process.env.CLICKUP_LIST_ID!,
  },
  netsuite: {
    enabled: () =>
      !!process.env.NETSUITE_ACCOUNT_ID &&
      !!process.env.NETSUITE_CONSUMER_KEY &&
      !!process.env.NETSUITE_CONSUMER_SECRET &&
      !!process.env.NETSUITE_TOKEN_ID &&
      !!process.env.NETSUITE_TOKEN_SECRET,
  },
  quickbooks: {
    enabled: () =>
      !!process.env.QUICKBOOKS_CLIENT_ID &&
      !!process.env.QUICKBOOKS_CLIENT_SECRET &&
      !!process.env.QUICKBOOKS_REFRESH_TOKEN &&
      !!process.env.QUICKBOOKS_REALM_ID,
  },
  mailchimp: {
    enabled: () => !!process.env.MAILCHIMP_API_KEY && !!process.env.MAILCHIMP_SERVER_PREFIX && !!process.env.MAILCHIMP_LIST_ID,
    apiKey: () => process.env.MAILCHIMP_API_KEY!,
    server: () => process.env.MAILCHIMP_SERVER_PREFIX!,
    listId: () => process.env.MAILCHIMP_LIST_ID!,
  },
  bigquery: {
    enabled: () => !!process.env.GOOGLE_CLOUD_PROJECT_ID?.trim(),
    projectId: () => process.env.GOOGLE_CLOUD_PROJECT_ID!.trim(),
    dataset: () => process.env.BIGQUERY_DATASET?.trim() || 'osso_hub',
  },
  nassau: {
    enabled: () => !!process.env.NASSAU_API_KEY,
  },
  abb_optical: {
    enabled: () => !!process.env.ABB_OPTICAL_API_KEY,
  },
  resend: {
    enabled: () => !!process.env.RESEND_API_KEY,
    apiKey: () => process.env.RESEND_API_KEY!,
    from: () => process.env.EMAIL_FROM || 'orders@osso.com',
  },
};

export const notifications = {
  enabled: () => hasEnabledFlag(process.env.ENABLE_EXTERNAL_NOTIFICATIONS),
  pausedReason: () =>
    'Outbound notifications are paused in this environment. Set ENABLE_EXTERNAL_NOTIFICATIONS=true to resume.',
};
