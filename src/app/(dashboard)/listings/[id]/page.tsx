"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ImageLightboxModal } from "@/components/products/ImageLightboxModal";
import {
  ArrowLeft,
  Package,
  Tag,
  Layers,
  TrendingUp,
  History,
  FileText,
  ShoppingCart,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Edit3,
  Save,
  Building2,
  Video,
  Scale,
  Ruler,
  ShieldCheck,
  Star,
  Users
} from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [product, setProduct] = useState<any | null>(null);
  const [relatedOrders, setRelatedOrders] = useState<any[]>([]);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<any[]>([]);
  const [apiStatus, setApiStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "skus" | "performance" | "orders" | "history" | "notes">("overview");

  // Image Lightbox state
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Internal ERP Notes state
  const [internalNotes, setInternalNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchProductDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${id}`);
      const data = await res.json();

      if (data.success) {
        setProduct(data.product);
        setRelatedOrders(data.relatedOrders || []);
        setVersionHistory(data.versionHistory || []);
        setActivityTimeline(data.activityTimeline || []);
        setApiStatus(data.apiExposedStatus || {});
      } else {
        console.error("[FetchProductDetail API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchProductDetail Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchProductDetail();
  }, [id]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("[SaveNotes Error]:", err);
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <Clock className="h-4 w-4 animate-spin text-orange-500" />
        <span>Loading Product Workspace...</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-12 text-center space-y-4">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Product Not Found</h2>
        <p className="text-xs text-slate-500">The requested product listing could not be retrieved from the catalog database.</p>
        <Link href="/listings" className="inline-flex items-center space-x-1 text-xs font-bold text-orange-600 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Product Catalog</span>
        </Link>
      </div>
    );
  }

  const priceFormatted = (product.price_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
  const specialPriceFormatted = product.special_price_cents
    ? (product.special_price_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" })
    : null;

  const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [];

  return (
    <div className="space-y-6">
      {/* Back Button & Top Action Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/listings"
            className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all apple-press shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-xl bg-orange-100 dark:bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-400 border border-orange-200/80 dark:border-orange-500/20">
                {product.daraz_stores?.store_name || "Daraz Store"}
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 font-bold">Item ID: {product.daraz_item_id || product.id}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">{product.title}</h1>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="inline-flex items-center space-x-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/20">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Live Synced</span>
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center space-x-1.5 px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            activeTab === "overview" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Overview & Media</span>
        </button>

        <button
          onClick={() => setActiveTab("skus")}
          className={`flex items-center space-x-1.5 px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            activeTab === "skus" ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>SKUs & Pricing</span>
        </button>

        <button
          onClick={() => setActiveTab("performance")}
          className={`flex items-center space-x-1.5 px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            activeTab === "performance" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Product Performance</span>
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`flex items-center space-x-1.5 px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            activeTab === "orders" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Related Orders ({relatedOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center space-x-1.5 px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            activeTab === "history" ? "bg-purple-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Version History & Audit Log</span>
        </button>

        <button
          onClick={() => setActiveTab("notes")}
          className={`flex items-center space-x-1.5 px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            activeTab === "notes" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Internal ERP Notes</span>
        </button>
      </div>

      {/* Tab 1: Overview & Media */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Gallery Preview Box */}
          <div className="space-y-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ImageIcon className="h-4 w-4 text-orange-500" />
              <span>Multi-Image Gallery Lightbox</span>
            </h3>

            <div
              onClick={() => {
                if (images.length > 0) setShowLightbox(true);
              }}
              className="h-72 w-full rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden relative cursor-pointer group"
            >
              {images.length > 0 ? (
                <>
                  <img src={images[lightboxIndex]} alt={product.title} className="h-full w-full object-contain" />
                  <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-xs opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs transition-opacity">
                    Click to Open Fullscreen Lightbox & Zoom
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-400 space-y-1">
                  <ImageIcon className="mx-auto h-12 w-12 text-slate-300" />
                  <p>No image available</p>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                {images.map((imgUrl: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxIndex(idx)}
                    className={`h-16 w-16 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${
                      lightboxIndex === idx ? "border-orange-500 ring-2 ring-orange-200" : "border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={imgUrl} alt="Thumbnail" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Specifications & Unexposed Fields */}
          <div className="space-y-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Tag className="h-4 w-4 text-blue-500" />
              <span>Product Specifications & Media Attributes</span>
            </h3>

            <div className="space-y-3 pt-1">
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Category:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{product.inventory?.category || "General"}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Brand:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{product.inventory?.brand || "Generic"}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Product Video:</span>
                <span className="font-mono text-slate-400 italic">{apiStatus.video}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Package Weight:</span>
                <span className="font-mono text-slate-400 italic">{apiStatus.packageWeight}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Package Dimensions:</span>
                <span className="font-mono text-slate-400 italic">{apiStatus.packageDimensions}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Warranty:</span>
                <span className="font-mono text-slate-400 italic">{apiStatus.warranty}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: SKUs & Pricing */}
      {activeTab === "skus" && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 shadow-apple space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Layers className="h-4 w-4 text-orange-500" />
            <span>SKU Variants, Inventory Levels & Prices</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Seller SKU</th>
                  <th className="p-3">Daraz SKU ID</th>
                  <th className="p-3">Regular Price</th>
                  <th className="p-3">Special Price</th>
                  <th className="p-3">Available Stock</th>
                  <th className="p-3">Reserved Stock</th>
                  <th className="p-3">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                <tr>
                  <td className="p-3 font-bold text-slate-900 dark:text-white">{product.seller_sku}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{product.daraz_sku_id || "N/A"}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-white">{priceFormatted}</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400 font-bold">{specialPriceFormatted || "N/A"}</td>
                  <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{product.stock_quantity} Units</td>
                  <td className="p-3 text-amber-700 dark:text-amber-400 font-semibold">{product.inventory?.quantity_reserved || 0} Units</td>
                  <td className="p-3">
                    <span className="inline-flex items-center space-x-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-400">
                      <CheckCircle2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      <span>Live Synced</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Product Performance */}
      {activeTab === "performance" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/90 dark:bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2 shadow-apple">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Daraz Open Platform API restricts seller store analytics endpoints. Unavailable fields are explicitly labeled below.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 text-center shadow-apple">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Page Views</span>
              <p className="mt-1 font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{apiStatus.views}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 text-center shadow-apple">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Unique Visitors</span>
              <p className="mt-1 font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{apiStatus.visitors}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 text-center shadow-apple">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Conversion Rate</span>
              <p className="mt-1 font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{apiStatus.conversionRate}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 text-center shadow-apple">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Wishlist Count</span>
              <p className="mt-1 font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{apiStatus.wishlistCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Related Orders */}
      {activeTab === "orders" && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 shadow-apple space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Orders Containing SKU '{product.seller_sku}' ({relatedOrders.length})</span>
          </h3>

          {relatedOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border border-slate-200 dark:border-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Order Number</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Amount (PKR)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Order Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {relatedOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">#{ord.daraz_order_id}</td>
                      <td className="p-3 font-sans font-medium text-slate-800 dark:text-slate-200">{ord.customer_name || "Customer"}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{(ord.total_amount_cents / 100).toFixed(2)}</td>
                      <td className="p-3 font-sans capitalize font-bold text-slate-700 dark:text-slate-300">{ord.status}</td>
                      <td className="p-3 text-slate-500 text-[11px]">{new Date(ord.order_date).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              No recent orders found matching this SKU in database.
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Version History & Audit Log */}
      {activeTab === "history" && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 shadow-apple space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <History className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Version History & Synchronization Audit Logs</span>
          </h3>

          <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
            {versionHistory.map((h, idx) => (
              <div key={idx} className="pt-3 flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{h.action}</p>
                  <p className="text-slate-500 text-[11px]">Source: {h.source}</p>
                </div>
                <span className="font-mono text-slate-500 text-[11px]">{new Date(h.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Internal ERP Notes */}
      {activeTab === "notes" && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 shadow-apple space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5">
              <FileText className="h-4 w-4 text-amber-500" />
              <span>Internal ERP Product Notes (Private — Not Synced to Daraz)</span>
            </h3>

            {saveSuccess && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Notes Saved Successfully</span>
              </span>
            )}
          </div>

          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={6}
            placeholder="Add internal vendor notes, supplier lead times, or product packaging instructions..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />

          <div className="flex justify-end">
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-all apple-press disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{savingNotes ? "Saving..." : "Save Internal Notes"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {showLightbox && (
        <ImageLightboxModal
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </div>
  );
}
