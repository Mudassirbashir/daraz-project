/**
 * Daraz Hub ERP - Shipping Label Centralized Layout & Styling Constants
 * All measurements are defined in mm / px for standard 4x6 inch (100mm x 150mm) label media.
 */

import { LabelLayoutConfig } from "./types";

export const DEFAULT_LABEL_CONFIG: LabelLayoutConfig = {
  labelWidthMm: 100, // 4 inches
  labelHeightMm: 150, // 6 inches
  marginMm: 4,
  barcodeHeightMm: 22,
  qrSizeMm: 32,
  primaryFontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  borderColor: "#000000",
  headerBgColor: "#ffffff",
};

export const DEFAULT_FALLBACKS = {
  shippingService: "STANDARD",
  weightKg: "0.50 KG",
  deliveryType: "HOME",
  paymentMethod: "COD",
  logisticsProvider: "PK-DEX",
  sellerAddress: "Seller Center Warehouse, Pakistan",
  recipientCity: "Pakistan",
};
