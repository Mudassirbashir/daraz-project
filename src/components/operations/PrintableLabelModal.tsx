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
  Download
} from "lucide-react";
import { getStoreDisplayName } from "@/lib/daraz/store-utils";

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
  const [isOfficial, setIsOfficial] = useState<boolean>(true);
  const [sourceMessage, setSourceMessage] = useState<string>("");
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
        throw new Error(data.error || "Failed to load shipping label.");
      }

      setFileContent(data.file || "");
      setMimeType(data.mimeType || "text/html");
      setIsOfficial(data.isOfficial !== false);
      setSourceMessage(data.sourceMessage || (data.isOfficial ? "Official Daraz document retrieved" : "Application shipping label generated from synchronized order data"));
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
                {getStoreDisplayName(order.daraz_stores)}
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

          {/* Document Source Badge & Print Button */}
          <div className="flex items-center space-x-3">
            {isOfficial ? (
              <span title={sourceMessage} className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-500/20 text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                <span>Official Daraz Document</span>
              </span>
            ) : (
              <span title={sourceMessage} className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-500/20 text-[11px]">
                <FileText className="h-3.5 w-3.5 text-amber-600" />
                <span>Application Generated Label</span>
              </span>
            )}

            {printTracking.isLabelPrinted && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 text-[10px]">
                <CheckCircle2 className="h-3 w-3" />
                <span>Printed ({printTracking.reprintCount}x)</span>
              </span>
            )}

            <a
              href={`/api/orders/${order.id}/label?doc_type=${docType}&format=pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all apple-press"
            >
              <Download className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Download PDF</span>
            </a>

            <button
              onClick={handlePrint}
              disabled={loading || !!errorMessage}
              className="inline-flex items-center space-x-2 rounded-xl bg-orange-600 px-4 py-2 font-bold text-white hover:bg-orange-700 shadow-md transition-all apple-press disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              <span>{printTracking.isLabelPrinted ? "Print Again" : "Print Label"}</span>
            </button>
          </div>
        </div>

        {/* Store Not Connected Warning */}
        {storeNotConnected && (
          <div className="p-4 rounded-2xl bg-amber-50 text-amber-900 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 space-y-2 text-center print:hidden">
            <AlertCircle className="mx-auto h-8 w-8 text-amber-600" />
            <h3 className="font-bold text-sm">Daraz Store Not Connected</h3>
            <p className="max-w-md mx-auto text-[11px]">
              Showing application-generated fulfillment label sourced from real order data in your database. Reconnect store to pull official Daraz document API stream.
            </p>
          </div>
        )}

        {/* Error & State Machine Action View */}
        {errorMessage && !storeNotConnected && (
          <div className="p-5 rounded-2xl bg-red-50 text-red-900 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50 space-y-3 print:hidden">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-left flex-1">
                <h3 className="font-bold text-sm text-red-950 dark:text-red-200">Daraz Fulfillment Requirement Notice</h3>
                <p className="font-mono text-xs text-red-800 dark:text-red-300 leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            </div>

            {/* State Machine Transition Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-red-200/60 dark:border-red-800/40">
              {(order.workflow_status === "pending" || order.status === "pending" || !order.is_packed) && (
                <button
                  onClick={async () => {
                    setLoading(true);
                    setErrorMessage("");
                    try {
                      const res = await fetch(`/api/orders/${order.id}/pack`, { method: "POST" });
                      const packData = await res.json();
                      if (packData.success) {
                        fetchOfficialLabel();
                      } else {
                        setErrorMessage(packData.error || "Packing failed on Daraz.");
                        setLoading(false);
                      }
                    } catch (e: any) {
                      setErrorMessage(e.message);
                      setLoading(false);
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-600 text-white px-4 py-2 font-bold text-xs hover:bg-orange-700 shadow-sm transition-all apple-press"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Pack Order on Daraz</span>
                </button>
              )}

              {(order.workflow_status === "packed" || order.status === "packed" || order.is_packed) && (
                <button
                  onClick={async () => {
                    setLoading(true);
                    setErrorMessage("");
                    try {
                      const res = await fetch(`/api/orders/${order.id}/status`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "ready_to_ship" }),
                      });
                      const rtsData = await res.json();
                      if (rtsData.success) {
                        fetchOfficialLabel();
                      } else {
                        setErrorMessage(rtsData.error || "Ready to ship update failed.");
                        setLoading(false);
                      }
                    } catch (e: any) {
                      setErrorMessage(e.message);
                      setLoading(false);
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-blue-600 text-white px-4 py-2 font-bold text-xs hover:bg-blue-700 shadow-sm transition-all apple-press"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Set Ready to Ship on Daraz</span>
                </button>
              )}

              <button
                onClick={fetchOfficialLabel}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-bold hover:bg-slate-800 transition-all apple-press"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Request</span>
              </button>
            </div>
          </div>
        )}

        {/* Document Display Container */}
        {loading ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3 print:hidden">
            <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
            <p className="font-bold text-slate-700 dark:text-slate-300">Loading Shipping Document...</p>
            <p className="text-[11px] text-slate-400">Retrieving official document stream or application label from verified database record...</p>
          </div>
        ) : fileContent ? (
          <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white overflow-hidden min-h-[500px] flex flex-col print:border-none print:min-h-0 print:overflow-visible">
            {mimeType.includes("pdf") || fileContent.startsWith("JVBER") || fileContent.startsWith("%PDF") ? (
              <iframe
                id="daraz-official-label-iframe"
                src={
                  fileContent.startsWith("JVBER")
                    ? `data:application/pdf;base64,${fileContent}`
                    : fileContent.startsWith("%PDF")
                    ? `data:application/pdf;base64,${btoa(fileContent)}`
                    : `data:application/pdf;base64,${fileContent}`
                }
                title="Daraz Order Shipping Label PDF"
                className="w-full min-h-[600px] border-none print:h-screen print:w-screen print:fixed print:inset-0 print:z-50"
              />
            ) : mimeType.includes("html") || fileContent.trim().startsWith("<") ? (
              <iframe
                id="daraz-official-label-iframe"
                srcDoc={fileContent}
                title="Daraz Order Shipping Label"
                className="w-full min-h-[600px] border-none print:h-screen print:w-screen print:fixed print:inset-0 print:z-50"
              />
            ) : (
              <iframe
                id="daraz-official-label-iframe"
                srcDoc={fileContent}
                title="Daraz Order Shipping Label Document"
                className="w-full min-h-[600px] border-none print:h-screen print:w-screen print:fixed print:inset-0 print:z-50"
              />
            )}
          </div>
        ) : null}

        {/* Audit Info Footer */}
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
