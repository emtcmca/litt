import { useState } from 'react';
import type { BriefClientSilenceItem, ToolResult } from '../../types';
import { approveComm, queueComm, dismissComm } from '../../api';

interface Props {
  item: BriefClientSilenceItem;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ToolResult, itemId: string) => void;
}

export function ClientCommsModal({ item, firmId, attorneyId, onClose, onSuccess }: Props) {
  const [dismissReason, setDismissReason] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(op: string, apiFn: () => Promise<import('../../types').ActionResult>) {
    setLoading(op);
    setError(null);
    try {
      const result = await apiFn();
      if (result.success) {
        onSuccess(result, item.matter_id);
      } else {
        setError(result.message ?? 'Action failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(null);
    }
  }

  function handleApprove() {
    if (!item.comm_draft_id) return;
    run('approve', () => approveComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: item.comm_draft_id! }));
  }

  function handleQueue() {
    if (!item.comm_draft_id) return;
    run('queue', () => queueComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: item.comm_draft_id! }));
  }

  function handleDismiss() {
    if (!dismissReason.trim()) { setError('Reason required to dismiss'); return; }
    if (!item.comm_draft_id) return;
    run('dismiss', () => dismissComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: item.comm_draft_id!, reason: dismissReason }));
  }

  const hasDraft = Boolean(item.comm_draft_id);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Client Silence — Draft Outreach</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-4">
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700">SILENCE</span>
              <span className="text-xs font-mono text-gray-500">{item.matter_id}</span>
              <span className="text-xs font-medium text-orange-600">{item.days_since_contact} days</span>
            </div>
            <p className="text-sm text-gray-900 font-medium">{item.matter_name}</p>
            <p className="text-xs text-gray-500 mt-1">
              {item.client_name} · threshold: {item.threshold_days}d
              {item.last_contact_date && ` · last contact: ${item.last_contact_date}`}
            </p>
          </div>

          {hasDraft ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800 font-medium mb-1">Litt drafted an outreach email</p>
                <p className="text-xs text-blue-600 font-mono">Draft ID: {item.comm_draft_id}</p>
                <p className="text-xs text-blue-600 mt-1">
                  Generated from {item.days_since_contact}-day silence trigger. Review before sending to client.
                </p>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">Dismiss reason (if dismissing instead)</label>
                <textarea
                  value={dismissReason}
                  onChange={e => setDismissReason(e.target.value)}
                  rows={2}
                  placeholder="Reason for dismissal (required)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              No draft generated yet. Run a sweep to trigger Litt's draft generation for this matter.
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <button
            onClick={handleDismiss}
            disabled={loading !== null || !hasDraft}
            className="px-4 py-2 text-sm text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
          >
            {loading === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">
              Cancel
            </button>
            {hasDraft && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={loading !== null}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading === 'approve' ? 'Approving…' : 'Approve Draft'}
                </button>
                <button
                  onClick={handleQueue}
                  disabled={loading !== null}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading === 'queue' ? 'Queuing…' : 'Queue to Send'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
