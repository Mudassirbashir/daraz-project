"use client";

import React from "react";
import {
  X,
  User,
  Phone,
  MapPin,
  ShoppingCart,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Award
} from "lucide-react";

interface CustomerProfileModalProps {
  customer: any | null;
  onClose: () => void;
}

export function CustomerProfileModal({ customer, onClose }: CustomerProfileModalProps) {
  if (!customer) return null;

  const totalSpendFormatted = (customer.totalSpendCents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  const aovFormatted = (customer.aovCents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-md bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                Customer Profile
              </span>
              {customer.isHighValue && (
                <span className="inline-flex items-center space-x-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                  <Award className="h-3 w-3" />
                  <span>High Value VIP</span>
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">{customer.name}</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Customer Quick Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-center space-x-2">
            <Phone className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-500">Phone:</span>
              <p className="font-mono font-bold text-slate-800">{customer.phone}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-500">Location:</span>
              <p className="font-bold text-slate-800">{customer.city}, {customer.province}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-500">First Order:</span>
              <p className="font-semibold text-slate-700">{new Date(customer.firstOrderDate).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="rounded-xl border border-slate-200 p-3 bg-white">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Orders</span>
            <p className="mt-0.5 text-xl font-bold text-slate-900">{customer.ordersCount}</p>
          </div>

          <div className="rounded-xl border border-emerald-200 p-3 bg-emerald-50/50">
            <span className="text-[10px] font-bold uppercase text-emerald-700">Total Spend</span>
            <p className="mt-0.5 text-xl font-bold text-emerald-900">{totalSpendFormatted}</p>
          </div>

          <div className="rounded-xl border border-blue-200 p-3 bg-blue-50/50">
            <span className="text-[10px] font-bold uppercase text-blue-700">Avg Order Value</span>
            <p className="mt-0.5 text-xl font-bold text-blue-900">{aovFormatted}</p>
          </div>

          <div className="rounded-xl border border-purple-200 p-3 bg-purple-50/50">
            <span className="text-[10px] font-bold uppercase text-purple-700">Fulfillment Net</span>
            <p className="mt-0.5 text-xl font-bold text-purple-900">{customer.deliveredCount} Delivered</p>
          </div>
        </div>

        {/* Order History Table */}
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
            <ShoppingCart className="h-4 w-4 text-orange-500" />
            <span>Complete Order History ({customer.ordersList.length})</span>
          </h3>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden text-xs max-h-60 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Order ID</th>
                  <th className="p-2.5">Store</th>
                  <th className="p-2.5">Amount (PKR)</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Order Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {customer.ordersList.map((ord: any) => {
                  const amt = (ord.total_amount_cents / 100).toLocaleString("en-PK", {
                    style: "currency",
                    currency: "PKR",
                  });

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">#{ord.daraz_order_id}</td>
                      <td className="p-2.5 font-sans font-medium text-slate-700">{ord.daraz_stores?.store_name}</td>
                      <td className="p-2.5 font-bold text-slate-900">{amt}</td>
                      <td className="p-2.5 font-sans capitalize font-semibold text-slate-700">{ord.status}</td>
                      <td className="p-2.5 text-slate-500 text-[11px]">{new Date(ord.order_date).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
}
