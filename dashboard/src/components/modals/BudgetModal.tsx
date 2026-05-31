import type { BriefBudgetItem } from '../../types';

interface Props {
  item: BriefBudgetItem;
  onClose: () => void;
}

export function BudgetModal({ item, onClose }: Props) {
  const pct = item.utilization_pct;
  const pctDisplay = (pct * 100).toFixed(0);
  const isCritical = item.alert_status === 'CRITICAL';
  const barColor = pct >= 0.9 ? 'bg-red-500' : 'bg-amber-500';
  const badgeClass = isCritical ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Budget Risk — {item.client_name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Budget utilization</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${badgeClass}`}>
              {item.alert_status} · {pctDisplay}%
            </span>
          </div>

          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden mb-5">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(pct * 100, 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-5">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Budget cap</p>
              <p className="font-semibold text-gray-900">${item.budget_cap.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Total committed</p>
              <p className="font-semibold text-gray-900">${item.total_committed.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Already billed</p>
              <p className="font-medium text-gray-700">${item.budget_billed.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Approved, unbilled</p>
              <p className="font-medium text-gray-700">${item.approved_unbilled.toLocaleString()}</p>
            </div>
          </div>

          <div className={`rounded-lg p-3 text-sm ${isCritical ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
            <p className="font-medium">
              {isCritical
                ? 'Budget nearly exhausted. Notify client before posting additional time.'
                : 'Budget at warning threshold. Monitor new entries closely.'}
            </p>
            <p className="text-xs mt-1 opacity-75">Threshold: {(item.threshold_pct * 100).toFixed(0)}%</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
