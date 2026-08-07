"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Store,
  FileText,
  Clock,
  ShieldCheck,
  RotateCcw
} from "lucide-react";

interface PrintableLabelModalProps {
  order: any | null;
  onClose: () => void;
  onLabelPrinted?: (updatedOrder: any) => void;
}

export function PrintableLabelModal({ order, onClose, onLabelPrinted }: PrintableLabelModalProps) {
  const [docType, setDocType] = useState<"shipping_label" | "invoice" | "carrierManifest">("shipping_label");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [storeNotConnected, setStoreNotConnected] = useState(false);
  const [fileContent, setFileContent] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("text/html");
  const [printTracking, setPrintTracking] = useState<{
    isLabelPrinted: boolean;
    labelPrintedAt: string | null;
    labelPrintedBy: string | null;
    reprintCount: number;
  }>({
    isLabelPrinted: order?.is_label_printed || false,
    labelPrintedAt: order?.label_printed_at || null,
    labelPrintedBy: order?.label_printed_by || null,
    reprintCount: order?.reprint_count || 0,
  });

  const [printState, setPrintState] = useState<"idle" | "sending" | "printed" | "error">("idle");

  const fetchOfficialLabel = async () => {
    if (!order) return;
    setLoading(true);
    setErrorMessage("");
    setStoreNotConnected(false);

    try {
      const res = await fetch(`/api/orders/${order.id}/label?doc_type=${docType}`);
      const data = await res.json();

      if (!data.success) {
        if (data.storeNotConnected) setStoreNotConnected(true);
        throw new Error(data.error || "Failed to load official Daraz shipping label.");
      }

      setFileContent(data.file || "");
      setMimeType(data.mimeType || "text/html");
      if (data.printTracking) setPrintTracking(data.printTracking);
    } catch (err: any) {
      console.error("[FetchOfficialLabel Error]:", err.message);
      setErrorMessage(err.message || "Shipping label could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (order?.id) {
      fetchOfficialLabel();
    }
  }, [order?.id, docType]);

  if (!order) return null;

  // Handle Trigger Print Action
  const handlePrint = async () => {
    setPrintState("sending");

    try {
      // 1. Record print tracking event on backend
      const res = await fetch(`/api/orders/${order.id}/label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (data.success && data.order) {
        setPrintTracking({
          isLabelPrinted: data.order.is_label_printed,
          labelPrintedAt: data.order.label_printed_at,
          labelPrintedBy: data.order.label_printed_by,
          reprintCount: data.order.reprint_count,
        });
        if (onLabelPrinted) onLabelPrinted(data.order);
      }

      setPrintState("printed");

      // 2. Trigger browser print of the official document container
      setTimeout(() => {
        const iframe = document.getElementById("daraz-official-label-iframe") as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } else {
          window.print();
        }
      }, 300);
    } catch (err: any) {
      setPrintState("error");
      setErrorMessage(`Print error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 max-h-[94vh] overflow-y-auto text-xs print:border-none print:shadow-none print:max-h-none print:p-0 print:w-full">
        
        {/* Top Control Header — Hidden during print */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 print:hidden">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="rounded-xl bg-orange-100 dark:bg-orange-500/20 px-2.5 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-300">
                {order.daraz_stores?.store_name || "Daraz Store"}
              </span>

              <span className="font-mono text-xs text-slate-500 font-bold">Order #{order.daraz_order_id}</span>
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Printer className="h-5 w-5 text-orange-500" />
              <span>Official Daraz Shipping Label Station</span>
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Print & Document Status Bar — Hidden during print */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 print:hidden">
          <div className="flex items-center space-x-2">
            {/* Document Type Selector */}
            <button
              onClick={() => setDocType("shipping_label")}
              className={`px-3 py-1.5 font-bold rounded-xl transition-all ${
                docType === "shipping_label"
                  ? "bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Shipping Label
            </button>

            <button
              onClick={() => setDocType("invoice")}
              className={`px-3 py-1.5 font-bold rounded-xl transition-all ${
                docType === "invoice"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Customer Invoice
            </button>

            <button
              onClick={() => setDocType("carrierManifest")}
              className={`px-3 py-1.5 font-bold rounded-xl transition-all ${
                docType === "carrierManifest"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Manifest
            </button>
          </div>

          {/* Print Tracking Badge & Print Button */}
          <div className="flex items-center space-x-3">
            {printTracking.isLabelPrinted ? (
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>✓ Printed ({printTracking.reprintCount}x)</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-500/20">
                <Clock className="h-3.5 w-3.5" />
                <span>Ready to Print</span>
              </span>
            )}

            <button
              onClick={handlePrint}
              disabled={loading || !!errorMessage}
              className="inline-flex items-center space-x-2 rounded-xl bg-orange-600 px-5 py-2.5 font-bold text-white hover:bg-orange-700 shadow-md transition-all apple-press disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              <span>{printTracking.isLabelPrinted ? "Print Again" : "Print Official Label"}</span>
            </button>
          </div>
        </div>

        {/* Store Not Connected Error View */}
        {storeNotConnected && (
          <div className="p-6 rounded-2xl bg-amber-50 text-amber-900 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 space-y-3 text-center print:hidden">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-600" />
            <h3 className="font-bold text-base">Daraz Store Connection Required</h3>
            <p className="max-w-md mx-auto">
              Your Daraz seller store is not connected or access token has expired. Connect your store to pull official Daraz shipping labels.
            </p>
            <a
              href="/api/auth/daraz/login"
              className="inline-flex items-center space-x-2 rounded-xl bg-orange-500 px-5 py-2.5 font-bold text-white hover:bg-orange-600 shadow-md transition-all apple-press"
            >
              <Store className="h-4 w-4" />
              <span>Connect Daraz Store</span>
            </a>
          </div>
        )}

        {/* API Error View */}
        {errorMessage && !storeNotConnected && (
          <div className="p-6 rounded-2xl bg-red-50 text-red-900 border border-red-200 dark:bg-red-900/30 dark:text-red-300 space-y-3 text-center print:hidden">
            <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
            <h3 className="font-bold text-base">Shipping Label Unavailable</h3>
            <p className="max-w-md mx-auto">{errorMessage}</p>
            <button
              onClick={fetchOfficialLabel}
              className="inline-flex items-center space-x-2 rounded-xl bg-slate-900 text-white px-4 py-2 font-bold hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* Official Document Display Container */}
        {loading ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3 print:hidden">
            <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
            <p className="font-bold text-slate-700 dark:text-slate-300">Fetching Official Daraz Shipping Document...</p>
            <p className="text-[11px] text-slate-400">Communicating with official Daraz REST API endpoint /order/document/get</p>
          </div>
        ) : fileContent ? (
          <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white overflow-hidden min-h-[500px] flex flex-col print:border-none print:min-h-0 print:overflow-visible">
            {/* If HTML shipping label or PDF base64 */}
            {mimeType.includes("html") || fileContent.trim().startsWith("<") ? (
              <iframe
                id="daraz-official-label-iframe"
                srcDoc={fileContent}
                title="Official Daraz Shipping Label"
                className="w-full min-h-[600px] border-none print:h-screen print:w-screen print:fixed print:inset-0 print:z-50"
              />
            ) : mimeType.includes("pdf") || fileContent.startsWith("JVBER") ? (
              <iframe
                id="daraz-official-label-iframe"
                src={`data:application/pdf;base64,${fileContent}`}
                title="Official Daraz Shipping Label PDF"
                className="w-full min-h-[600px] border-none print:h-screen print:w-screen print:fixed print:inset-0 print:z-50"
              />
            ) : (
              <iframe
                id="daraz-official-label-iframe"
                srcDoc={fileContent}
                title="Official Daraz Shipping Label Document"
                className="w-full min-h-[600px] border-none print:h-screen print:w-screen print:fixed print:inset-0 print:z-50"
              />
            )}
          </div>
        ) : null}

        {/* Footer Audit Information — Hidden during print */}
        {printTracking.isLabelPrinted && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 print:hidden">
            <span>
              Printed by: <strong className="text-slate-800 dark:text-slate-200">{printTracking.labelPrintedBy || "Shipping Staff"}</strong>
            </span>

            <span>
              First printed: {printTracking.labelPrintedAt ? new Date(printTracking.labelPrintedAt).toLocaleString() : "Recently"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
