import { useState } from 'react';
import type { BriefTimeEntryItem, ToolResult } from '../../types';
import { approveBilling, writeDownBilling, writeOffBilling, updateNarrative } from '../../api';

export type BillingAction = 'approve' | 'write-down' | 'write-off' | 'narrative';

interface Props {
  item: BriefTimeEntryItem;
  action: BillingAction;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ToolResult, itemId: string) => void;
}

const actionTitle: Record<BillingAction, string> = {
  approve: 'Approve Entry',
  'write-down': 'Write Down Entry',
  'write-off': 'Write Off Entry',
  narrative: 'Edit Narrative',
};

export function BillingWIPModal({ item, action, firmId, attorneyId, onClose, onSuccess }: Props) {
  const [newHours, setNewHours] = useState(String(item.hours));
  const [reason, setReason] = useState('');
  const [narrative, setNarrative] = useState(item.narrative ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = actionTitle[action];

  async function handleSubmit() {
    if (action === 'write-down' && (!reason.trim() || !newHours)) {
      setError('New hours and reason required');
      return;
    }
    if (action === 'write-off' && !reason.trim()) {
      setError('Reason required');
      return;
    }
    if (action === 'narrative' && !narrative.trim()) {
      setError('Narrative cannot be empty');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let result;
      const idem = `${action}-${item.entry_id}-${Date.now()}`;
      if (action === 'approve') {
        result = await approveBilling({ firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id, expected_status: 'PENDING', idempotency_key: idem });
      } else if (action === 'write-down') {
        result = await writeDownBilling({ firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id, new_hours: parseFloat(newHours), new_amount: parseFloat(newHours) * 350, reason, expected_status: 'PENDING', idempotency_key: idem });
      } else if (action === 'write-off') {
        result = await writeOffBilling({ firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id, reason, expected_status: 'PENDING', idempotency_key: idem });
      } else {
        result = await updateNarrative({ firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id, narrative, idempotency_key: idem });
      }
      if (result.success) {
        onSuccess(result, item.entry_id);
      } else {
        setError(result.message ?? 'Action failed');
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
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-4">
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
              {item.has_block && <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-50 text-red-700">BLOCK</span>}
              {item.has_warn && !item.has_block && <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700">WARN</span>}
              <span className="text-xs font-mono text-gray-500">{item.entry_id}</span>
              <span className="text-xs text-gray-400">{item.status}</span>
            </div>
            <p className="text-sm text-gray-900 break-words">
              {item.narrative ?? <span className="italic text-gray-400">No narrative</span>}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {item.hours}h · ${item.amount.toFixed(2)} · {item.matter_name} · {item.entry_date}
            </p>
          </div>

          {item.scrubber_flags.length > 0 && (
            <div className="mb-4 space-y-1">
              {item.scrubber_flags.map((f, i) => (
                <div key={i} className={`text-xs rounded px-2 py-1.5 ${f.severity === 'BLOCK' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  <span className="font-bold">{f.severity}</span> · {f.check_name}: {f.message}
                  {f.matched_text && <span className="italic"> ("{f.matched_text}")</span>}
                </div>
              ))}
            </div>
          )}

          {action === 'approve' && (
            <p className="text-sm text-gray-600">
              Advances this entry to APPROVED for billing.
              {item.has_block && (
                <span className="block mt-2 text-red-600 font-medium">
                  This entry has BLOCK-level scrubber flags. Resolve the flagged issues before approving.
                </span>
              )}
            </p>
          )}

          {action === 'write-down' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New hours (current: {item.hours}h)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={newHours}
                  onChange={e => setNewHours(e.target.value)}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Reduce per client billing guidelines"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {action === 'write-off' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Non-billable internal work"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          {action === 'narrative' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Narrative</label>
              <textarea
                value={narrative}
                onChange={e => setNarrative(e.target.value)}
                rows={4}
                placeholder="Describe work performed…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
              action === 'write-off' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Saving…' : title}
          </button>
        </div>
      </div>
    </div>
  );
}
