// Supabase Database types — mirrors the SQL schema
export type EmployeeRole = 'admin' | 'manager' | 'sales' | 'optician' | 'readonly';
export type OrderType = 'regular' | 'program';
export type OrderStatus = 'draft' | 'pending_approval' | 'approved' | 'processing' | 'lens_ordered' | 'completed' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type GlassesType = 'safety_rx' | 'safety_non_rx' | 'non_safety_rx' | 'non_safety_non_rx';
export type LensVendor = 'nassau' | 'abb_optical' | 'other';
export type ReminderType = 'follow_up' | 'order_update' | 'approval_needed' | 'invoice_due';
export type ReminderStatus = 'pending' | 'sent' | 'cancelled';

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
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_address: Address | null;
  shipping_address: Address | null;
  approval_required: boolean;
  approver_emails: string[];
  invoice_terms: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  // Relations
  program?: Program | null;
}

export interface Prescription {
  id: string;
  customer_id: string;
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
  netsuite_id: string | null;
  quickbooks_id: string | null;
  bigquery_synced_at: string | null;
  invoice_number: string | null;
  invoice_sent_at: string | null;
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

export interface Reminder {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  employee_id: string | null;
  reminder_type: ReminderType;
  subject: string;
  body: string | null;
  due_at: string;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
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
