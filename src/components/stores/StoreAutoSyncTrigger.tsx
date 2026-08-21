"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface StoreAutoSyncTriggerProps {
  storeId?: string;
  isSyncing?: boolean;
}

export function StoreAutoSyncTrigger({ storeId }: StoreAutoSyncTriggerProps) {
  const router = useRouter();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!storeId || hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    console.log(`[StoreAutoSyncTrigger] Initiating automatic sync for store ${storeId}...`);

    fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_id: storeId }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        const syncRes = data?.result || data;

        if (res.ok && data.success) {
          console.log(`[StoreAutoSyncTrigger] Auto sync SUCCESS for store ${storeId}:`, {
            status: res.status,
            syncStatus: syncRes?.status || "completed",
            storesSynced: syncRes?.storesSynced,
            productsSynced: syncRes?.productsSynced,
            skusSynced: syncRes?.skusSynced,
            ordersSynced: syncRes?.ordersSynced,
            orderItemsSynced: syncRes?.orderItemsSynced,
            durationMs: syncRes?.durationMs,
          });
        } else {
          console.error(`[StoreAutoSyncTrigger] Auto sync FAILURE for store ${storeId}:`, {
            status: res.status,
            failedModule: syncRes?.failedModule || data?.failedModule || "unknown",
            errorCode: syncRes?.errorCode || data?.errorCode || "SYNC_ERROR",
            errorMessage: syncRes?.errorMessage || data?.error || data?.message || "Sync execution failed",
            moduleResults: syncRes?.moduleResults || {},
            errors: syncRes?.errors || data?.errors || [],
          });
        }
        router.refresh();
      })
      .catch((err) => {
        console.error(`[StoreAutoSyncTrigger] Auto sync network error for store ${storeId}:`, {
          message: err?.message || "Failed to communicate with sync API",
        });
        router.refresh();
      });
  }, [storeId, router]);

  return null;
}
