'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Prescription } from '@/lib/types';

interface Props {
  customerId: string;
  onComplete: (rx: Prescription) => void;
  onSkip: () => void;
}

export default function PrescriptionForm({ customerId, onComplete, onSkip }: Props) {
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
    const toNum = (v: string) => v ? parseFloat(v) : null;
    const toInt = (v: string) => v ? parseInt(v) : null;

    const { data, error } = await supabase.from('prescriptions').insert({
      customer_id: customerId,
      od_sphere: toNum(rx.od_sphere), od_cylinder: toNum(rx.od_cylinder), od_axis: toInt(rx.od_axis),
      od_add: toNum(rx.od_add), od_prism: toNum(rx.od_prism), od_prism_base: rx.od_prism_base || null,
      os_sphere: toNum(rx.os_sphere), os_cylinder: toNum(rx.os_cylinder), os_axis: toInt(rx.os_axis),
      os_add: toNum(rx.os_add), os_prism: toNum(rx.os_prism), os_prism_base: rx.os_prism_base || null,
      pd_distance: toNum(rx.pd_distance), pd_near: toNum(rx.pd_near),
      pd_right: toNum(rx.pd_right), pd_left: toNum(rx.pd_left),
      prescriber_name: rx.prescriber_name || null, prescriber_npi: rx.prescriber_npi || null,
      rx_date: rx.rx_date || null, expiration_date: rx.expiration_date || null,
      pdf_storage_path: pdfPath,
      notes: rx.notes || null,
      is_current: true,
    }).select().single();

    if (error) {
      alert('Error: ' + error.message);
      setSaving(false);
      return;
    }

    // Mark previous prescriptions as not current
    await supabase.from('prescriptions')
      .update({ is_current: false })
      .eq('customer_id', customerId)
      .neq('id', data.id);

    onComplete(data as Prescription);
  }

  const inputClass = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Prescription</h2>
        <button onClick={onSkip} className="text-sm text-gray-400 hover:text-white">
          Skip (no Rx needed)
        </button>
      </div>

      {/* PDF Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">Upload Rx PDF</label>
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
          className="px-4 py-2 bg-gray-800 border border-gray-700 border-dashed rounded-lg text-sm text-gray-400 hover:text-white transition"
        >
          {uploading ? 'Uploading...' : pdfPath ? '✓ PDF Uploaded' : 'Click to upload prescription PDF or image'}
        </button>
      </div>

      {/* Right Eye */}
      <h3 className="text-sm font-semibold text-gray-300 mb-3">OD (Right Eye)</h3>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        <div><label className={labelClass}>Sphere</label><input type="number" step="0.25" value={rx.od_sphere} onChange={e => update('od_sphere', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Cylinder</label><input type="number" step="0.25" value={rx.od_cylinder} onChange={e => update('od_cylinder', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Axis</label><input type="number" step="1" min="0" max="180" value={rx.od_axis} onChange={e => update('od_axis', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Add</label><input type="number" step="0.25" value={rx.od_add} onChange={e => update('od_add', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Prism</label><input type="number" step="0.25" value={rx.od_prism} onChange={e => update('od_prism', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Base</label><input type="text" value={rx.od_prism_base} onChange={e => update('od_prism_base', e.target.value)} className={inputClass} placeholder="BU/BD/BI/BO" /></div>
      </div>

      {/* Left Eye */}
      <h3 className="text-sm font-semibold text-gray-300 mb-3">OS (Left Eye)</h3>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        <div><label className={labelClass}>Sphere</label><input type="number" step="0.25" value={rx.os_sphere} onChange={e => update('os_sphere', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Cylinder</label><input type="number" step="0.25" value={rx.os_cylinder} onChange={e => update('os_cylinder', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Axis</label><input type="number" step="1" min="0" max="180" value={rx.os_axis} onChange={e => update('os_axis', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Add</label><input type="number" step="0.25" value={rx.os_add} onChange={e => update('os_add', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Prism</label><input type="number" step="0.25" value={rx.os_prism} onChange={e => update('os_prism', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Base</label><input type="text" value={rx.os_prism_base} onChange={e => update('os_prism_base', e.target.value)} className={inputClass} placeholder="BU/BD/BI/BO" /></div>
      </div>

      {/* PD */}
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Pupillary Distance</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div><label className={labelClass}>Distance PD</label><input type="number" step="0.5" value={rx.pd_distance} onChange={e => update('pd_distance', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Near PD</label><input type="number" step="0.5" value={rx.pd_near} onChange={e => update('pd_near', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Right PD</label><input type="number" step="0.5" value={rx.pd_right} onChange={e => update('pd_right', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Left PD</label><input type="number" step="0.5" value={rx.pd_left} onChange={e => update('pd_left', e.target.value)} className={inputClass} /></div>
      </div>

      {/* Doctor Info */}
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Prescriber Info</h3>
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
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg font-semibold transition"
      >
        {saving ? 'Saving...' : 'Save Prescription & Continue'}
      </button>
    </div>
  );
}
