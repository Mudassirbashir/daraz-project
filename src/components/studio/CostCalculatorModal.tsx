"use client";

import React, { useState } from "react";
import { X, DollarSign, Calculator, Percent, Tag, ShieldCheck } from "lucide-react";

interface CostCalculatorModalProps {
  initialCost: any;
  onClose: () => void;
  onSave: (cost: any, sellingPriceCents: number) => void;
}

export function CostCalculatorModal({ initialCost, onClose, onSave }: CostCalculatorModalProps) {
  const [material, setMaterial] = useState<number>(initialCost?.material || 150);
  const [laserCutting, setLaserCutting] = useState<number>(initialCost?.laser_cutting || 100);
  const [printing, setPrinting] = useState<number>(initialCost?.printing || 50);
  const [packaging, setPackaging] = useState<number>(initialCost?.packaging || 50);
  const [courier, setCourier] = useState<number>(initialCost?.courier || 150);
  const [commissionPct, setCommissionPct] = useState<number>(initialCost?.daraz_commission_pct || 8);
  const [taxPct, setTaxPct] = useState<number>(initialCost?.tax_pct || 2);
  const [targetProfitMarginPct, setTargetProfitMarginPct] = useState<number>(initialCost?.profit_margin_pct || 35);

  const directCosts = material + laserCutting + printing + packaging + courier;
  const percentageTotal = (commissionPct + taxPct + targetProfitMarginPct) / 100;
  const calculatedSellingPrice = percentageTotal < 1 ? directCosts / (1 - percentageTotal) : directCosts * 1.5;
  const sellingPriceCents = Math.round(calculatedSellingPrice * 100);
  const commissionAmt = calculatedSellingPrice * (commissionPct / 100);
  const taxAmt = calculatedSellingPrice * (taxPct / 100);
  const netProfit = calculatedSellingPrice - directCosts - commissionAmt - taxAmt;

  const handleApply = () => {
    onSave(
      {
        material,
        laser_cutting: laserCutting,
        printing,
        packaging,
        courier,
        daraz_commission_pct: commissionPct,
        tax_pct: taxPct,
        profit_margin_pct: targetProfitMarginPct,
      },
      sellingPriceCents
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="rounded-md bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
              Pricing Engine
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Product Cost & Selling Price Calculator</h2>
          </div>

          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Calculation Output Cards */}
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="text-[10px] font-bold uppercase text-slate-500">Direct Cost</span>
            <p className="mt-1 text-lg font-bold text-slate-900">PKR {directCosts.toFixed(2)}</p>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3">
            <span className="text-[10px] font-bold uppercase text-orange-700">Suggested Selling Price</span>
            <p className="mt-1 text-lg font-bold text-orange-900">PKR {calculatedSellingPrice.toFixed(2)}</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <span className="text-[10px] font-bold uppercase text-emerald-700">Net Profit</span>
            <p className="mt-1 text-lg font-bold text-emerald-900">PKR {netProfit.toFixed(2)}</p>
          </div>
        </div>

        {/* Input Fields Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Raw Material Cost (PKR)</label>
            <input
              type="number"
              value={material}
              onChange={(e) => setMaterial(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Laser Cutting Cost (PKR)</label>
            <input
              type="number"
              value={laserCutting}
              onChange={(e) => setLaserCutting(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Printing & Finishing (PKR)</label>
            <input
              type="number"
              value={printing}
              onChange={(e) => setPrinting(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Packaging Box/Flyer (PKR)</label>
            <input
              type="number"
              value={packaging}
              onChange={(e) => setPackaging(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Courier Shipping Fee (PKR)</label>
            <input
              type="number"
              value={courier}
              onChange={(e) => setCourier(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Daraz Commission (%)</label>
            <input
              type="number"
              value={commissionPct}
              onChange={(e) => setCommissionPct(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">WHT Tax (%)</label>
            <input
              type="number"
              value={taxPct}
              onChange={(e) => setTaxPct(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Net Profit Margin (%)</label>
            <input
              type="number"
              value={targetProfitMarginPct}
              onChange={(e) => setTargetProfitMarginPct(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="rounded-xl bg-orange-500 px-5 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-all shadow-sm"
          >
            Apply Calculated Price
          </button>
        </div>
      </div>
    </div>
  );
}
