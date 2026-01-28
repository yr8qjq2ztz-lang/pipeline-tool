"use client";

import { useState } from "react";
import { getTemplates, type DealTemplate } from "@/lib/utils/dealTemplates";

export interface DealTemplatesSelectorProps {
  onSelectTemplate: (template: DealTemplate) => void;
  onClose: () => void;
}

export function DealTemplatesSelector({
  onSelectTemplate,
  onClose,
}: DealTemplatesSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>("");

  // Validate callback functions exist
  if (!onSelectTemplate || !onClose) {
    console.error("DealTemplatesSelector: Missing required callbacks");
    return null;
  }

  const templates = getTemplates();
  // Validate templates is an array
  if (!Array.isArray(templates) || templates.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6">
          <p className="text-gray-900 dark:text-gray-100">No templates available.</p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleSelect = () => {
    // Validate selectedId is not empty
    if (!selectedId || typeof selectedId !== "string") {
      console.error("DealTemplatesSelector: Invalid template ID selected");
      return;
    }

    const template = templates.find((t) => t && t.id === selectedId);
    if (!template) {
      console.error("DealTemplatesSelector: Template not found for ID:", selectedId);
      return;
    }

    // Validate template structure before passing
    if (!template.name || !template.stage || typeof template.probability !== "number") {
      console.error("DealTemplatesSelector: Invalid template structure:", template);
      return;
    }

    try {
      onSelectTemplate(template);
      onClose();
    } catch (e) {
      console.error("DealTemplatesSelector: Error selecting template:", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex justify-between items-center rounded-t-2xl">
          <h2 className="text-xl font-bold">Use a Deal Template</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => setSelectedId(template.id)}
              className={`rounded-lg p-4 cursor-pointer border-2 transition-all ${
                selectedId === template.id
                  ? "border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-950"
                  : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {template.description}
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedId === template.id
                      ? "border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-400"
                      : "border-gray-300 dark:border-slate-600"
                  }`}
                >
                  {selectedId === template.id && (
                    <span className="text-white dark:text-slate-800 text-xs">✓</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 text-xs">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Stage</span>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {template.stage}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Probability</span>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {template.probability}%
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Est. Value</span>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    ${(template.estimatedValue / 1000).toFixed(0)}k
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Close Days</span>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {template.daysToClose}d
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedId}
            className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 text-sm font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 transition"
          >
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}
