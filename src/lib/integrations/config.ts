// Integration configuration — checks which integrations are enabled
export const integrations = {
  clickup: {
    enabled: () => !!process.env.CLICKUP_API_KEY,
    apiKey: () => process.env.CLICKUP_API_KEY!,
    listId: () => process.env.CLICKUP_LIST_ID!,
  },
  netsuite: {
    enabled: () => !!process.env.NETSUITE_ACCOUNT_ID && !!process.env.NETSUITE_CONSUMER_KEY,
  },
  quickbooks: {
    enabled: () => !!process.env.QUICKBOOKS_CLIENT_ID && !!process.env.QUICKBOOKS_REALM_ID,
  },
  mailchimp: {
    enabled: () => !!process.env.MAILCHIMP_API_KEY,
    apiKey: () => process.env.MAILCHIMP_API_KEY!,
    server: () => process.env.MAILCHIMP_SERVER_PREFIX!,
    listId: () => process.env.MAILCHIMP_LIST_ID!,
  },
  bigquery: {
    enabled: () => !!process.env.GOOGLE_CLOUD_PROJECT_ID,
    projectId: () => process.env.GOOGLE_CLOUD_PROJECT_ID!,
    dataset: () => process.env.BIGQUERY_DATASET || 'osso_hub',
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
