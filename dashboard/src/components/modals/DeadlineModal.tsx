import { useState } from 'react';
import type { BriefDeadlineItem, ToolResult } from '../../types';
import { confirmDeadline, extendDeadline, dismissDeadline } from '../../api';

export type DeadlineAction = 'confirm' | 'extend' | 'dismiss';

interface Props {
  item: BriefDeadlineItem;
  action: DeadlineAction;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ToolResult, itemId: string) => void;
}

const classColor: Record<string, string> = {
  HARD_LEGAL: 'bg-red-50 text-red-700',
  HARD_CONTRACTUAL: 'bg-orange-50 text-orange-700',
  SOFT_INTERNAL: 'bg-blue-50 text-blue-700',
  ADMINISTRATIVE: 'bg-gray-100 text-gray-700',
};

export function DeadlineModal({ item, action, firmId, attorneyId, onClose, onSuccess }: Props) {
  const [newDueDate, setNewDueDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = { confirm: 'Confirm Deadline', extend: 'Extend Deadline', dismiss: 'Dismiss Deadline' }[action];

  async function handleSubmit() {
    if (action === 'extend' && (!newDueDate || !reason.trim())) {
      setError('New date and reason required');
      return;
    }
    if (action === 'dismiss' && !reason.trim()) {
      setError('Reason required to dismiss');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let result;
      if (action === 'confirm') {
        result = await confirmDeadline({ firm_id: firmId, attorney_id: attorneyId, deadline_id: item.deadline_id, idempotency_key: `confirm-${item.deadline_id}-${Date.now()}` });
      } else if (action === 'extend') {
        result = await extendDeadline({ firm_id: firmId, attorney_id: attorneyId, deadline_id: item.deadline_id, new_due_date: newDueDate, reason, idempotency_key: `extend-${item.deadline_id}-${Date.now()}` });
      } else {
        result = await dismissDeadline({ firm_id: firmId, attorney_id: attorneyId, deadline_id: item.deadline_id, reason, idempotency_key: `dismiss-${item.deadline_id}-${Date.now()}` });
      }
      if (result.success) {
        onSuccess(result, item.deadline_id);
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
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${classColor[item.classification] ?? 'bg-gray-100 text-gray-700'}`}>
                {item.classification}
              </span>
              <span className="text-xs font-mono text-gray-500">{item.deadline_id}</span>
            </div>
            <p className="text-sm text-gray-900 font-medium">{item.description}</p>
            <p className="text-xs text-gray-500 mt-1">
              Due {item.due_date} · {item.days_out} days out · {item.matter_name} · {item.client_name}
            </p>
          </div>

          {action === 'confirm' && (
            <p className="text-sm text-gray-600">
              Logs your review to the audit trail. Use Extend if the date is changing, Dismiss if the deadline is no longer relevant.
            </p>
          )}

          {action === 'extend' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New due date</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Opposing counsel agreed to 7-day extension"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {action === 'dismiss' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Resolved by settlement agreement"
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
              action === 'dismiss' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Saving…' : title}
          </button>
        </div>
      </div>
    </div>
  );
}
