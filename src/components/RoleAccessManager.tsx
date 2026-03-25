'use client';

import { useState } from 'react';

interface RoleAccessManagerProps {
  currentRole: string;
}

export default function RoleAccessManager({ currentRole }: RoleAccessManagerProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function promoteSelf() {
    setLoading(true);
    setMessage('');

    const res = await fetch('/api/auth/promote-self', { method: 'POST' });
    const body = await res.json().catch(() => ({}));

    setLoading(false);
    if (!res.ok) {
      setMessage(body.error || 'Could not update role.');
      return;
    }

    setMessage('Role updated to admin. Refresh to apply updated guards.');
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#e5d5bb] bg-[#fffdf8] p-4">
      <p className="text-sm text-[#6f5b40]">Current role: <span className="font-semibold text-[#2f2416] capitalize">{currentRole}</span></p>
      <button type="button" onClick={promoteSelf} disabled={loading} className="pos-btn-secondary">
        {loading ? 'Updating...' : 'Grant Me Admin Access'}
      </button>
      {message && <p className="text-sm text-[#6f5b40]">{message}</p>}
    </div>
  );
}
