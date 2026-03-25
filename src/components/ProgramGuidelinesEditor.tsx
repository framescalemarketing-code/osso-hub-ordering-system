'use client';

import { useState } from 'react';

type GuidelineItem = {
  title: string;
  body: string;
};

const STORAGE_KEY = 'osso_program_guidelines_overrides_v1';

interface ProgramGuidelinesEditorProps {
  defaults: GuidelineItem[];
}

export default function ProgramGuidelinesEditor({ defaults }: ProgramGuidelinesEditorProps) {
  const [items, setItems] = useState<GuidelineItem[]>(() => {
    if (typeof window === 'undefined') return defaults;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    try {
      const parsed = JSON.parse(raw) as GuidelineItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    return defaults;
  });
  const [message, setMessage] = useState('');

  function update(index: number, key: keyof GuidelineItem, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    setMessage('Saved locally for this browser session/device.');
  }

  function resetToDefault() {
    setItems(defaults);
    window.localStorage.removeItem(STORAGE_KEY);
    setMessage('Reset to default guidelines.');
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6f5b40]">Edit baseline program guidelines for planning and copy updates. This does not overwrite individual company profiles.</p>
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="rounded-xl border border-[#e5d5bb] bg-[#fffdf8] p-4 space-y-2">
          <input
            value={item.title}
            onChange={(e) => update(index, 'title', e.target.value)}
            className="pos-input"
            placeholder="Guideline title"
          />
          <textarea
            value={item.body}
            onChange={(e) => update(index, 'body', e.target.value)}
            className="pos-input min-h-24"
            placeholder="Guideline body"
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} className="pos-btn-primary">Save Edits</button>
        <button type="button" onClick={resetToDefault} className="pos-btn-secondary">Reset Defaults</button>
      </div>
      {message && <p className="text-sm text-[#6f5b40]">{message}</p>}
    </div>
  );
}
