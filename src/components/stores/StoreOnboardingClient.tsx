"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { StoreOnboardingModal } from "./StoreOnboardingModal";
import { StoreCardActions } from "./StoreCardActions";

interface StoreOnboardingClientProps {
  isMaxStoresReached: boolean;
  storeId: string;
  storeName: string;
  isConnected: boolean;
  mode: "button" | "card_actions";
}

export function StoreOnboardingClient({
  isMaxStoresReached,
  storeId,
  storeName,
  isConnected,
  mode,
}: StoreOnboardingClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reconnectId, setReconnectId] = useState<string | null>(null);
  const [reconnectName, setReconnectName] = useState<string | null>(null);

  const handleOpenNew = () => {
    setReconnectId(null);
    setReconnectName(null);
    setIsOpen(true);
  };

  const handleOpenReconnect = (sId: string, sName: string) => {
    setReconnectId(sId);
    setReconnectName(sName);
    setIsOpen(true);
  };

  if (mode === "button") {
    if (isMaxStoresReached) {
      return (
        <button
          disabled
          title="Maximum 3 Daraz stores allowed. Remove an existing store before connecting another."
          className="inline-flex items-center space-x-1.5 rounded-xl bg-slate-300 dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-500 cursor-not-allowed opacity-75"
        >
          <Plus className="h-4 w-4" />
          <span>Max 3 Stores Reached</span>
        </button>
      );
    }

    return (
      <>
        <button
          onClick={handleOpenNew}
          title="Connect a new official Daraz seller account"
          className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all apple-press"
        >
          <Plus className="h-4 w-4" />
          <span>Connect New Store</span>
        </button>

        <StoreOnboardingModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          reconnectStoreId={reconnectId}
          reconnectStoreName={reconnectName}
        />
      </>
    );
  }

  return (
    <>
      <StoreCardActions
        storeId={storeId}
        storeName={storeName}
        isConnected={isConnected}
        onReconnect={handleOpenReconnect}
      />

      <StoreOnboardingModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        reconnectStoreId={reconnectId}
        reconnectStoreName={reconnectName}
      />
    </>
  );
}
