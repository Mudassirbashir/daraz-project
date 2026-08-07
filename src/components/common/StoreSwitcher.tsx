"use client";

import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Store, ChevronDown } from "lucide-react";

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
    <div className="relative flex items-center">
      <div className="flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:border-orange-400 transition-all">
        <Store className="h-4 w-4 text-orange-500 flex-shrink-0" />
        <select
          value={currentStoreId}
          onChange={handleSelectStore}
          className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer pr-4"
        >
          <option value="all">All Stores (Combined View)</option>
          {stores.map((s, index) => (
            <option key={s.id} value={s.id}>
              {s.store_name} ({s.store_code}) {s.has_token ? "✓ Linked" : "⚠️ OAuth Needed"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
