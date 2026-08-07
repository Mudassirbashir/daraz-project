"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
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
  Star,
  Phone,
  Mail,
  MapPin,
  Clock,
  Box,
  XCircle
} from "lucide-react";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    code: true,
    name: true,
    contactPerson: true,
    phone: true,
    email: true,
    rating: true,
    leadTime: true,
    moq: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    rating: 5.0,
    leadTimeDays: 7,
    minimumOrderQuantity: 100,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        min_rating: ratingFilter,
      });

      const res = await fetch(`/api/vendors?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setVendors(data.vendors || []);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error("[FetchVendors API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchVendors Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [page, limit, searchQuery, ratingFilter]);

  const handleOpenCreateModal = () => {
    setEditingVendor(null);
    setFormData({
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      rating: 5.0,
      leadTimeDays: 7,
      minimumOrderQuantity: 100,
      notes: "",
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (v: any) => {
    setEditingVendor(v);
    setFormData({
      name: v.name || "",
      contactPerson: v.contact_person || "",
      phone: v.phone || "",
      email: v.email || "",
      address: v.address || "",
      rating: v.rating || 5.0,
      leadTimeDays: v.lead_time_days || 7,
      minimumOrderQuantity: v.minimum_order_quantity || 100,
      notes: v.notes || "",
    });
    setShowModal(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingVendor ? `/api/vendors/${editingVendor.id}` : "/api/vendors";
      const method = editingVendor ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchVendors();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Save Exception: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vendor record?")) return;

    try {
      const res = await fetch(`/api/vendors/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) fetchVendors();
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  };

  const exportToCSV = () => {
    if (vendors.length === 0) {
      alert("No vendor records available to export.");
      return;
    }

    const headers = ["Vendor Code", "Vendor Name", "Contact Person", "Phone", "Email", "Rating", "Lead Time (Days)", "MOQ"];
    const rows = vendors.map((v) => [
      `"${v.code}"`,
      `"${(v.name || "").replace(/"/g, '""')}"`,
      `"${(v.contact_person || "").replace(/"/g, '""')}"`,
      `"${v.phone || "N/A"}"`,
      `"${v.email || "N/A"}"`,
      v.rating,
      v.lead_time_days,
      v.minimum_order_quantity,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_ERP_Vendors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendors & Suppliers Management</h1>
          <p className="text-xs text-slate-500">
            Manage raw material manufacturers, laser cutting suppliers, lead times, MOQ requirements, and vendor ratings.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Daraz API Status Notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-xs text-blue-800 flex items-center space-x-2">
        <Users className="h-4 w-4 text-blue-600 shrink-0" />
        <span>
          <strong>Vendor Management API Notice:</strong> Not exposed by Daraz Open Platform API. Manufacturer profiles are securely stored inside your private Supabase ERP database.
        </span>
      </div>

      {/* Controls Bar: Search & Column Selector */}
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
            placeholder="Search vendors by Name, Code, Contact Person, or Email..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Rating Filter */}
          <select
            value={ratingFilter}
            onChange={(e) => {
              setRatingFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="">All Ratings</option>
            <option value="4.5">★ 4.5+ Top Rated</option>
            <option value="4.0">★ 4.0+ Preferred</option>
            <option value="3.0">★ 3.0+ Regular</option>
          </select>

          {/* Column Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
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

      {/* Vendors Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading vendor suppliers...</span>
          </div>
        ) : vendors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  {columnVisibility.code && <th className="px-4 py-3">Vendor Code</th>}
                  {columnVisibility.name && <th className="px-4 py-3">Supplier Name</th>}
                  {columnVisibility.contactPerson && <th className="px-4 py-3">Contact Person</th>}
                  {columnVisibility.phone && <th className="px-4 py-3">Phone</th>}
                  {columnVisibility.email && <th className="px-4 py-3">Email</th>}
                  {columnVisibility.rating && <th className="px-4 py-3">Rating</th>}
                  {columnVisibility.leadTime && <th className="px-4 py-3">Lead Time</th>}
                  {columnVisibility.moq && <th className="px-4 py-3">MOQ</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    {columnVisibility.code && (
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{v.code}</td>
                    )}

                    {columnVisibility.name && (
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{v.name}</p>
                        {v.address && <p className="text-[10px] text-slate-400 truncate max-w-xs">{v.address}</p>}
                      </td>
                    )}

                    {columnVisibility.contactPerson && (
                      <td className="px-4 py-3 font-medium text-slate-700">{v.contact_person || "N/A"}</td>
                    )}

                    {columnVisibility.phone && (
                      <td className="px-4 py-3 font-mono text-slate-700">{v.phone || "N/A"}</td>
                    )}

                    {columnVisibility.email && (
                      <td className="px-4 py-3 font-mono text-slate-600">{v.email || "N/A"}</td>
                    )}

                    {columnVisibility.rating && (
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center space-x-1 rounded bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span>{v.rating ? v.rating.toFixed(1) : "5.0"}</span>
                        </span>
                      </td>
                    )}

                    {columnVisibility.leadTime && (
                      <td className="px-4 py-3 text-slate-700 font-semibold">{v.lead_time_days || 7} Days</td>
                    )}

                    {columnVisibility.moq && (
                      <td className="px-4 py-3 font-bold text-slate-900">{v.minimum_order_quantity || 100} Units</td>
                    )}

                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEditModal(v)}
                        className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="Edit Vendor"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteVendor(v.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete Vendor"
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
            <p className="font-medium text-slate-700">No vendor suppliers found in database.</p>
            <p>Click "Add Supplier" above to register manufacturer contacts and lead times.</p>
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
              Showing {vendors.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalItems)} of {totalItems} vendors
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

      {/* Vendor Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingVendor ? "Edit Vendor Supplier" : "Register New Vendor Supplier"}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier Company Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rating (1-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 5.0 })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value, 10) || 7 })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">MOQ Units</label>
                  <input
                    type="number"
                    value={formData.minimumOrderQuantity}
                    onChange={(e) => setFormData({ ...formData, minimumOrderQuantity: parseInt(e.target.value, 10) || 100 })}
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
                  {saving ? "Saving..." : editingVendor ? "Update Supplier" : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
