'use client';

import type { OrderItem, GlassesType } from '@/lib/types';

interface Props {
  items: Partial<OrderItem>[];
  onChange: (items: Partial<OrderItem>[]) => void;
  onComplete: () => void;
}

type OrderItemDraft = Partial<OrderItem> & {
  glasses_type: GlassesType;
};

const glassesTypeLabels: Record<GlassesType, string> = {
  safety_rx: 'Safety Prescription',
  safety_non_rx: 'Safety Non-Prescription',
  non_safety_rx: 'Non-Safety Prescription',
  non_safety_non_rx: 'Non-Safety Non-Prescription',
};

const defaultItem: OrderItemDraft = {
  glasses_type: 'safety_rx',
  frame_brand: '', frame_model: '', frame_color: '', frame_size: '',
  frame_price: 0, lens_type: '', lens_material: '', lens_coating: [],
  lens_tint: '', lens_price: 0, quantity: 1, line_total: 0, notes: '',
};

export default function GlassesOrderItems({ items, onChange, onComplete }: Props) {
  function addItem() {
    onChange([...items, { ...defaultItem }]);
  }

  function updateItem<K extends keyof OrderItemDraft>(index: number, key: K, value: OrderItemDraft[K]) {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [key]: value } as OrderItemDraft;
      newItem.line_total = ((Number(newItem.frame_price) || 0) + (Number(newItem.lens_price) || 0)) * (Number(newItem.quantity) || 1);
      return newItem;
    });
    onChange(updated);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  const inputClass = 'pos-input';
  const labelClass = 'pos-label';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-[#2a1f12]">Order Items</h2>
        <button onClick={addItem} className="pos-btn-primary">
          + Add Glasses
        </button>
      </div>

      {items.length === 0 && (
        <div className="pos-panel border-dashed p-12 text-center">
          <p className="mb-4 text-[#7b6340]">No items added yet</p>
          <button onClick={addItem} className="pos-btn-primary">Add First Pair</button>
        </div>
      )}

      {items.map((item, idx) => (
        <div key={idx} className="pos-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#7d6541]">Pair #{idx + 1}</h3>
            <button onClick={() => removeItem(idx)} className="text-xs font-semibold text-rose-600 hover:text-rose-700">Remove</button>
          </div>

          {/* Glasses Type */}
          <div className="mb-4">
            <label className={labelClass}>Glasses Type</label>
            <select
              value={item.glasses_type || 'safety_rx'}
              onChange={e => updateItem(idx, 'glasses_type', e.target.value as GlassesType)}
              className={inputClass}
            >
              {Object.entries(glassesTypeLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Frame */}
          <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-[#7d6541]">Frame</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div><label className={labelClass}>Brand</label><input type="text" value={item.frame_brand || ''} onChange={e => updateItem(idx, 'frame_brand', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Model</label><input type="text" value={item.frame_model || ''} onChange={e => updateItem(idx, 'frame_model', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Color</label><input type="text" value={item.frame_color || ''} onChange={e => updateItem(idx, 'frame_color', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Size</label><input type="text" value={item.frame_size || ''} onChange={e => updateItem(idx, 'frame_size', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Frame Price</label><input type="number" step="0.01" value={item.frame_price || ''} onChange={e => updateItem(idx, 'frame_price', parseFloat(e.target.value) || 0)} className={inputClass} /></div>
          </div>

          {/* Lens */}
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7d6541]">Lens</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div><label className={labelClass}>Lens Type</label><input type="text" value={item.lens_type || ''} onChange={e => updateItem(idx, 'lens_type', e.target.value)} className={inputClass} placeholder="SV, Bifocal, Progressive" /></div>
            <div><label className={labelClass}>Material</label><input type="text" value={item.lens_material || ''} onChange={e => updateItem(idx, 'lens_material', e.target.value)} className={inputClass} placeholder="Poly, Trivex, Hi-index" /></div>
            <div><label className={labelClass}>Coatings</label><input type="text" value={(item.lens_coating || []).join(', ')} onChange={e => updateItem(idx, 'lens_coating', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className={inputClass} placeholder="AR, Scratch, Blue-cut" /></div>
            <div><label className={labelClass}>Tint</label><input type="text" value={item.lens_tint || ''} onChange={e => updateItem(idx, 'lens_tint', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Lens Price</label><input type="number" step="0.01" value={item.lens_price || ''} onChange={e => updateItem(idx, 'lens_price', parseFloat(e.target.value) || 0)} className={inputClass} /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><label className={labelClass}>Quantity</label><input type="number" min="1" value={item.quantity || 1} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} className={inputClass} /></div>
            <div><label className={labelClass}>Notes</label><input type="text" value={item.notes || ''} onChange={e => updateItem(idx, 'notes', e.target.value)} className={inputClass} /></div>
            <div>
              <label className={labelClass}>Line Total</label>
              <div className="rounded-xl border border-[#e5d5bb] bg-[#fffdf8] px-3 py-2 text-sm font-semibold text-[#322616]">
                ${(Number(item.line_total) || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      ))}

      {items.length > 0 && (
        <div className="flex justify-end">
          <button onClick={onComplete} className="pos-btn-primary px-6 py-3">
            Continue to Review
          </button>
        </div>
      )}
    </div>
  );
}
