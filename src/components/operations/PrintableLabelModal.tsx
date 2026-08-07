"use client";

import React, { useState } from "react";
import { X, Printer, QrCode, Barcode, PackageCheck, FileText, Truck, ShieldCheck } from "lucide-react";

interface PrintableLabelModalProps {
  order: any | null;
  onClose: () => void;
}

export function PrintableLabelModal({ order, onClose }: PrintableLabelModalProps) {
  const [docType, setDocType] = useState<"slip" | "label" | "invoice">("slip");

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const amountFormatted = (order.total_amount_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-md bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                {order.daraz_stores?.store_name || "Daraz Store"}
              </span>
              <span className="font-mono text-xs text-slate-500 font-bold">Order #{order.daraz_order_id}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">WMS Printable Document Station</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Document Selector Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs">
          <div className="flex space-x-2">
            <button
              onClick={() => setDocType("slip")}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                docType === "slip" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Packing Slip
            </button>

            <button
              onClick={() => setDocType("label")}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                docType === "label" ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Shipping Label
            </button>

            <button
              onClick={() => setDocType("invoice")}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                docType === "invoice" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Customer Invoice
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 font-bold text-white hover:bg-emerald-700 transition-all shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>Print Document</span>
          </button>
        </div>

        {/* Printable View Body */}
        <div id="printable-area" className="rounded-xl border-2 border-slate-900 p-6 bg-white space-y-4 text-xs font-sans text-slate-900">
          {/* Top Bar Barcode Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <p className="font-extrabold text-sm uppercase tracking-wider">
                DARAZ EXPRESS (DEX) — WMS {docType.toUpperCase()}
              </p>
              <p className="font-mono text-[11px] text-slate-600">Store: {order.daraz_stores?.store_name} ({order.daraz_stores?.store_code})</p>
            </div>

            <div className="text-right font-mono">
              <p className="font-bold text-xs">ORDER #{order.daraz_order_id}</p>
              <p className="text-[10px] text-slate-500">{new Date(order.order_date).toLocaleString()}</p>
            </div>
          </div>

          {/* Barcode & QR Code Section */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 border border-slate-300">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Tracking Number Barcode</span>
              <p className="font-mono font-extrabold text-sm text-slate-900">{order.tracking_number || `DEX-PK-${order.daraz_order_id}`}</p>
              <div className="flex space-x-1 font-mono text-[10px] text-slate-400">
                <span>||| | |||| ||| || |||| ||| ||||</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 border-l border-slate-200 pl-4">
              <QrCode className="h-10 w-10 text-slate-900" />
              <div className="text-[10px]">
                <p className="font-bold">Scan to Verify</p>
                <p className="text-slate-500">DEX WMS Hub</p>
              </div>
            </div>
          </div>

          {/* Customer & Shipping Addresses */}
          <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-3">
            <div className="space-y-1">
              <p className="font-bold text-slate-700 text-[11px] uppercase">Ship To:</p>
              <p className="font-bold text-slate-900 text-xs">{order.customer_name || "Customer"}</p>
              <p className="text-slate-600">{order.customer_address || "Shipping Address on File"}</p>
              <p className="font-semibold text-slate-800">{order.customer_city || "Pakistan"}</p>
              <p className="font-mono text-slate-500">Phone: {order.customer_phone || "N/A"}</p>
            </div>

            <div className="space-y-1 text-right">
              <p className="font-bold text-slate-700 text-[11px] uppercase">Fulfillment Details:</p>
              <p className="font-semibold text-slate-800">Carrier: {order.shipping_provider || "Daraz Express (DEX)"}</p>
              <p className="text-slate-600">Payment: COD (Cash On Delivery)</p>
              <p className="font-bold text-slate-900">Total COD Amount: {amountFormatted}</p>
              <p className="font-mono text-[11px] text-slate-500">Bay Shelf: {order.shelf_location || "Not Available"}</p>
            </div>
          </div>

          {/* Document Content Table */}
          <div>
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2">Item Description</th>
                  <th className="p-2">Shelf / Bin</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-2 font-bold text-slate-900">Order Items #{order.daraz_order_id}</td>
                  <td className="p-2 font-mono text-slate-600">{order.shelf_location || "Not Available"}</td>
                  <td className="p-2 text-center font-bold">1</td>
                  <td className="p-2 text-right font-bold text-slate-900">{amountFormatted}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signoff Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[10px] text-slate-500">
            <span>Verified by Daraz Operations WMS</span>
            <span>Signature: ______________________</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
