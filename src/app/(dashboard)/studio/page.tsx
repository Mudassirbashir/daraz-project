"use client";

import React, { useState, useEffect } from "react";
import { CostCalculatorModal } from "@/components/studio/CostCalculatorModal";
import {
  Lightbulb,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Trash2,
  Edit3,
  Sparkles,
  Image as ImageIcon,
  DollarSign,
  FileText,
  CheckSquare,
  Globe,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Send,
  Layers,
  ArrowRight
} from "lucide-react";

export default function StudioPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [publishingFilter, setPublishingFilter] = useState("all");

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
  const [newDraftLang, setNewDraftLang] = useState<"en" | "ur">("en");
  const [creating, setCreating] = useState(false);

  // Selected Active Editing Draft Modal
  const [editingDraft, setEditingDraft] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "images" | "cost" | "checklist" | "files">("content");

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
        publishing_status: publishingFilter,
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
  }, [page, limit, searchQuery, publishingFilter]);

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
          language: newDraftLang,
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
    if (!confirm("Are you sure you want to delete this listing draft?")) return;

    try {
      const res = await fetch(`/api/studio/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) fetchDrafts();
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  };

  const handleDuplicateDraft = async (draft: any) => {
    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${draft.name} (Copy)`,
          category: draft.category,
          sellerSku: `${draft.details?.seller_sku || "SKU"}-COPY`,
          language: draft.details?.language || "en",
        }),
      });

      const data = await res.json();
      if (data.success) fetchDrafts();
    } catch (err: any) {
      alert(`Duplicate Error: ${err.message}`);
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
          language: editingDraft.details?.language || "en",
        }),
      });

      const data = await res.json();
      if (data.success) {
        const updatedDetails = {
          ...editingDraft.details,
          ai_title: data.aiContent.aiTitle,
          seo_description: data.aiContent.seoDescription,
          highlights: data.aiContent.highlights,
          search_keywords: data.aiContent.searchKeywords,
          meta_keywords: data.aiContent.metaKeywords,
          package_content: data.aiContent.packageContent,
          specifications: data.aiContent.specifications,
        };

        setEditingDraft({
          ...editingDraft,
          details: updatedDetails,
        });
      } else {
        alert(`AI Generation Error: ${data.error}`);
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
        alert("Listing draft saved successfully.");
        setEditingDraft(null);
        fetchDrafts();
      } else {
        alert(`Save Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Save Exception: ${err.message}`);
    }
  };

  const calculateChecklistPct = (checklist: any) => {
    if (!checklist) return 0;
    const keys = Object.keys(checklist);
    if (keys.length === 0) return 0;
    const completed = keys.filter((k) => checklist[k] === true).length;
    return Math.round((completed / keys.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header & New Draft Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Listing Studio Workspace</h1>
          <p className="text-xs text-slate-500">
            Prepare, optimize SEO titles in Urdu & English, calculate profit margins, and queue product listings for Daraz publishing.
          </p>
        </div>

        <button
          onClick={() => setShowNewDraftModal(true)}
          className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-600 transition-all shadow-md shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Listing Draft</span>
        </button>
      </div>

      {/* Publishing Queue Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => {
            setPublishingFilter("all");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-lg transition-all ${
            publishingFilter === "all" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Queue ({totalItems})
        </button>

        <button
          onClick={() => {
            setPublishingFilter("draft");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-lg transition-all ${
            publishingFilter === "draft" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Drafting In Progress
        </button>

        <button
          onClick={() => {
            setPublishingFilter("ready");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-lg transition-all ${
            publishingFilter === "ready" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Ready for Daraz Publish
        </button>
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
            placeholder="Search drafts by Product Name, Code, or Category..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Studio Drafts Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Fetching listing studio drafts...</span>
          </div>
        ) : drafts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Draft Code & Title</th>
                  <th className="px-4 py-3">Seller SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Selling Price</th>
                  <th className="px-4 py-3">Checklist %</th>
                  <th className="px-4 py-3">Queue Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts.map((d) => {
                  const details = d.details || {};
                  const checklistPct = calculateChecklistPct(details.checklist);
                  const priceFormatted = (d.estimated_selling_price_cents / 100).toLocaleString("en-PK", {
                    style: "currency",
                    currency: "PKR",
                  });

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900 line-clamp-1">{d.name}</p>
                        <span className="font-mono text-[10px] text-slate-400">{d.code}</span>
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {details.seller_sku || "SKU-PENDING"}
                      </td>

                      <td className="px-4 py-3 text-slate-700 font-medium">{d.category}</td>

                      <td className="px-4 py-3 font-bold text-slate-900">{priceFormatted}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                            <div
                              className={`h-full ${checklistPct === 100 ? "bg-emerald-500" : "bg-orange-500"}`}
                              style={{ width: `${checklistPct}%` }}
                            />
                          </div>
                          <span className="font-bold text-[11px] text-slate-700">{checklistPct}%</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] capitalize ${
                            details.publishing_status === "ready"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {details.publishing_status || "draft"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => setEditingDraft(d)}
                          className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                          <span>Studio Workspace</span>
                        </button>

                        <button
                          onClick={() => handleDuplicateDraft(d)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="Duplicate Draft"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteDraft(d.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete Draft"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
            <p className="font-medium text-slate-700">No listing drafts found in studio workspace.</p>
            <p>Click "Create New Listing Draft" above to start preparing products for Daraz publishing.</p>
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
              <option value={100}>100</option>
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
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Create New Product Listing Draft</h2>
              <button onClick={() => setShowNewDraftModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={newDraftName}
                  onChange={(e) => setNewDraftName(e.target.value)}
                  placeholder="e.g. Handmade 3D Wooden Ramadan Lantern Stand"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Seller SKU</label>
                <input
                  type="text"
                  value={newDraftSku}
                  onChange={(e) => setNewDraftSku(e.target.value)}
                  placeholder="e.g. WM-LANTERN-ST-01"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Daraz Category</label>
                <input
                  type="text"
                  value={newDraftCategory}
                  onChange={(e) => setNewDraftCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default AI Language</label>
                <div className="flex space-x-4 pt-1">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="lang"
                      checked={newDraftLang === "en"}
                      onChange={() => setNewDraftLang("en")}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="font-semibold text-slate-800">English</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="lang"
                      checked={newDraftLang === "ur"}
                      onChange={() => setNewDraftLang("ur")}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="font-semibold text-slate-800">Urdu (اردو)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewDraftModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-orange-500 px-5 py-2 font-bold text-white hover:bg-orange-600 transition-all disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editing Studio Draft Workspace Modal */}
      {editingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="rounded-md bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                    AI Studio Listing Workspace
                  </span>
                  <span className="font-mono text-xs text-slate-500 font-bold">Code: {editingDraft.code}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{editingDraft.name}</h2>
              </div>

              <button onClick={() => setEditingDraft(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs">
              <div className="flex space-x-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("content")}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 font-bold rounded-lg transition-all ${
                    activeTab === "content" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Sparkles className="h-4 w-4 text-orange-400" />
                  <span>AI Content</span>
                </button>

                <button
                  onClick={() => setActiveTab("cost")}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 font-bold rounded-lg transition-all ${
                    activeTab === "cost" ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <DollarSign className="h-4 w-4" />
                  <span>Cost Calculator & Pricing</span>
                </button>

                <button
                  onClick={() => setActiveTab("images")}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 font-bold rounded-lg transition-all ${
                    activeTab === "images" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <ImageIcon className="h-4 w-4" />
                  <span>AI Images Workspace</span>
                </button>

                <button
                  onClick={() => setActiveTab("checklist")}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 font-bold rounded-lg transition-all ${
                    activeTab === "checklist" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <CheckSquare className="h-4 w-4" />
                  <span>Publish Checklist ({calculateChecklistPct(editingDraft.details?.checklist)}%)</span>
                </button>

                <button
                  onClick={() => setActiveTab("files")}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 font-bold rounded-lg transition-all ${
                    activeTab === "files" ? "bg-purple-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Attachments</span>
                </button>
              </div>

              <button
                onClick={handleAiGenerate}
                disabled={generatingAi}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition-all disabled:opacity-50 shadow-sm shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                <span>{generatingAi ? "Generating AI..." : "Generate AI Content"}</span>
              </button>
            </div>

            {/* Tab 1: AI Content Generator */}
            {activeTab === "content" && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SEO Optimized Title</label>
                  <input
                    type="text"
                    value={editingDraft.details?.ai_title || ""}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        details: { ...editingDraft.details, ai_title: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SEO Product Description</label>
                  <textarea
                    value={editingDraft.details?.seo_description || ""}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        details: { ...editingDraft.details, seo_description: e.target.value },
                      })
                    }
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Search Keywords & Tags</label>
                  <input
                    type="text"
                    value={editingDraft.details?.search_keywords || ""}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        details: { ...editingDraft.details, search_keywords: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Cost Calculator & Pricing */}
            {activeTab === "cost" && (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">Suggested Selling Price (PKR):</span>
                    <span className="text-xl font-bold text-orange-600">
                      PKR {(editingDraft.estimated_selling_price_cents / 100).toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => setShowCostCalc(true)}
                    className="w-full rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-all"
                  >
                    Open Product Cost & Selling Price Calculator Engine
                  </button>
                </div>
              </div>
            )}

            {/* Tab 4: Publishing Checklist */}
            {activeTab === "checklist" && (
              <div className="space-y-3 text-xs">
                <h3 className="font-bold text-slate-900 text-sm">Product Checklist Before Daraz Publishing</h3>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {Object.keys(editingDraft.details?.checklist || {}).map((chkKey) => (
                    <label key={chkKey} className="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={editingDraft.details?.checklist?.[chkKey] || false}
                        onChange={(e) => {
                          const updatedChk = { ...editingDraft.details.checklist, [chkKey]: e.target.checked };
                          setEditingDraft({
                            ...editingDraft,
                            details: { ...editingDraft.details, checklist: updatedChk },
                          });
                        }}
                        className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="capitalize font-semibold text-slate-800">{chkKey}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-700 text-xs">Queue Status:</span>
                <select
                  value={editingDraft.details?.publishing_status || "draft"}
                  onChange={(e) =>
                    setEditingDraft({
                      ...editingDraft,
                      details: { ...editingDraft.details, publishing_status: e.target.value },
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-bold text-slate-800 text-xs focus:outline-none"
                >
                  <option value="draft">Drafting In Progress</option>
                  <option value="ready">Ready for Daraz Publish</option>
                  <option value="published">Published Live</option>
                </select>
              </div>

              <div className="flex space-x-2">
                <button onClick={() => setEditingDraft(null)} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleSaveDraftChanges}
                  className="rounded-xl bg-orange-500 px-5 py-2 font-bold text-white hover:bg-orange-600 transition-all text-xs shadow-sm"
                >
                  Save Draft Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cost Calculator Modal */}
      {showCostCalc && editingDraft && (
        <CostCalculatorModal
          initialCost={editingDraft.details?.cost_breakdown}
          onClose={() => setShowCostCalc(false)}
          onSave={(updatedCost, sellingPriceCents) => {
            setEditingDraft({
              ...editingDraft,
              estimated_selling_price_cents: sellingPriceCents,
              details: {
                ...editingDraft.details,
                cost_breakdown: updatedCost,
              },
            });
          }}
        />
      )}
    </div>
  );
}
