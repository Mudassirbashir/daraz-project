"use client";

import React, { useState, useEffect } from "react";
import { CostCalculatorModal } from "@/components/studio/CostCalculatorModal";
import {
  Lightbulb,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  XCircle,
  Copy,
  Trash2,
  Edit3,
  Sparkles,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Download
} from "lucide-react";

export default function StudioPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // New Draft Modal State
  const [showNewDraftModal, setShowNewDraftModal] = useState(false);
  const [newDraftName, setNewDraftName] = useState("");
  const [newDraftCategory, setNewDraftCategory] = useState("Home & Living / Decor");
  const [newDraftSku, setNewDraftSku] = useState("");
  const [creating, setCreating] = useState(false);

  // Selected Active Editing Draft Modal
  const [editingDraft, setEditingDraft] = useState<any | null>(null);

  // AI Content Generator state inside editing draft
  const [generatingAi, setGeneratingAi] = useState(false);

  // Cost Calculator Modal State
  const [showCostCalc, setShowCostCalc] = useState(false);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
      });

      const res = await fetch(`/api/studio?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setDrafts(data.drafts || []);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error("[FetchDrafts API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchDrafts Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, [page, limit, searchQuery]);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDraftName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDraftName,
          category: newDraftCategory,
          sellerSku: newDraftSku,
          language: "en",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowNewDraftModal(false);
        setNewDraftName("");
        setNewDraftSku("");
        fetchDrafts();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Exception: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm("Are you sure you want to delete this listing page?")) return;

    try {
      const res = await fetch(`/api/studio/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) fetchDrafts();
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  };

  const handleAiGenerate = async () => {
    if (!editingDraft) return;
    setGeneratingAi(true);

    try {
      const res = await fetch("/api/studio/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: editingDraft.name,
          category: editingDraft.category,
          language: "en",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEditingDraft({
          ...editingDraft,
          details: {
            ...editingDraft.details,
            ai_title: data.aiContent.aiTitle,
            seo_description: data.aiContent.seoDescription,
          },
        });
      } else {
        alert(`AI Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`AI Exception: ${err.message}`);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSaveDraftChanges = async () => {
    if (!editingDraft) return;

    try {
      const res = await fetch(`/api/studio/${editingDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingDraft.name,
          category: editingDraft.category,
          estimated_selling_price_cents: editingDraft.estimated_selling_price_cents,
          details: editingDraft.details,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Product page saved!");
        setEditingDraft(null);
        fetchDrafts();
      } else {
        alert(`Save Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Save Exception: ${err.message}`);
    }
  };

  const exportToCSV = () => {
    if (drafts.length === 0) {
      alert("No listing drafts to download.");
      return;
    }

    const headers = ["Product Name", "Product Code", "Category", "Selling Price"];
    const rows = drafts.map((d) => [
      `"${(d.name || "").replace(/"/g, '""')}"`,
      `"${d.details?.seller_sku || "N/A"}"`,
      `"${d.category || "General"}"`,
      ((d.estimated_selling_price_cents || 0) / 100).toFixed(2),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Product_Listings_Drafts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Make Product Listing</h1>
          <p className="text-xs text-slate-500">
            Create high-selling listing pages for your products using AI.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            title="Download draft listing pages as a CSV file"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Drafts</span>
          </button>

          <button
            onClick={() => setShowNewDraftModal(true)}
            title="Create a new product page draft"
            className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Make New Product Page</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search product pages by name or code..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Draft Listings List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading product listing pages...</span>
          </div>
        ) : drafts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Product Code</th>
                  <th className="px-4 py-3">Selling Price</th>
                  <th className="px-4 py-3">AI Quality Score</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {drafts.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">{d.name || "Untitled Product Page"}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{d.details?.seller_sku || "N/A"}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">
                      {((d.estimated_selling_price_cents || 0) / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200">
                        <Sparkles className="h-3 w-3 text-purple-600" />
                        <span>85% Optimized</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => setEditingDraft(d)}
                        title="Open editor to customize product page"
                        className="inline-flex items-center space-x-1 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 hover:bg-slate-50 font-bold"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                        <span>Open Editor</span>
                      </button>

                      <button
                        onClick={() => handleDeleteDraft(d.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete Product Page"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
            <p className="font-medium text-slate-700">No product pages made yet.</p>
            <p>Make your first product page with AI.</p>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 px-4 py-3 text-xs gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>

            <span className="text-slate-500 ml-2">
              Showing {drafts.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalItems)} of {totalItems} drafts
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center space-x-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <span className="font-bold text-slate-800 px-2">
              Page {page} of {totalPages || 1}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center space-x-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-all"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* New Draft Creation Modal */}
      {showNewDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Make New Product Page</h2>
              <button onClick={() => setShowNewDraftModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">What's the name of this product?</label>
                <input
                  type="text"
                  required
                  value={newDraftName}
                  onChange={(e) => setNewDraftName(e.target.value)}
                  placeholder="e.g. Wooden Ramadan Lantern Stand"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">What's your product code?</label>
                <input
                  type="text"
                  value={newDraftSku}
                  onChange={(e) => setNewDraftSku(e.target.value)}
                  placeholder="e.g. WM-LANTERN-01"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewDraftModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-orange-500 px-5 py-2 font-bold text-white hover:bg-orange-600 transition-all disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Make Product Page"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editing Studio Workspace Modal */}
      {editingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto border border-slate-200 text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{editingDraft.name}</h2>
                <p className="text-xs text-slate-500">Edit product page title and description</p>
              </div>

              <button onClick={() => setEditingDraft(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800">Product Title</label>
                  <button
                    onClick={handleAiGenerate}
                    disabled={generatingAi}
                    className="inline-flex items-center space-x-1 text-purple-700 font-bold hover:underline"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                    <span>{generatingAi ? "Creating with AI..." : "Create Title & Description with AI"}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={editingDraft.details?.ai_title || editingDraft.name || ""}
                  onChange={(e) =>
                    setEditingDraft({
                      ...editingDraft,
                      details: { ...editingDraft.details, ai_title: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Product Description</label>
                <textarea
                  value={editingDraft.details?.seo_description || ""}
                  onChange={(e) =>
                    setEditingDraft({
                      ...editingDraft,
                      details: { ...editingDraft.details, seo_description: e.target.value },
                    })
                  }
                  rows={6}
                  placeholder="Describe your product clearly..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingDraft(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDraftChanges}
                className="rounded-lg bg-orange-500 px-5 py-2 font-bold text-white hover:bg-orange-600 transition-all"
              >
                Save Product Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cost Calculator Modal */}
      {showCostCalc && editingDraft && (
        <CostCalculatorModal
          initialCost={editingDraft?.details?.cost_breakdown}
          onClose={() => setShowCostCalc(false)}
          onSave={(cost, sellingPriceCents) => {
            setEditingDraft({
              ...editingDraft,
              estimated_selling_price_cents: sellingPriceCents,
              details: { ...editingDraft.details, cost_breakdown: cost },
            });
            setShowCostCalc(false);
          }}
        />
      )}
    </div>
  );
}
