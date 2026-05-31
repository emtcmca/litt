import { useEffect } from 'react';
import type { ToolResult } from '../../types';

interface Props {
  result: ToolResult | null;
  onClose: () => void;
}

export function AuditEventDrawer({ result, onClose }: Props) {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [result, onClose]);

  if (!result) return null;

  const ts = (result.data?.timestamp as string | undefined)?.slice(0, 19).replace('T', ' ') ?? new Date().toISOString().slice(0, 19).replace('T', ' ');
  const actor = (result.data?.actor as string | undefined) ?? '—';

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl shadow-2xl overflow-hidden">
      <div className="px-4 py-3 bg-green-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white text-sm font-semibold">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Written to audit log
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none ml-2">×</button>
      </div>
      <div className="bg-gray-900 px-4 py-3 space-y-1.5 font-mono text-xs">
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">event id</span>
          <span className="text-green-400 truncate">{result.audit_event_id}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">entity</span>
          <span className="text-gray-300">{result.entity_type} / {result.entity_id}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">actor</span>
          <span className="text-gray-300">{actor}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">at</span>
          <span className="text-gray-300">{ts} UTC</span>
        </div>
      </div>
    </div>
  );
}
