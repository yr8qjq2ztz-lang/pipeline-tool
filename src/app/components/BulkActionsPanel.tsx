"use client";

import { useState } from "react";

export interface BulkActionProps {
  selectedIds: string[];
  onAction: (
    action: "updateStage" | "updateBranch" | "deleteBulk",
    value?: string
  ) => Promise<void>;
  onClose: () => void;
}

export function BulkActionsPanel({
  selectedIds,
  onAction,
  onClose,
}: BulkActionProps) {
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<
    "" | "updateStage" | "updateBranch" | "deleteBulk"
  >("");
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");

  const STAGES = [
    "Prospecting",
    "Qualified",
    "Proposal",
    "Negotiation",
    "Won",
    "Lost",
  ];

  const handleAction = async () => {
    // Validate selections
    if (!selectedAction || !Array.isArray(selectedIds) || selectedIds.length === 0) {
      console.warn("No action or selected IDs");
      return;
    }

    // Validate required parameters for each action
    if (selectedAction === "updateStage" && !selectedStage) {
      console.warn("Stage required for updateStage action");
      return;
    }
    if (selectedAction === "updateBranch" && !selectedBranch) {
      console.warn("Branch required for updateBranch action");
      return;
    }

    setLoading(true);
    try {
      if (selectedAction === "updateStage" && selectedStage) {
        await onAction("updateStage", selectedStage);
      } else if (selectedAction === "updateBranch" && selectedBranch) {
        await onAction("updateBranch", selectedBranch);
      } else if (selectedAction === "deleteBulk") {
        // Confirm before deleting
        if (window.confirm(`Delete ${selectedIds.length} deal(s)? This cannot be undone.`)) {
          await onAction("deleteBulk");
        } else {
          setLoading(false);
          return;
        }
      }
      onClose();
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Bulk action failed:", error);
      }
      alert("Action failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-6 max-w-sm w-full space-y-4 z-40">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-white">
          Bulk Actions ({selectedIds.length})
        </h3>
        <button
          onClick={onClose}
          className="text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Action
          </label>
          <select
            value={selectedAction}
            onChange={(e) => {
              const value = e.target.value;
              if (
                value === "" ||
                value === "updateStage" ||
                value === "updateBranch" ||
                value === "deleteBulk"
              ) {
                setSelectedAction(value);
              }
            }}
            className="w-full rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100"
          >
            <option value="">Select an action...</option>
            <option value="updateStage">Update Stage</option>
            <option value="updateBranch">Update Branch</option>
            <option value="deleteBulk">Delete All</option>
          </select>
        </div>

        {selectedAction === "updateStage" && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Stage
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              <option value="">Choose stage...</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedAction === "updateBranch" && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Branch
            </label>
            <input
              type="text"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              placeholder="Branch ID"
              className="w-full rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100"
            />
          </div>
        )}

        {selectedAction === "deleteBulk" && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-3 rounded-lg border border-red-200 dark:border-red-900">
            ⚠️ This will permanently delete {selectedIds.length} deal(s). This cannot be undone.
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleAction}
          disabled={loading || !selectedAction}
          className="flex-1 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition"
        >
          {loading ? "Applying..." : "Apply"}
        </button>
      </div>
    </div>
  );
}
