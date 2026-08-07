"use client";

import React, { useState } from "react";
import {
  X,
  DollarSign,
  TrendingUp,
  PieChart,
  Tag,
  Store,
  Layers,
  Copy,
  Check,
  ShieldCheck,
  Percent,
  Receipt
} from "lucide-react";

interface OrderProfitModalProps {
  record: any | null;
  onClose: () => void;
}

export function OrderProfitModal({ record, onClose }: OrderProfitModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!record) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const revenueFormatted = (record.price_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });
  const cogsFormatted = (record.cogs_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });
  const commissionFormatted = (record.commission_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });
  const paymentFeeFormatted = (record.payment_fee_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });
  const shippingFormatted = (record.shipping_fee_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });
  const totalExpensesFormatted = (record.total_expenses_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });
  const netProfitFormatted = (record.net_profit_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  const isProfitable = record.net_profit_cents > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-md bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                {record.store_name} ({record.store_code})
              </span>
              <span className="font-mono text-xs text-slate-500 font-bold">SKU: {record.seller_sku}</span>
              <button
                onClick={() => copyToClipboard(record.seller_sku, "sku")}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Copy SKU"
              >
                {copiedField === "sku" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">{record.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profit Metrics Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center">
            <span className="text-[11px] font-bold uppercase text-slate-500">Gross Selling Revenue</span>
            <p className="mt-1 text-2xl font-bold text-slate-900">{revenueFormatted}</p>
          </div>

          <div className={`rounded-xl border p-4 text-center ${isProfitable ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"}`}>
            <span className={`text-[11px] font-bold uppercase ${isProfitable ? "text-emerald-700" : "text-red-700"}`}>Net Profit</span>
            <p className={`mt-1 text-2xl font-bold ${isProfitable ? "text-emerald-900" : "text-red-900"}`}>{netProfitFormatted}</p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-center">
            <span className="text-[11px] font-bold uppercase text-blue-700">Profit Margin</span>
            <p className="mt-1 text-2xl font-bold text-blue-900">{record.margin_percentage}%</p>
          </div>
        </div>

        {/* Cost & Expense Breakdown Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
            <Receipt className="h-4 w-4 text-orange-500" />
            <span>Financial Cost & Fee Breakdown</span>
          </h3>

          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Product Revenue (Selling Price):</span>
              <span className="font-bold text-slate-900">{revenueFormatted}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Cost of Goods Sold (COGS):</span>
              <span className="font-semibold text-slate-800">- {cogsFormatted}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Daraz Marketplace Commission (8%):</span>
              <span className="font-semibold text-red-600">- {commissionFormatted}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Payment Handling Fee (1.5%):</span>
              <span className="font-semibold text-red-600">- {paymentFeeFormatted}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">DEX Logistics & Shipping Fee:</span>
              <span className="font-semibold text-red-600">- {shippingFormatted}</span>
            </div>

            <div className="flex justify-between py-2 font-bold text-sm text-slate-900 border-t border-slate-200">
              <span>Net Settled Profit:</span>
              <span className={isProfitable ? "text-emerald-600" : "text-red-600"}>{netProfitFormatted} ({record.margin_percentage}%)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all"
          >
            Close Financial Details
          </button>
        </div>
      </div>
    </div>
  );
}
