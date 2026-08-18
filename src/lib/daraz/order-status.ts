import { DarazOrderStatus } from "@/types/database.types";

export type DarazWorkflowStatus =
  | "pending"
  | "unpaid"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "canceled"
  | "returned"
  | "failed";

export interface StatusMappingResult {
  darazStatus: string;
  normalizedStatus: DarazOrderStatus;
  workflowStatus: string;
  isActionable: boolean; // Needs seller fulfillment (packing/shipping)
  isHistorical: boolean; // Historical/Completed or in-transit
  uiLabel: string;
  uiCategory: "pending" | "ready_to_ship" | "shipped" | "delivered" | "canceled";
}

/**
 * Centralized Order Status Mapping Engine for Official Daraz Seller Center APIs.
 *
 * Normalizes all known Daraz API order and package statuses into internal
 * operational workflow statuses and UI categories.
 *
 * Actionable Statuses ("Orders To Fulfill"):
 * - pending, unpaid, ready_to_ship, to_pack, to_ship, processing, packed, picking
 *
 * Historical/Non-Actionable Statuses:
 * - shipped, in_transit, delivered, completed, canceled, cancelled, returned, failed
 */
export function mapDarazOrderStatus(rawStatusInput: string): StatusMappingResult {
  const rawStatus = (rawStatusInput || "pending").toString().trim();
  const cleanStatus = rawStatus.toLowerCase().replace(/[-\s]+/g, "_");

  // 1. Actionable: Pending & Unpaid
  if (cleanStatus === "unpaid") {
    return {
      darazStatus: rawStatus,
      normalizedStatus: "unpaid",
      workflowStatus: "unpaid",
      isActionable: true,
      isHistorical: false,
      uiLabel: "Unpaid Order",
      uiCategory: "pending",
    };
  }

  if (["pending", "processing", "created", "topack", "to_pack"].includes(cleanStatus)) {
    return {
      darazStatus: rawStatus,
      normalizedStatus: "pending",
      workflowStatus: "pending",
      isActionable: true,
      isHistorical: false,
      uiLabel: "Pending Fulfillment",
      uiCategory: "pending",
    };
  }

  // 2. Actionable: Ready To Ship / Packed / Picking
  if (["ready_to_ship", "toship", "to_ship", "packed", "picking"].includes(cleanStatus)) {
    return {
      darazStatus: rawStatus,
      normalizedStatus: "ready_to_ship",
      workflowStatus: "ready_to_ship",
      isActionable: true,
      isHistorical: false,
      uiLabel: "Ready To Ship",
      uiCategory: "ready_to_ship",
    };
  }

  // 3. Historical / Non-Actionable: Shipped (On the way)
  if (["shipped", "in_transit", "dispatched", "shipped_to_3pl"].includes(cleanStatus)) {
    return {
      darazStatus: rawStatus,
      normalizedStatus: "shipped",
      workflowStatus: "shipped",
      isActionable: false,
      isHistorical: true,
      uiLabel: "On The Way (Shipped)",
      uiCategory: "shipped",
    };
  }

  // 4. Historical / Non-Actionable: Delivered / Completed
  if (["delivered", "completed", "successful"].includes(cleanStatus)) {
    return {
      darazStatus: rawStatus,
      normalizedStatus: "delivered",
      workflowStatus: "delivered",
      isActionable: false,
      isHistorical: true,
      uiLabel: "Delivered",
      uiCategory: "delivered",
    };
  }

  // 5. Historical / Non-Actionable: Canceled / Cancelled
  if (["canceled", "cancelled", "buyer_cancel", "seller_cancel"].includes(cleanStatus)) {
    return {
      darazStatus: rawStatus,
      normalizedStatus: "canceled",
      workflowStatus: "canceled",
      isActionable: false,
      isHistorical: true,
      uiLabel: "Canceled",
      uiCategory: "canceled",
    };
  }

  // 6. Historical / Non-Actionable: Returned
  if (["returned", "return_rejected", "return_issued", "failed_delivery"].includes(cleanStatus)) {
    return {
      darazStatus: rawStatus,
      normalizedStatus: "returned",
      workflowStatus: "returned",
      isActionable: false,
      isHistorical: true,
      uiLabel: "Returned",
      uiCategory: "canceled",
    };
  }

  // 7. Historical / Non-Actionable: Failed
  if (["failed", "lost", "damaged"].includes(cleanStatus)) {
    return {
      darazStatus: rawStatus,
      normalizedStatus: "failed",
      workflowStatus: "failed",
      isActionable: false,
      isHistorical: true,
      uiLabel: "Delivery Failed",
      uiCategory: "canceled",
    };
  }

  // Fallback for unmapped custom status
  return {
    darazStatus: rawStatus,
    normalizedStatus: "pending",
    workflowStatus: cleanStatus || "pending",
    isActionable: true,
    isHistorical: false,
    uiLabel: rawStatus || "Pending",
    uiCategory: "pending",
  };
}

/**
 * Returns true if the given status string represents an actionable order ("Orders To Fulfill").
 */
export function isActionableStatus(statusInput: string): boolean {
  return mapDarazOrderStatus(statusInput).isActionable;
}

/**
 * Returns list of status string values that represent actionable orders for SQL IN queries.
 */
export const ACTIONABLE_STATUS_LIST = ["pending", "unpaid", "ready_to_ship", "picking", "packed", "to_pack", "to_ship"];
