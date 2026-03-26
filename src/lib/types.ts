import type { EUPackage, EUPackageAddOnKey, PriceAdjustment, ServiceTier } from '@/lib/pricing';

// Supabase database types - mirrors the SQL schema
export type EmployeeRole = 'admin' | 'manager' | 'sales' | 'optician' | 'readonly';
export type OrderType = 'regular' | 'program';
export type OrderStatus = 'draft' | 'pending_approval' | 'approved' | 'processing' | 'lens_ordered' | 'completed' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type GlassesType = 'safety_rx' | 'safety_non_rx' | 'non_safety_rx' | 'non_safety_non_rx';
export type LensVendor = 'nassau' | 'abb_optical' | 'other';

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Employee {
  id: string;
  auth_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  role: EmployeeRole;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  company_name: string;
  company_code?: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  location_address?: Address | null;
  program_type?: string | null;
  employee_count?: number | null;
  restricted_guidelines?: string | null;
  loyalty_credit_count?: number;
  referral_credit_count?: number;
  eu_package?: EUPackage | null;
  eu_package_add_ons?: EUPackageAddOnKey[];
  eu_package_custom_adjustments?: PriceAdjustment[];
  service_tier?: ServiceTier | null;
  service_tier_custom_adjustments?: PriceAdjustment[];
  billing_address: Address | null;
  shipping_address: Address | null;
  approval_required: boolean;
  approver_emails: string[];
  invoice_terms: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Derived / optional presentation fields
  credit_count?: number | null;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: Address | null;
  employer: string | null;
  program_id: string | null;
  hipaa_consent_signed: boolean;
  hipaa_consent_date: string | null;
  ccpa_consent_signed: boolean;
  ccpa_consent_date: string | null;
  marketing_consent: boolean;
  marketing_consent_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  recent_order_date?: string | null;
  // Relations
  program?: Program | null;
  orders?: Order[];
  prescriptions?: Prescription[];
}

