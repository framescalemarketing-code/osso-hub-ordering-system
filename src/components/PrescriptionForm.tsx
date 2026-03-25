'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Prescription } from '@/lib/types';

interface Props {
  customerId: string;
  orderType: 'regular' | 'program';
  programId?: string | null;
  onComplete: (rx: Prescription) => void;
  onSkip: () => void;
}

export default function PrescriptionForm({ customerId, orderType, programId, onComplete, onSkip }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  const [rx, setRx] = useState({
    od_sphere: '', od_cylinder: '', od_axis: '', od_add: '', od_prism: '', od_prism_base: '',
    os_sphere: '', os_cylinder: '', os_axis: '', os_add: '', os_prism: '', os_prism_base: '',
    pd_distance: '', pd_near: '', pd_right: '', pd_left: '',
    prescriber_name: '', prescriber_npi: '', rx_date: '', expiration_date: '',
    notes: '',
  });

  function update(key: string, value: string) {
    setRx(prev => ({ ...prev, [key]: value }));
  }

  async function handlePdfUpload(file: File) {
    setUploading(true);
    const path = `${customerId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('prescriptions').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      alert('Upload error: ' + error.message);
    } else {
      setPdfPath(path);
    }
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        order_type: orderType,
        program_id: orderType === 'program' ? programId : null,
        od_sphere: rx.od_sphere || null,
        od_cylinder: rx.od_cylinder || null,
        od_axis: rx.od_axis || null,
        od_add: rx.od_add || null,
        od_prism: rx.od_prism || null,
        od_prism_base: rx.od_prism_base || null,
        os_sphere: rx.os_sphere || null,
        os_cylinder: rx.os_cylinder || null,
        os_axis: rx.os_axis || null,
        os_add: rx.os_add || null,
        os_prism: rx.os_prism || null,
        os_prism_base: rx.os_prism_base || null,
        pd_distance: rx.pd_distance || null,
        pd_near: rx.pd_near || null,
        pd_right: rx.pd_right || null,
        pd_left: rx.pd_left || null,
        prescriber_name: rx.prescriber_name || null,
        prescriber_npi: rx.prescriber_npi || null,
        rx_date: rx.rx_date || null,
        expiration_date: rx.expiration_date || null,
        pdf_storage_path: pdfPath,
        notes: rx.notes || null,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Failed to save prescription' }));
      alert('Error: ' + (body.error || 'Failed to save prescription'));
      setSaving(false);
      return;
    }

    const { prescription } = (await res.json()) as { prescription: Prescription };
    onComplete(prescription);
  }

  const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Prescription</h2>
        <button onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-800">
          Skip (no Rx needed)
        </button>
      </div>

      {/* PDF Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Upload Rx PDF</label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*"
          onChange={e => e.target.files?.[0] && handlePdfUpload(e.target.files[0])}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-white border border-gray-300 border-dashed rounded-lg text-sm text-gray-500 hover:text-gray-800 transition"
        >
          {uploading ? 'Uploading...' : pdfPath ? '✓ PDF Uploaded' : 'Click to upload prescription PDF or image'}
        </button>
      </div>

      {/* Right Eye */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">OD (Right Eye)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
        <div><label className={labelClass}>Sphere</label><input type="number" step="0.25" value={rx.od_sphere} onChange={e => update('od_sphere', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Cylinder</label><input type="number" step="0.25" value={rx.od_cylinder} onChange={e => update('od_cylinder', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Axis</label><input type="number" step="1" min="0" max="180" value={rx.od_axis} onChange={e => update('od_axis', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Add</label><input type="number" step="0.25" value={rx.od_add} onChange={e => update('od_add', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Prism</label><input type="number" step="0.25" value={rx.od_prism} onChange={e => update('od_prism', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Base</label><input type="text" value={rx.od_prism_base} onChange={e => update('od_prism_base', e.target.value)} className={inputClass} placeholder="BU/BD/BI/BO" /></div>
      </div>

      {/* Left Eye */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">OS (Left Eye)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
        <div><label className={labelClass}>Sphere</label><input type="number" step="0.25" value={rx.os_sphere} onChange={e => update('os_sphere', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Cylinder</label><input type="number" step="0.25" value={rx.os_cylinder} onChange={e => update('os_cylinder', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Axis</label><input type="number" step="1" min="0" max="180" value={rx.os_axis} onChange={e => update('os_axis', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Add</label><input type="number" step="0.25" value={rx.os_add} onChange={e => update('os_add', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Prism</label><input type="number" step="0.25" value={rx.os_prism} onChange={e => update('os_prism', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Base</label><input type="text" value={rx.os_prism_base} onChange={e => update('os_prism_base', e.target.value)} className={inputClass} placeholder="BU/BD/BI/BO" /></div>
      </div>

      {/* PD */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Pupillary Distance</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div><label className={labelClass}>Distance PD</label><input type="number" step="0.5" value={rx.pd_distance} onChange={e => update('pd_distance', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Near PD</label><input type="number" step="0.5" value={rx.pd_near} onChange={e => update('pd_near', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Right PD</label><input type="number" step="0.5" value={rx.pd_right} onChange={e => update('pd_right', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Left PD</label><input type="number" step="0.5" value={rx.pd_left} onChange={e => update('pd_left', e.target.value)} className={inputClass} /></div>
      </div>

      {/* Doctor Info */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Prescriber Info</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div><label className={labelClass}>Doctor Name</label><input type="text" value={rx.prescriber_name} onChange={e => update('prescriber_name', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>NPI</label><input type="text" value={rx.prescriber_npi} onChange={e => update('prescriber_npi', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Rx Date</label><input type="date" value={rx.rx_date} onChange={e => update('rx_date', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Expiration</label><input type="date" value={rx.expiration_date} onChange={e => update('expiration_date', e.target.value)} className={inputClass} /></div>
      </div>

      <div className="mb-6">
        <label className={labelClass}>Notes</label>
        <textarea value={rx.notes} onChange={e => update('notes', e.target.value)} rows={2} className={inputClass} />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
      >
        {saving ? 'Saving...' : 'Save Prescription & Continue'}
      </button>
    </div>
  );
}
