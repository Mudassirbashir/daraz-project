/**
 * Daraz Hub ERP - Shipping Label Engine Types & Interfaces
 */

export interface DarazShippingLabelData {
  orderNumber: string;
  trackingNumber: string;
  marketplace: string;
  shippingService: string;
  weightKg: string;
  deliveryType: string;
  paymentMethod: string;
  payableAmountFormatted: string;
  sellerCode: string;
  storeName: string;
  sellerAddress: string;
  orderCreatedAtFormatted: string;
  awbPrintedAtFormatted: string;
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  recipientArea: string;
  recipientPhone: string;
  recipientSubArea?: string;
  senderPhone?: string;
  routingCode?: string;
  hubCode?: string;
  logisticsProvider: string;
  packageId: string;
  storeId: string;
  sellerId: string;
  qrPayloadJson: string;
}

export interface LabelLayoutConfig {
  labelWidthMm: number;
  labelHeightMm: number;
  marginMm: number;
  barcodeHeightMm: number;
  qrSizeMm: number;
  primaryFontFamily: string;
  borderColor: string;
  headerBgColor: string;
}

export class LabelValidationError extends Error {
  public field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "LabelValidationError";
    this.field = field;
  }
}
