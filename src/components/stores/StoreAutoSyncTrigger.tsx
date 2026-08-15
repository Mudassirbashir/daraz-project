"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface StoreAutoSyncTriggerProps {
  storeId?: string;
  isSyncing?: boolean;
}

export function StoreAutoSyncTrigger({ storeId, isSyncing }: StoreAutoSyncTriggerProps) {
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
      .then((res) => res.json())
      .then((data) => {
        console.log(`[StoreAutoSyncTrigger] Sync response:`, data);
        router.refresh();
      })
      .catch((err) => {
        console.error(`[StoreAutoSyncTrigger] Auto sync error:`, err);
        router.refresh();
      });
  }, [storeId, router]);

  return null;
}
