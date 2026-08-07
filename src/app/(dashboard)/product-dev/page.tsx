"use client";

import React, { useState, useEffect } from "react";
import {
  Lightbulb,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Download,
  Plus,
  Edit3,
  Trash2,
  Columns,
  ChevronLeft,
  ChevronRight,
  User,
  DollarSign,
  Tag,
  XCircle,
  CheckCircle2,
  Clock
} from "lucide-react";

export default function ProductDevPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    code: true,
    name: true,
    category: true,
    stage: true,
    targetCost: true,
    estimatedPrice: true,
    assignedTo: true,
    createdAt: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Home & Living / Decor",
    stage: "ideation",
    targetCostCents: 25000,
    estimatedSellingPriceCents: 75000,
    assignedTo: "Mudassir",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        stage: stageFilter,
      });

      const res = await fetch(`/api/product-dev?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setItems(data.productDevs || []);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error("[FetchProductDev API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchProductDev Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [page, limit, searchQuery, stageFilter]);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category: "Home & Living / Decor",
      stage: "ideation",
      targetCostCents: 25000,
      estimatedSellingPriceCents: 75000,
      assignedTo: "Mudassir",
      notes: "",
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name || "",
      category: item.category || "General",
      stage: item.stage || "ideation",
      targetCostCents: item.target_cost_cents || 25000,
      estimatedSellingPriceCents: item.estimated_selling_price_cents || 75000,
      assignedTo: item.assigned_to || "Mudassir",
      notes: item.notes || "",
    });
    setShowModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingItem ? `/api/product-dev/${editingItem.id}` : "/api/product-dev";
      const method = editingItem ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchItems();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Save Exception: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this R&D product item?")) return;

    try {
      const res = await fetch(`/api/product-dev/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) fetchItems();
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  };

  const exportToCSV = () => {
    if (items.length === 0) {
      alert("No product development records available to export.");
      return;
    }

    const headers = ["Dev Code", "Product Name", "Category", "Stage", "Target Cost (PKR)", "Est Price (PKR)", "Assigned To", "Created At"];
    const rows = items.map((i) => [
      `"${i.code}"`,
      `"${(i.name || "").replace(/"/g, '""')}"`,
      `"${i.category}"`,
      `"${i.stage}"`,
      (i.target_cost_cents / 100).toFixed(2),
      (i.estimated_selling_price_cents / 100).toFixed(2),
      `"${i.assigned_to}"`,
      `"${new Date(i.created_at).toLocaleString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_ERP_Product_RD_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Make New Product</h1>
          <p className="text-xs text-slate-500">
            Design, sample, cost, and test new product ideas before selling them online.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            title="Download product ideas as a CSV file"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Ideas List</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            title="Start a new product idea"
            className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Start New Product Idea</span>
          </button>
        </div>
      </div>

      {/* Daraz API Status Notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-xs text-amber-800 flex items-center space-x-2">
        <Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
        <span>
          <strong>Product R&D API Notice:</strong> Not exposed by Daraz Open Platform API. Pre-launch product development pipelines are managed inside your internal Supabase ERP workspace.
        </span>
      </div>

      {/* Controls Bar: Search & Filters */}
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
            placeholder="Search product ideas by name or code..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Stages</option>
            <option value="ideation">1. Idea</option>
            <option value="sourcing_samples">2. Getting Sample</option>
            <option value="sample_testing">3. Testing Sample</option>
            <option value="costing_approved">4. Price Approved</option>
            <option value="ready_for_listing">5. Ready to Sell</option>
            <option value="archived">Archived</option>
          </select>

          {/* Column Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              title="Choose which columns to show"
              className="flex items-center space-x-1.5 border border-slate-300 rounded-lg px-3 py-2 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Columns className="h-3.5 w-3.5 text-slate-500" />
              <span>Columns</span>
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-30 space-y-2 text-xs">
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">Toggle Columns</p>
                {Object.keys(columnVisibility).map((colKey) => (
                  <label key={colKey} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded-md">
                    <input
                      type="checkbox"
                      checked={(columnVisibility as any)[colKey]}
                      onChange={(e) =>
                        setColumnVisibility({
                          ...columnVisibility,
                          [colKey]: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="capitalize text-slate-700">{colKey.replace(/([A-Z])/g, " $1")}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* R&D Items Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading product ideas...</span>
          </div>
        ) : items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  {columnVisibility.code && <th className="px-4 py-3">Product Code</th>}
                  {columnVisibility.name && <th className="px-4 py-3">Product Title</th>}
                  {columnVisibility.category && <th className="px-4 py-3">Category</th>}
                  {columnVisibility.stage && <th className="px-4 py-3">Stage</th>}
                  {columnVisibility.targetCost && <th className="px-4 py-3">Target Cost</th>}
                  {columnVisibility.estimatedPrice && <th className="px-4 py-3">Est. Price</th>}
                  {columnVisibility.assignedTo && <th className="px-4 py-3">Assigned To</th>}
                  {columnVisibility.createdAt && <th className="px-4 py-3">Created Date</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {items.map((i) => {
                  const targetCost = (i.target_cost_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
                  const estPrice = (i.estimated_selling_price_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });

                  return (
                    <tr key={i.id} className="hover:bg-slate-50/50 transition-colors">
                      {columnVisibility.code && (
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{i.code}</td>
                      )}

                      {columnVisibility.name && (
                        <td className="px-4 py-3 font-bold text-slate-900">{i.name}</td>
                      )}

                      {columnVisibility.category && (
                        <td className="px-4 py-3 text-slate-700 font-medium">{i.category}</td>
                      )}

                      {columnVisibility.stage && (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] capitalize bg-slate-100 text-slate-800 border border-slate-200">
                            {i.stage.replace(/_/g, " ")}
                          </span>
                        </td>
                      )}

                      {columnVisibility.targetCost && (
                        <td className="px-4 py-3 font-bold text-slate-700">{targetCost}</td>
                      )}

                      {columnVisibility.estimatedPrice && (
                        <td className="px-4 py-3 font-bold text-emerald-700">{estPrice}</td>
                      )}

                      {columnVisibility.assignedTo && (
                        <td className="px-4 py-3 text-slate-700 font-semibold">{i.assigned_to || "Mudassir"}</td>
                      )}

                      {columnVisibility.createdAt && (
                        <td className="px-4 py-3 text-slate-500 text-[11px]">{new Date(i.created_at).toLocaleDateString()}</td>
                      )}

                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => handleOpenEditModal(i)}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="Edit Product Idea"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteItem(i.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete Product Idea"
                        >
                          <Trash2 className="h-4 w-4" />
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
            <p className="font-medium text-slate-700">No new product ideas yet.</p>
            <p>Start your first product idea.</p>
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
              Showing {items.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalItems)} of {totalItems} items
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

      {/* R&D Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingItem ? "Edit Product R&D Item" : "Create Product R&D Item"}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. 3D Laser Cut Wooden Desk Clock"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">R&D Stage</label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="ideation">Ideation</option>
                    <option value="sourcing_samples">Sourcing Samples</option>
                    <option value="sample_testing">Sample Testing</option>
                    <option value="costing_approved">Costing Approved</option>
                    <option value="ready_for_listing">Ready for Listing</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Member</label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="Mudassir">Mudassir (Product Manager)</option>
                    <option value="Mubashir">Mubashir (Super Admin)</option>
                    <option value="Zainab">Zainab (Ops Manager)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Cost (PKR)</label>
                  <input
                    type="number"
                    value={formData.targetCostCents / 100}
                    onChange={(e) => setFormData({ ...formData, targetCostCents: Math.round((parseFloat(e.target.value) || 0) * 100) })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Est. Selling Price (PKR)</label>
                  <input
                    type="number"
                    value={formData.estimatedSellingPriceCents / 100}
                    onChange={(e) => setFormData({ ...formData, estimatedSellingPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100) })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-orange-500 px-5 py-2 font-bold text-white hover:bg-orange-600 transition-all disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingItem ? "Update Item" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
