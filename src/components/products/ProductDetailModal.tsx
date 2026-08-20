"use client";

import React, { useState } from "react";
import {
  X,
  Package,
  DollarSign,
  Tag,
  Store,
  CheckCircle2,
  Clock,
  Edit2,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Maximize2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Layers,
  Info,
  ShieldAlert
} from "lucide-react";
import { ProductImage } from "./ProductImage";
import { ImageGalleryModal } from "./ImageGalleryModal";

import { getStoreDisplayName } from "@/lib/daraz/store-utils";

interface ProductDetailModalProps {
  product: any | null;
  onClose: () => void;
  onProductUpdated?: (updated: any) => void;
}

export function ProductDetailModal({ product: initialProduct, onClose, onProductUpdated }: ProductDetailModalProps) {
  const [product, setProduct] = useState<any>(initialProduct);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "images" | "details">("overview");

  // Inline editing state
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState<string>(
    initialProduct ? (initialProduct.price_cents / 100).toString() : ""
  );
  const [specialPriceInput, setSpecialPriceInput] = useState<string>(
    initialProduct && initialProduct.special_price_cents ? (initialProduct.special_price_cents / 100).toString() : ""
  );

  const [isEditingStock, setIsEditingStock] = useState(false);
  const [stockInput, setStockInput] = useState<string>(
    initialProduct ? initialProduct.stock_quantity.toString() : ""
  );

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState<string>(initialProduct ? initialProduct.title : "");

  // Saving & Toast states
  const [savingState, setSavingState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [toastMessage, setToastMessage] = useState<string>("");

  // Add Image state
  const [newImageUrl, setNewImageUrl] = useState("");
  const [showAddImageInput, setShowAddImageInput] = useState(false);

  if (!product) return null;

  let images: string[] = [];
  if (Array.isArray(product.images)) {
    images = product.images.filter(Boolean);
  } else if (typeof product.images === "string" && product.images.trim()) {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed)) images = parsed.filter(Boolean);
      else if (typeof parsed === "string") images = [parsed];
    } catch {
      images = [product.images];
    }
  }
  if (images.length === 0 && product.primary_image_url) {
    if (typeof product.primary_image_url === "string" && (product.primary_image_url.startsWith("[") || product.primary_image_url.startsWith("{"))) {
      try {
        const parsed = JSON.parse(product.primary_image_url);
        if (Array.isArray(parsed)) images = parsed.filter(Boolean);
        else if (typeof parsed === "string") images = [parsed];
      } catch {
        images = [product.primary_image_url];
      }
    } else if (typeof product.primary_image_url === "string") {
      images = [product.primary_image_url];
    }
  }
  images = images.filter((img) => typeof img === "string" && img.trim() && img !== "null" && img !== "undefined" && img !== "none");

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

  // TWO-PHASE ACTION MODEL: Send to Daraz -> Verify Response -> Update Local Representation
  const handleSaveField = async (fieldsToUpdate: {
    priceCents?: number;
    specialPriceCents?: number;
    stockQuantity?: number;
    title?: string;
  }) => {
    setSavingState("saving");
    setToastMessage("Sending update request to Daraz Open Platform API...");

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldsToUpdate),
      });

      const data = await res.json();

      if (!data.success || !data.darazConfirmed) {
        throw new Error(data.error || "Daraz did not accept this change.");
      }

      setProduct(data.product);
      if (onProductUpdated) onProductUpdated(data.product);

      setSavingState("success");
      setToastMessage(data.message || "✓ Daraz Confirmed: Saved & Synced");
      setIsEditingPrice(false);
      setIsEditingStock(false);
      setIsEditingTitle(false);

      setTimeout(() => setSavingState("idle"), 3000);
    } catch (err: any) {
      setSavingState("error");
      setToastMessage(`Daraz rejected request: ${err.message}`);
      setTimeout(() => setSavingState("idle"), 5000);
    }
  };

  // Image Operations
  const handleImageAction = async (action: "add" | "replace" | "remove", index?: number, url?: string) => {
    setSavingState("saving");
    setToastMessage("Sending image update request to Daraz...");

    try {
      const res = await fetch(`/api/products/${product.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          index,
          imageUrl: url || newImageUrl,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to update images on Daraz.");

      setProduct(data.product);
      if (onProductUpdated) onProductUpdated(data.product);

      setNewImageUrl("");
      setShowAddImageInput(false);
      setSavingState("success");
      setToastMessage(data.message || "✓ Daraz Confirmed: Images updated");

      setTimeout(() => setSavingState("idle"), 3000);
    } catch (err: any) {
      setSavingState("error");
      setToastMessage(`Image update error: ${err.message}`);
      setTimeout(() => setSavingState("idle"), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto text-xs">
        
        {/* Toast Banner */}
        {savingState !== "idle" && (
          <div
            className={`sticky top-0 z-20 flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all shadow-md ${
              savingState === "saving"
                ? "bg-blue-50 text-blue-800 border border-blue-200"
                : savingState === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <div className="flex items-center space-x-2">
              {savingState === "saving" && <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />}
              {savingState === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {savingState === "error" && <AlertCircle className="h-4 w-4 text-red-600" />}
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                {getStoreDisplayName(product.daraz_stores)}
              </span>

              <span className="font-mono text-xs text-slate-500">
                Seller SKU: <strong className="text-slate-900">{product.seller_sku}</strong>
              </span>

              {product.daraz_item_id && (
                <span className="font-mono text-xs text-slate-500">
                  Item ID: {product.daraz_item_id}
                </span>
              )}
            </div>

            {isEditingTitle ? (
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="flex-1 rounded-xl border border-orange-500 px-3 py-1.5 text-sm font-bold text-slate-900 focus:outline-none"
                />
                <button
                  onClick={() => handleSaveField({ title: titleInput })}
                  className="rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700 apple-press"
                >
                  Save Title to Daraz
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 group">
                <h2 className="text-xl font-bold text-slate-900">{product.title}</h2>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  title="Edit product title"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-orange-500 transition-opacity"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "overview"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Overview & Pricing
          </button>

          <button
            onClick={() => setActiveTab("images")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "images"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Image Management ({images.length})
          </button>

          <button
            onClick={() => setActiveTab("details")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "details"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            More Details & Attributes
          </button>
        </div>

        {/* TAB 1: OVERVIEW & PRICING */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gallery Preview Box */}
            <div className="space-y-3">
              <div className="relative h-72 w-full rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden group">
                <ProductImage
                  src={images[activeImageIndex]}
                  alt={product.title}
                  className="h-full w-full object-contain cursor-pointer"
                  onClick={() => images.length > 0 && setShowLightbox(true)}
                />

                {images.length > 0 && (
                  <button
                    onClick={() => setShowLightbox(true)}
                    title="Fullscreen Preview"
                    className="absolute top-3 right-3 p-2 rounded-xl bg-slate-950/70 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                  {images.map((imgUrl: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`h-14 w-14 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${
                        activeImageIndex === idx
                          ? "border-orange-500 ring-2 ring-orange-200"
                          : "border-slate-200 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <ProductImage src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Pricing & Stock Editing Section */}
            <div className="space-y-4 text-xs">
              {/* Live Price Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                    <DollarSign className="h-4 w-4 text-orange-500" />
                    <span>Price Control</span>
                  </h3>

                  {!isEditingPrice && (
                    <button
                      onClick={() => setIsEditingPrice(true)}
                      className="text-xs font-bold text-orange-600 hover:underline"
                    >
                      Update Price
                    </button>
                  )}
                </div>

                {isEditingPrice ? (
                  <div className="space-y-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500">Regular Price (PKR):</label>
                      <input
                        type="number"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500">Sale Price (Optional PKR):</label>
                      <input
                        type="number"
                        value={specialPriceInput}
                        onChange={(e) => setSpecialPriceInput(e.target.value)}
                        placeholder="Leave blank for no sale price"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                      <button
                        onClick={() => {
                          const pCents = Math.round(parseFloat(priceInput || "0") * 100);
                          const spCents = specialPriceInput ? Math.round(parseFloat(specialPriceInput) * 100) : undefined;
                          handleSaveField({ priceCents: pCents, specialPriceCents: spCents });
                        }}
                        className="rounded-xl bg-orange-600 px-4 py-1.5 font-bold text-white hover:bg-orange-700 apple-press"
                      >
                        Save Price to Daraz
                      </button>
                      <button
                        onClick={() => setIsEditingPrice(false)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-slate-500">Regular Price:</span>
                      <p className="text-lg font-bold text-slate-900">{priceFormatted}</p>
                    </div>

                    <div>
                      <span className="text-slate-500">Sale Price:</span>
                      <p className="text-lg font-bold text-emerald-600">
                        {specialPriceFormatted || "None"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Stock Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                    <Package className="h-4 w-4 text-blue-500" />
                    <span>Inventory Stock Control</span>
                  </h3>

                  {!isEditingStock && (
                    <button
                      onClick={() => setIsEditingStock(true)}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Update Stock
                    </button>
                  )}
                </div>

                {isEditingStock ? (
                  <div className="space-y-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500">Quantity Available on Daraz:</label>
                      <input
                        type="number"
                        value={stockInput}
                        onChange={(e) => setStockInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                      <button
                        onClick={() => {
                          const sQty = parseInt(stockInput || "0", 10);
                          handleSaveField({ stockQuantity: sQty });
                        }}
                        className="rounded-xl bg-blue-600 px-4 py-1.5 font-bold text-white hover:bg-blue-700 apple-press"
                      >
                        Save Stock to Daraz
                      </button>
                      <button
                        onClick={() => setIsEditingStock(false)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-slate-500">Stock Count:</span>
                      <p className="text-lg font-bold text-slate-900">{product.stock_quantity} Units</p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-xl font-bold text-xs ${
                        product.stock_quantity > 10
                          ? "bg-emerald-100 text-emerald-800"
                          : product.stock_quantity > 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {product.stock_quantity > 0 ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                )}
              </div>

              {/* Sync Metadata Box */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Store Connection:</span>
                  <span className="font-bold text-emerald-600 flex items-center space-x-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>✓ Connected to Daraz</span>
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-500">
                  <span>Last Synced:</span>
                  <span className="font-semibold text-slate-800">
                    {product.last_synced_at ? new Date(product.last_synced_at).toLocaleString() : "Recently"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: IMAGE MANAGEMENT */}
        {activeTab === "images" && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Product Image Gallery</h3>
                <p className="text-slate-500">
                  View, add, replace, or remove images associated with this product on Daraz.
                </p>
              </div>

              <button
                onClick={() => setShowAddImageInput(!showAddImageInput)}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-700 transition-all apple-press"
              >
                <Plus className="h-4 w-4" />
                <span>+ Add Image URL</span>
              </button>
            </div>

            {showAddImageInput && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 space-y-3">
                <h4 className="font-bold text-orange-900">Add New Image URL</h4>
                <div className="flex items-center space-x-2">
                  <input
                    type="url"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://img.alicdn.com/... or https://..."
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none"
                  />
                  <button
                    onClick={() => handleImageAction("add")}
                    disabled={!newImageUrl.trim()}
                    className="rounded-xl bg-orange-600 px-4 py-2 font-bold text-white hover:bg-orange-700 disabled:opacity-50 apple-press"
                  >
                    Upload to Product
                  </button>
                </div>
              </div>
            )}

            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                {images.map((imgUrl: string, idx: number) => (
                  <div
                    key={idx}
                    className="relative rounded-2xl border border-slate-200 bg-slate-50 p-2 space-y-2 group"
                  >
                    <div className="h-40 w-full rounded-xl bg-white overflow-hidden flex items-center justify-center">
                      <ProductImage src={imgUrl} alt={`Product Image ${idx + 1}`} className="h-full w-full object-contain" />
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 px-1">
                      <span className="font-bold text-slate-600">Image {idx + 1}</span>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            const newUrl = prompt("Enter replacement image URL:", imgUrl);
                            if (newUrl && newUrl.trim()) {
                              handleImageAction("replace", idx, newUrl.trim());
                            }
                          }}
                          title="Replace this image"
                          className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Replace
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Remove Image ${idx + 1}?`)) {
                              handleImageAction("remove", idx);
                            }
                          }}
                          title="Remove this image"
                          className="p-1 rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-300 rounded-2xl space-y-2">
                <Package className="mx-auto h-8 w-8 text-slate-300" />
                <p>No product images registered yet.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MORE DETAILS & API EXPOSED STATUS */}
        {activeTab === "details" && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">Product Specifications</h3>

                <div className="space-y-2 pt-1">
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Category:</span>
                    <span className="font-bold text-slate-800">{product.category || "General"}</span>
                  </div>

                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Brand:</span>
                    <span className="font-bold text-slate-800">{product.brand || "Generic"}</span>
                  </div>

                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Daraz Item ID:</span>
                    <span className="font-mono font-bold text-slate-800">{product.daraz_item_id || "N/A"}</span>
                  </div>

                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Daraz SKU ID:</span>
                    <span className="font-mono text-slate-700">{product.daraz_sku_id || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Explicit Unsupported API Fields Notice */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <Info className="h-4 w-4 text-slate-500" />
                  <span>Unexposed API Fields Map</span>
                </h3>

                <div className="space-y-1.5 pt-1 text-[11px]">
                  {[
                    "Product Video",
                    "Package Weight & Dimensions",
                    "Warranty Terms",
                    "Page Views & Visitor Count",
                    "Conversion Rate Analytics",
                    "Wishlist Count",
                    "Product Rating & Review Text",
                  ].map((fieldName, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-slate-200 pb-1">
                      <span className="text-slate-600">{fieldName}:</span>
                      <span className="font-semibold text-slate-400 italic">Not supported by Daraz API</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Product Description */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">Product Description</h3>
              <div className="text-slate-600 leading-relaxed whitespace-pre-line pt-1">
                {product.description || "No description provided."}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all apple-press"
          >
            Close Details
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {showLightbox && (
        <ImageGalleryModal
          images={images}
          initialIndex={activeImageIndex}
          productTitle={product.title}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </div>
  );
}
