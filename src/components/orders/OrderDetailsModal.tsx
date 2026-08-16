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
  AlertCircle,
  RefreshCw
} from "lucide-react";

import { getStoreDisplayName } from "@/lib/daraz/store-utils";

interface OrderDetailsModalProps {
  order: any | null;
  onClose: () => void;
  onOpenPackingModal?: (order: any) => void;
  onOpenPrintModal?: (order: any) => void;
  onOrderUpdated?: () => void;
}

export function OrderDetailsModal({
  order,
  onClose,
  onOpenPackingModal,
  onOpenPrintModal,
  onOrderUpdated,
}: OrderDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "developer">("details");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!order) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const amountFormatted = ((order.total_amount_cents || 0) / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  const rawJson = order.raw_payload || order.raw || {
    order_id: order.daraz_order_id,
    tracking_number: order.tracking_number,
    customer_name: order.customer_name,
    customer_city: order.customer_city,
    total_amount_cents: order.total_amount_cents,
    status: order.status,
    order_date: order.order_date,
  };

  // Two-Phase Action Model: Pack Order via API
  const handlePackOrder = async () => {
    setIsProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (data.success && data.darazConfirmed) {
        setActionSuccess("✓ Daraz Confirmed: Order packed successfully");
        if (onOrderUpdated) onOrderUpdated();
        setTimeout(() => {
          if (onOpenPrintModal) onOpenPrintModal(data.order || order);
        }, 1000);
      } else {
        setActionError(data.error || "Daraz did not accept this packing request.");
      }
    } catch (err: any) {
      setActionError(`Network error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = async (targetStatus: string) => {
    setIsProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      const data = await res.json();

      if (data.success) {
        setActionSuccess(data.message || `✓ Daraz Confirmed: Order status updated to '${targetStatus}'`);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        setActionError(data.error || `Daraz rejected status update to '${targetStatus}'.`);
      }
    } catch (err: any) {
      setActionError(`Network error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentOrdStatus = (order.workflow_status || order.status || "pending").toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-md bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
                {getStoreDisplayName(order.daraz_stores)}
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

        {/* Action Status Notification Banners */}
        {actionError && (
          <div className="flex items-center space-x-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

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
            <span>Raw Daraz API Response (Technical Details)</span>
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
                    <span className="font-semibold text-slate-800">{order.payment_method || "COD"}</span>
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
                    <p className="font-bold text-slate-900 capitalize">{(order.status || order.workflow_status || "Pending").replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-slate-500">Synchronized from Daraz Open Platform API</p>
                  </div>
                </div>

                <span className="rounded-md bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                  Daraz API Validated
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

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {(currentOrdStatus === "pending" || currentOrdStatus === "unpaid") && (
              <button
                onClick={handlePackOrder}
                disabled={isProcessing}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition-all"
              >
                {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                <span>{isProcessing ? "Sending..." : "Pack Order on Daraz"}</span>
              </button>
            )}

            {(currentOrdStatus === "pending" || currentOrdStatus === "packed") && (
              <button
                onClick={() => handleUpdateStatus("ready_to_ship")}
                disabled={isProcessing}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                <span>Ready to Ship</span>
              </button>
            )}

            {(currentOrdStatus === "ready_to_ship" || currentOrdStatus === "packed" || currentOrdStatus === "shipped") && (
              <button
                onClick={() => {
                  onClose();
                  if (onOpenPrintModal) onOpenPrintModal(order);
                }}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-all"
              >
                <Package className="h-4 w-4" />
                <span>Print Shipping Label</span>
              </button>
            )}

            {currentOrdStatus === "ready_to_ship" && (
              <button
                onClick={() => handleUpdateStatus("shipped")}
                disabled={isProcessing}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                <span>Mark Shipped</span>
              </button>
            )}

            {["pending", "unpaid", "packed", "ready_to_ship"].includes(currentOrdStatus) && (
              <button
                onClick={() => handleUpdateStatus("canceled")}
                disabled={isProcessing}
                className="inline-flex items-center space-x-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-all"
              >
                <span>Cancel Order</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-all shrink-0"
          >
            Close Order
          </button>
        </div>
      </div>
    </div>
  );
}