export interface Prescription {
  id: string;
  customer_id: string;
  program_id: string | null;
  program_enrollment_id: string | null;
  enrollment_resolution_status: 'active' | 'inactive' | 'not_found' | 'not_applicable' | null;
  enrollment_resolution_reason: string | null;
  upload_source: string;
  od_sphere: number | null;
  od_cylinder: number | null;
  od_axis: number | null;
  od_add: number | null;
  od_prism: number | null;
  od_prism_base: string | null;
  os_sphere: number | null;
  os_cylinder: number | null;
  os_axis: number | null;
  os_add: number | null;
  os_prism: number | null;
  os_prism_base: string | null;
  pd_distance: number | null;
  pd_near: number | null;
  pd_right: number | null;
  pd_left: number | null;
  prescriber_name: string | null;
  prescriber_npi: string | null;
  rx_date: string | null;
  expiration_date: string | null;
  pdf_storage_path: string | null;
  notes: string | null;
  is_current: boolean;
  created_at: string;
  uploaded_by: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  order_type: OrderType;
  status: OrderStatus;
  customer_id: string;
  employee_id: string;
  program_id: string | null;
  prescription_id: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  shipping_address: Address | null;
  shipping_method: string | null;
  tracking_number: string | null;
  clickup_task_id: string | null;
  bigquery_synced_at: string | null;
  invoice_pdf_path: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  customer?: Customer;
  employee?: Employee;
  program?: Program | null;
  prescription?: Prescription | null;
  items?: OrderItem[];
  approvals?: Approval[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  glasses_type: GlassesType;
  frame_brand: string | null;
  frame_model: string | null;
  frame_color: string | null;
  frame_size: string | null;
  frame_price: number;
  lens_type: string | null;
  lens_material: string | null;
  lens_coating: string[] | null;
  lens_tint: string | null;
  lens_price: number;
  lens_vendor: LensVendor | null;
  lens_order_id: string | null;
  lens_order_status: string | null;
  lens_ordered_at: string | null;
  quantity: number;
  line_total: number;
  notes: string | null;
  created_at: string;
}

export interface Approval {
  id: string;
  order_id: string;
  approver_email: string;
  approver_name: string | null;
  status: ApprovalStatus;
  token: string;
  requested_at: string;
  responded_at: string | null;
  notes: string | null;
  requested_by: string | null;
}

export interface SyncLog {
  id: string;
  integration: string;
  record_type: string;
  record_id: string;
  external_id: string | null;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  attempts: number;
  created_at: string;
}

export type IntegrationJobStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export interface IntegrationJob {
  id: string;
  order_id: string;
  integration: 'clickup' | 'bigquery';
  status: IntegrationJobStatus;
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  locked_at: string | null;
  locked_by: string | null;
  external_id: string | null;
  last_error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Enrollment (migration 006)

export type EnrollmentImportStatus = 'received' | 'validated' | 'applied' | 'failed';
export type EnrollmentSource = 'csv' | 'manual' | 'self_register';
export type EnrollmentStatus = 'active' | 'terminated' | 'suspended';

export interface EnrollmentImport {
  id: string;
  program_id: string;
  uploaded_by: string | null;
  /** ISO date string, always first day of month (YYYY-MM-01) */
  import_month: string;
  source_filename: string | null;
  /** SHA-256 hex digest of the raw file bytes */
  source_checksum: string;
  row_count: number;
  valid_row_count: number;
  invalid_row_count: number;
  status: EnrollmentImportStatus;
  error_summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProgramEnrollment {
  id: string;
  program_id: string;
  enrollment_source: EnrollmentSource;
  /** Null for manual enrollments; set for csv-sourced rows */
  enrollment_import_id: string | null;
  employee_external_id: string | null;
  employee_first_name: string;
  employee_last_name: string;
  /** Stored lowercase */
  employee_email: string | null;
  employee_identifier_hash: string | null;
  cost_center_code: string | null;
  coverage_tier: string | null;
  status: EnrollmentStatus;
  /** ISO date string (YYYY-MM-DD) */
  effective_from: string;
  /** Null while enrollment is active */
  effective_to: string | null;
  termination_reason: string | null;
  terminated_at: string | null;
  terminated_by: string | null;
  /**
   * Optional link to an existing customers row.
   * FK goes enrollment -> customer, never the reverse.
   * Retail customers are never required to appear in this table.
   */
  customer_id: string | null;
  enrolled_by: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateManualProgramEnrollmentInput {
  program_id: string;
  customer_id?: string | null;
  employee_first_name: string;
  employee_last_name: string;
  employee_email?: string | null;
  employee_external_id?: string | null;
  cost_center_code?: string | null;
  coverage_tier?: string | null;
  effective_from?: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  link_customer_program?: boolean;
}

export interface ProgramSummary {
  id: string;
  company_name: string;
  approval_required: boolean;
  invoice_terms: string;
  is_active: boolean;
}

export interface EnrollmentResolution {
  status: 'active' | 'inactive' | 'not_found' | 'not_applicable';
  reason: 'matched_active' | 'matched_inactive' | 'no_match' | 'regular_order_no_program_linkage';
  enrollment: ProgramEnrollment | null;
  program: ProgramSummary | null;
  as_of: string;
}

export interface OrderIntakePreloadContext {
  customer_id: string | null;
  program_id: string | null;
  program: ProgramSummary | null;
  enrollment_resolution: EnrollmentResolution;
  order_mode_hint: 'regular' | 'program';
}

export interface CreatePrescriptionInput {
  customer_id: string;
  order_type: 'regular' | 'program';
  program_id?: string | null;
  employee_email?: string | null;
  employee_external_id?: string | null;
  od_sphere?: number | string | null;
  od_cylinder?: number | string | null;
  od_axis?: number | string | null;
  od_add?: number | string | null;
  od_prism?: number | string | null;
  od_prism_base?: string | null;
  os_sphere?: number | string | null;
  os_cylinder?: number | string | null;
  os_axis?: number | string | null;
  os_add?: number | string | null;
  os_prism?: number | string | null;
  os_prism_base?: string | null;
  pd_distance?: number | string | null;
  pd_near?: number | string | null;
  pd_right?: number | string | null;
  pd_left?: number | string | null;
  prescriber_name?: string | null;
  prescriber_npi?: string | null;
  rx_date?: string | null;
  expiration_date?: string | null;
  pdf_storage_path?: string | null;
  notes?: string | null;
}

