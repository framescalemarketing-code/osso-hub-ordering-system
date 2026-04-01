// Integration configuration checks which integrations are enabled.
function hasEnabledFlag(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export const integrations = {
  clickup: {
    enabled: () =>
      !!process.env.CLICKUP_API_KEY &&
      (!!process.env.CLICKUP_LIST_ID || !!process.env.CLICKUP_COMPANIES_FOLDER_ID),
    apiKey: () => process.env.CLICKUP_API_KEY!,
    listId: () => process.env.CLICKUP_LIST_ID!,
    companiesFolderId: () => process.env.CLICKUP_COMPANIES_FOLDER_ID?.trim() || null,
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
