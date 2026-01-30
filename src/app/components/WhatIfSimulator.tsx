"use client";

import { useState } from "react";

interface WhatIfSimulatorProps {
  onClose: () => void;
  deals: Array<{
    id: string;
    name: string;
    stage: string;
    value: number;
    probability: number;
  }>;
}

export function WhatIfSimulator({ onClose, deals }: WhatIfSimulatorProps) {
  const [adjustments, setAdjustments] = useState<{
    [key: string]: { probability: number; value: number };
  }>({});

  const clampProbability = (p: unknown) => Math.max(0, Math.min(100, Number(p) || 0));
  const clampValue = (v: unknown) => Math.max(0, Number(v) || 0);

  function getValueSliderConfig(baseValue: number): { max: number; step: number } {
    const base = Math.max(0, Number(baseValue) || 0);
    const max = Math.max(1000, Math.round(base * 2));

    // Use a stable, sensible step size (prevents jitter from changing step mid-drag).
    const step =
      base <= 5000 ? 250 :
      base <= 20000 ? 500 :
      base <= 50000 ? 1000 :
      base <= 200000 ? 5000 :
      10000;

    return { max, step };
  }

  // Validate deals array
  const validDeals = Array.isArray(deals) && deals.length > 0 
    ? deals.filter(d => d && typeof d === 'object' && d.id && d.value != null && d.probability != null)
    : [];

  const originalValue = validDeals.reduce((sum, d) => {
    const val = clampValue(d.value);
    const prob = clampProbability(d.probability);
    return sum + (val * (prob / 100));
  }, 0);

  const adjustedValue = validDeals.reduce((sum, d) => {
    const adj = adjustments[d.id] || { probability: d.probability, value: d.value };
    const val = clampValue(adj.value);
    const prob = clampProbability(adj.probability);
    return sum + (val * (prob / 100));
  }, 0);

  const change = adjustedValue - originalValue;
  const changePercent = originalValue > 0 ? ((change / originalValue) * 100).toFixed(1) : "0";
  const safeChangePercent = isFinite(Number(changePercent)) ? changePercent : "0";

  const handleProbabilityChange = (dealId: string, value: number) => {
    // Validate input
    const validValue = Math.max(0, Math.min(100, Number(value) || 0));
    const dealData = validDeals.find((d) => d.id === dealId);
    if (!dealData) return;

    setAdjustments((prev) => ({
      ...prev,
      [dealId]: {
        ...(prev[dealId] || {
          probability: dealData.probability || 0,
          value: dealData.value || 0,
        }),
        probability: validValue,
      },
    }));
  };

  const handleValueChange = (dealId: string, value: number) => {
    // Validate input
    const validValue = Math.max(0, Number(value) || 0);
    const dealData = validDeals.find((d) => d.id === dealId);
    if (!dealData) return;

    setAdjustments((prev) => ({
      ...prev,
      [dealId]: {
        ...(prev[dealId] || {
          probability: dealData.probability || 0,
          value: dealData.value || 0,
        }),
        value: validValue,
      },
    }));
  };

  const resetAll = () => setAdjustments({});

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">What-If Simulator</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {validDeals.length === 0 ? (
            <div className="text-center py-8 text-slate-700 dark:text-slate-200">
              <p>No deals available to simulate.</p>
            </div>
          ) : (
            <>
          {/* Impact Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Original Pipeline</div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                ${isNaN(originalValue) ? "0" : (originalValue / 1000).toFixed(1)}k
              </div>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 border border-purple-200 dark:border-purple-800">
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Adjusted Pipeline</div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-2">
                ${isNaN(adjustedValue) ? "0" : (adjustedValue / 1000).toFixed(1)}k
              </div>
            </div>

            <div className={`rounded-lg bg-gradient-to-br p-4 border ${
              change >= 0
                ? "from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800"
                : "from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800"
            }`}>
              <div className={`text-sm font-medium ${
                change >= 0
                  ? "text-green-700 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
              }`}>
                Impact
              </div>
              <div className={`text-2xl font-bold mt-2 ${
                change >= 0
                  ? "text-green-900 dark:text-green-100"
                  : "text-red-900 dark:text-red-100"
              }`}>
                {change >= 0 ? "+" : ""}{(change / 1000).toFixed(1)}k ({safeChangePercent}%)
              </div>
            </div>
          </div>

          {/* Deal Adjustments */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Adjust Deals</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {validDeals.map((deal) => {
                const adj = adjustments[deal.id] || {
                  probability: deal.probability,
                  value: deal.value,
                };
                const baseValue = Math.max(0, Number(deal.value) || 0);
                const { max: valueMax, step: valueStep } = getValueSliderConfig(baseValue);
                const safeAdjProbability = clampProbability(adj.probability);
                const safeAdjValue = Math.max(0, Math.min(valueMax, clampValue(adj.value)));
                const dealValue = safeAdjValue * (safeAdjProbability / 100);

                return (
                  <div
                    key={deal.id}
                    className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {deal.name}
                        </div>
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                          {deal.stage}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          ${(dealValue / 1000).toFixed(1)}k
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-100 mb-2">
                          Probability: {safeAdjProbability}%
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={safeAdjProbability}
                          onChange={(e) => handleProbabilityChange(deal.id, e.currentTarget.valueAsNumber)}
                          className="w-full cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-100 mb-2">
                          Value: ${(safeAdjValue / 1000).toFixed(1)}k
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={valueMax}
                          step={valueStep}
                          value={safeAdjValue}
                          onChange={(e) => handleValueChange(deal.id, Math.min(valueMax, e.currentTarget.valueAsNumber))}
                          className="w-full cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={resetAll}
              className="flex-1 rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600 transition"
            >
              Reset All
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-700 hover:to-purple-700 transition"
            >
              Close
            </button>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
