"use client";

import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Store } from "lucide-react";

export interface StoreOption {
  id: string;
  store_code: string;
  store_name: string;
  seller_id: string;
  is_active: boolean;
  has_token: boolean;
}

interface StoreSwitcherProps {
  stores: StoreOption[];
}

export function StoreSwitcher({ stores }: StoreSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentStoreId = searchParams.get("storeId") || "all";

  const handleSelectStore = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());

    if (selectedId === "all") {
      params.delete("storeId");
    } else {
      params.set("storeId", selectedId);
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    router.push(`${pathname}${query}`);
  };

  return (
    <div className="relative flex items-center select-none">
      <div className="flex items-center space-x-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs hover:border-orange-400/80 transition-all apple-press">
        <Store className="h-4 w-4 text-orange-500 flex-shrink-0" />
        <select
          value={currentStoreId}
          onChange={handleSelectStore}
          className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer pr-3"
        >
          <option value="all">All Connected Stores (Unified ERP)</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.store_name} ({s.store_code}) {s.has_token ? "✓ Live" : "⚠️ Token Required"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
