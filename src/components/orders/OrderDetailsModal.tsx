"use client";

import React, { useState } from "react";
import {
  X,
  ShoppingCart,
  User,
  MapPin,
  Phone,
  Truck,
  CreditCard,
  Copy,
  Check,
  Code,
  Clock,
  CheckCircle2,
  Package,
  DollarSign
} from "lucide-react";

interface OrderDetailsModalProps {
  order: any | null;
  onClose: () => void;
  onOpenPackingModal?: (order: any) => void;
  onOpenPrintModal?: (order: any) => void;
}

export function OrderDetailsModal({
  order,
  onClose,
  onOpenPackingModal,
  onOpenPrintModal,
}: OrderDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "developer">("details");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!order) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const amountFormatted = (order.total_amount_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  const rawJson = order.raw || {
    order_id: order.daraz_order_id,
    tracking_number: order.tracking_number,
    customer_name: order.customer_name,
    customer_city: order.customer_city,
    total_amount_cents: order.total_amount_cents,
    status: order.status,
    order_date: order.order_date,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-md bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
                {order.daraz_stores?.store_name || "Daraz Store"}
              </span>
              <span className="font-mono text-xs text-slate-500 font-bold">Order #{order.daraz_order_id}</span>

              <button
                onClick={() => copyToClipboard(order.daraz_order_id, "order_id")}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                title="Copy Order ID"
              >
                {copiedField === "order_id" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <h2 className="text-xl font-bold text-slate-900 mt-1">Daraz Order Details</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 text-xs">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex items-center space-x-1.5 px-4 py-2 font-bold rounded-lg transition-all ${
              activeTab === "details" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Order Summary & Fulfillment</span>
          </button>

          <button
            onClick={() => setActiveTab("developer")}
            className={`flex items-center space-x-1.5 px-4 py-2 font-bold rounded-lg transition-all ${
              activeTab === "developer" ? "bg-purple-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Code className="h-4 w-4" />
            <span>Raw Daraz API Response (Developer Tab)</span>
          </button>
        </div>

        {activeTab === "details" ? (
          <div className="space-y-6 text-xs">
            {/* Grid 1: Customer, Shipping & Financial Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Customer Info */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <User className="h-4 w-4 text-orange-500" />
                  <span>Customer Information</span>
                </h3>
                <div className="space-y-1.5 pt-1">
                  <p className="font-bold text-slate-900 text-sm">{order.customer_name || "Customer"}</p>
                  <p className="text-slate-600 flex items-center space-x-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{order.customer_phone || "Phone on file"}</span>
                  </p>
                </div>
              </div>

              {/* Shipping Info */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  <span>Shipping Address & Logistics</span>
                </h3>
                <div className="space-y-1 pt-1">
                  <p className="font-semibold text-slate-800">{order.customer_city || "Pakistan"}</p>
                  <p className="text-slate-600 line-clamp-2">{order.customer_address || "Address on File"}</p>
                  <div className="flex items-center space-x-1.5 pt-1 text-[11px] text-slate-500">
                    <Truck className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-mono">{order.tracking_number || "Tracking Pending"}</span>
                    {order.tracking_number && (
                      <button
                        onClick={() => copyToClipboard(order.tracking_number, "tracking")}
                        className="text-slate-400 hover:text-slate-700"
                        title="Copy Tracking Number"
                      >
                        {copiedField === "tracking" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <CreditCard className="h-4 w-4 text-purple-500" />
                  <span>Payment & Financial Summary</span>
                </h3>
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Amount:</span>
                    <span className="font-bold text-slate-900 text-sm">{amountFormatted}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-500">Payment Method:</span>
                    <span className="font-semibold text-slate-800">COD</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-500">Order Date:</span>
                    <span>{new Date(order.order_date).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <Clock className="h-4 w-4 text-orange-500" />
                <span>Order Status Timeline</span>
              </h3>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-2">
                  <span className="rounded-full bg-emerald-100 p-1.5 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold text-slate-900 capitalize">{order.status || "Pending"}</p>
                    <p className="text-[11px] text-slate-500">Synchronized from Daraz Open Platform API</p>
                  </div>
                </div>

                <span className="rounded-md bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                  Live API Validated
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Developer Raw API Json Tab */
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-[60vh]">
            <pre>{JSON.stringify(rawJson, null, 2)}</pre>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            {!order.is_packed ? (
              <button
                onClick={() => {
                  onClose();
                  if (onOpenPackingModal) onOpenPackingModal(order);
                }}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-700 transition-all apple-press"
              >
                <Package className="h-4 w-4" />
                <span>Pack Order</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  if (onOpenPrintModal) onOpenPrintModal(order);
                }}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-all apple-press"
              >
                <Truck className="h-4 w-4" />
                <span>Print Official Shipping Label</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all"
          >
            Close Order
          </button>
        </div>
      </div>
    </div>
  );
}
