'use client';

import React, { useState } from 'react';

export function TestConnectionButton({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setStatusMsg(null);
    setIsSuccess(null);

    try {
      const res = await fetch(`/api/stores/${storeId}/test-connection`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        setIsSuccess(true);
        setStatusMsg(data.message || 'Connection test successful!');
      } else {
        setIsSuccess(false);
        setStatusMsg(data.error || 'Connection failed.');
      }
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMsg(err.message || 'Network error while testing connection.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleTest}
        disabled={testing}
        className="px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/50 rounded-lg transition disabled:opacity-50"
      >
        {testing ? 'Testing...' : '⚡ Test Connection'}
      </button>
      {statusMsg && (
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
            isSuccess ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
          }`}
        >
          {statusMsg}
        </span>
      )}
    </div>
  );
}
