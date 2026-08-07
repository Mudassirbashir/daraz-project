"use client";

import React, { useState } from "react";
import { X, Package, DollarSign, Tag, Store, ShieldCheck, Image as ImageIcon, Layers, CheckCircle2, Clock } from "lucide-react";

interface ProductDetailModalProps {
  product: any | null;
  onClose: () => void;
}

export function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  if (!product) return null;

  const priceFormatted = (product.price_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  const specialPriceFormatted = product.special_price_cents
    ? (product.special_price_cents / 100).toLocaleString("en-PK", {
        style: "currency",
        currency: "PKR",
      })
    : null;

  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [];

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                {product.daraz_stores?.store_name || "Daraz Store"}
              </span>
              <span className="font-mono text-xs text-slate-400">ID: {product.daraz_item_id || product.id}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">{product.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gallery View */}
          <div className="space-y-3">
            <div className="h-64 w-full rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden relative">
              {images.length > 0 ? (
                <img
                  src={images[activeImageIndex]}
                  alt={product.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-400 space-y-1">
                  <ImageIcon className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="text-xs">No image available</p>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                {images.map((imgUrl: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`h-14 w-14 rounded-lg border overflow-hidden shrink-0 transition-all ${
                      activeImageIndex === idx ? "border-orange-500 ring-2 ring-orange-200" : "border-slate-200 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={imgUrl} alt="Thumbnail" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Attributes & Variant Details */}
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <Tag className="h-4 w-4 text-orange-500" />
                <span>Pricing & Stock Metrics</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-500">Regular Price:</span>
                  <p className="text-base font-bold text-slate-900">{priceFormatted}</p>
                </div>

                {specialPriceFormatted && (
                  <div>
                    <span className="text-slate-500">Special Price:</span>
                    <p className="text-base font-bold text-emerald-600">{specialPriceFormatted}</p>
                  </div>
                )}

                <div>
                  <span className="text-slate-500">Stock Quantity:</span>
                  <p className="text-sm font-bold text-slate-800">{product.stock_quantity} Units</p>
                </div>

                <div>
                  <span className="text-slate-500">Sync Status:</span>
                  <p className="text-xs font-bold text-emerald-600 flex items-center space-x-1 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Live Synced</span>
                  </p>
                </div>
              </div>
            </div>

            {/* SKU Details */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <Layers className="h-4 w-4 text-blue-500" />
                <span>SKU & Variant Information</span>
              </h3>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Seller SKU:</span>
                  <span className="font-mono font-bold text-slate-800">{product.seller_sku}</span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Daraz SKU ID:</span>
                  <span className="font-mono text-slate-700">{product.daraz_sku_id || "N/A"}</span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Daraz Item ID:</span>
                  <span className="font-mono text-slate-700">{product.daraz_item_id || "N/A"}</span>
                </div>

                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Last Synced:</span>
                  <span className="text-slate-600">
                    {product.last_synced_at ? new Date(product.last_synced_at).toLocaleString() : "Recently"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
