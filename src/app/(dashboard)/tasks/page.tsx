"use client";

import React, { useState, useEffect } from "react";
import { TaskModal } from "@/components/tasks/TaskModal";
import {
  Search,
  RefreshCw,
  AlertCircle,
  Download,
  Columns,
  Plus,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    title: true,
    assignedTo: true,
    priority: true,
    status: true,
    dueDate: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Task Modal State
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        priority: priorityFilter,
      });

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setTasks(data.tasks || []);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error("[FetchTasks API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchTasks Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [page, limit, searchQuery, priorityFilter]);

  const exportToCSV = () => {
    if (tasks.length === 0) {
      alert("No tasks available to export.");
      return;
    }

    const headers = ["Task Title", "Assigned To", "Priority", "Status", "Due Date"];
    const rows = tasks.map((t) => [
      `"${(t.title || "").replace(/"/g, '""')}"`,
      `"${t.assigned_to || "Mudassir"}"`,
      t.priority || "Medium",
      t.status || "Pending",
      `"${t.due_date ? new Date(t.due_date).toLocaleDateString() : ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_Tasks_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenCreateModal = () => {
    setSelectedTask(null);
    setShowTaskModal(true);
  };

  const handleOpenEditModal = (task: any) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) fetchTasks();
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-xs text-slate-500">
            Things you need to do for your store and orders.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            title="Download task list as a CSV file"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Task List</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            title="Create a new task"
            className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Task</span>
          </button>
        </div>
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
            placeholder="Search tasks by task title or assigned person..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>

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

      {/* Tasks Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading tasks...</span>
          </div>
        ) : tasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  {columnVisibility.title && <th className="px-4 py-3">Task Title</th>}
                  {columnVisibility.assignedTo && <th className="px-4 py-3">Assigned To</th>}
                  {columnVisibility.priority && <th className="px-4 py-3">Priority</th>}
                  {columnVisibility.status && <th className="px-4 py-3">Status</th>}
                  {columnVisibility.dueDate && <th className="px-4 py-3">Due Date</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    {columnVisibility.title && (
                      <td className="px-4 py-3 font-bold text-slate-900">{t.title}</td>
                    )}

                    {columnVisibility.assignedTo && (
                      <td className="px-4 py-3 font-semibold text-slate-700">{t.assigned_to || "Mudassir"}</td>
                    )}

                    {columnVisibility.priority && (
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[10px] capitalize ${
                            t.priority === "high"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : t.priority === "medium"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {t.priority || "Medium"}
                        </span>
                      </td>
                    )}

                    {columnVisibility.status && (
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[10px] capitalize ${
                            t.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : t.status === "in_progress"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {t.status ? t.status.replace(/_/g, " ") : "Pending"}
                        </span>
                      </td>
                    )}

                    {columnVisibility.dueDate && (
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString() : "No due date"}
                      </td>
                    )}

                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="Edit Task"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete Task"
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
            <p className="font-medium text-slate-700">No tasks yet. You're all caught up!</p>
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
              Showing {tasks.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalItems)} of {totalItems} tasks
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

      {/* Task Creation & Edit Modal */}
      {showTaskModal && (
        <TaskModal
          task={selectedTask}
          onClose={() => setShowTaskModal(false)}
          onSave={() => {
            setShowTaskModal(false);
            fetchTasks();
          }}
        />
      )}
    </div>
  );
}
