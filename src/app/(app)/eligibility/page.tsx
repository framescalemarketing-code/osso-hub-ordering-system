'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Program } from '@/lib/types';

type EnrollmentLookupRow = {
  id: string;
  employee_first_name: string;
  employee_last_name: string;
  employee_external_id: string | null;
  employee_email: string | null;
  coverage_tier: string | null;
  cost_center_code: string | null;
  status: 'active' | 'terminated' | 'suspended';
  effective_from: string;
  effective_to: string | null;
  customer_id: string | null;
};

export default function EligibilityPage() {
  const supabase = useMemo(() => createClient(), []);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<EnrollmentLookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('programs')
      .select('*')
      .eq('is_active', true)
      .order('company_name')
      .then(({ data }) => setPrograms((data as Program[]) || []));
  }, [supabase]);

  async function lookupEmployees() {
    if (!selectedProgramId) {
      setMessage('Select a company first.');
      return;
    }

    setLoading(true);
    setMessage('');
    const params = new URLSearchParams({
      program_id: selectedProgramId,
      q: query.trim(),
    });

    const res = await fetch(`/api/enrollments/lookup?${params.toString()}`);
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setRows([]);
      setMessage(body.error || 'Unable to run employee lookup.');
      return;
    }

    setRows((body.rows || []) as EnrollmentLookupRow[]);
  }

  async function addToCustomers(row: EnrollmentLookupRow) {
    setAddingId(row.id);
    const res = await fetch('/api/enrollments/add-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program_id: selectedProgramId,
        enrollment_id: row.id,
        first_name: row.employee_first_name,
        last_name: row.employee_last_name,
        employee_email: row.employee_email,
        employee_external_id: row.employee_external_id,
      }),
    });

    const body = await res.json().catch(() => ({}));
    setAddingId(null);

    if (!res.ok) {
      setMessage(body.error || 'Failed to add employee to customers.');
      return;
    }

    setMessage('Employee added to customers and linked to this company.');
    await lookupEmployees();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2a1f12]">Employee Eligibility</h1>
          <p className="mt-1 text-sm text-[#6f5b40]">Search uploaded CSV roster records and add matched employees to customers.</p>
        </div>
        <Link href="/orders/new" className="pos-btn-secondary">Go To New Order</Link>
      </div>

      <div className="pos-panel p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr_auto]">
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="pos-input"
          >
            <option value="">Select company...</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.company_name}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookupEmployees()}
            className="pos-input"
            placeholder="Search by name, employee ID, email, or cost center"
          />
          <button onClick={lookupEmployees} className="pos-btn-primary" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        {message && <p className="text-sm text-[#6f5b40]">{message}</p>}
      </div>

      <div className="pos-panel-strong overflow-hidden">
        <div className="hidden gap-3 border-b border-[#e4d4ba] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#7d6541] lg:grid lg:grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_0.9fr]">
          <span>Employee</span>
          <span>Employee ID</span>
          <span>Email</span>
          <span>Coverage</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[#7b6340]">No roster rows loaded yet. Select a company and search.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="grid gap-3 border-b border-[#f1e5d3] px-4 py-4 lg:grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_0.9fr]">
              <div>
                <p className="font-semibold text-[#2f2416]">{row.employee_first_name} {row.employee_last_name}</p>
                <p className="text-xs text-[#7b6340]">Cost center: {row.cost_center_code || '-'}</p>
              </div>
              <p className="text-[#6f5b40]">{row.employee_external_id || '-'}</p>
              <p className="text-[#6f5b40] break-all">{row.employee_email || '-'}</p>
              <p className="text-[#6f5b40]">{row.coverage_tier || '-'}</p>
              <p className="text-[#6f5b40]">{row.status}</p>
              <div>
                {row.customer_id ? (
                  <span className="pos-badge border border-emerald-200 bg-emerald-50 text-emerald-700">Added</span>
                ) : (
                  <button
                    className="pos-btn-secondary"
                    disabled={addingId === row.id}
                    onClick={() => addToCustomers(row)}
                  >
                    {addingId === row.id ? 'Adding...' : 'Add To Customers'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
