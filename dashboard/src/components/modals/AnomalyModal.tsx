import { useState } from 'react';
import type { BriefAnomalyItem, ToolResult } from '../../types';
import { dismissAlert } from '../../api';

interface Props {
  item: BriefAnomalyItem;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ToolResult, itemId: string) => void;
}

const riskBadge: Record<string, string> = {
  CRITICAL: 'bg-red-50 text-red-700',
  ELEVATED: 'bg-orange-50 text-orange-700',
  ROUTINE: 'bg-gray-100 text-gray-600',
};

export function AnomalyModal({ item, firmId, attorneyId, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDismiss() {
    if (!reason.trim()) { setError('Reason required'); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await dismissAlert({
        firm_id: firmId,
        attorney_id: attorneyId,
        alert_id: item.escalation_id,
        alert_type: item.entity_type,
        reason,
        idempotency_key: `dismiss-anomaly-${item.escalation_id}`,
      });
      if (result.success) {
        onSuccess(result, item.escalation_id);
      } else {
        setError(result.message ?? 'Dismiss failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Anomaly — {item.entity_id}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${riskBadge[item.risk_level] ?? 'bg-gray-100 text-gray-600'}`}>
              {item.risk_level}
            </span>
            <span className="text-xs text-gray-500 font-mono">{item.entity_type}</span>
            <span className="text-xs text-gray-400">priority {item.priority}/5</span>
          </div>

          <div className="space-y-3 text-sm mb-5">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">What is happening</p>
              <p className="text-gray-900">{item.what_is_happening}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Why it matters</p>
              <p className="text-gray-700">{item.why_it_matters}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">What Litt has done</p>
              <p className="text-gray-700">{item.what_litt_has_done}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Attorney decision needed</p>
              <p className="text-blue-900 font-medium">{item.what_attorney_must_decide}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Dismissal reason (required)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Verified manually — no issue found"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={handleDismiss}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Dismissing…' : 'Dismiss Anomaly'}
          </button>
        </div>
      </div>
    </div>
  );
}
