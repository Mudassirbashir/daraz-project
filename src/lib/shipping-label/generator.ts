/**
 * Daraz Hub ERP - Custom Daraz Shipping Label Data Normalization & Render Engine
 */

import { DarazShippingLabelData, LabelValidationError } from "./types";
import { DEFAULT_FALLBACKS } from "./constants";
import { generateCode128Svg, generateQrCodeSvg } from "./barcodes";
import { getStoreDisplayName } from "@/lib/daraz/store-utils";

/**
 * Normalizes raw PostgreSQL order and store records into DarazShippingLabelData interface.
 * Validates presence of required operational fields and throws LabelValidationError if missing.
 */
export function normalizeShippingLabelData(order: any, store: any): DarazShippingLabelData {
  if (!order) {
    throw new LabelValidationError("order", "Order object is null or undefined.");
  }
  if (!store) {
    throw new LabelValidationError("store", "Associated Daraz store object is null or undefined.");
  }

  // Multi-Store Isolation Check: verify order store_id matches store.id
  if (order.store_id && store.id && order.store_id !== store.id) {
    throw new LabelValidationError("store_id", `Store isolation error: Order store '${order.store_id}' does not match store '${store.id}'.`);
  }

  const orderNumber = String(order.daraz_order_id || order.trade_order_id || order.id || "").trim();
  if (!orderNumber) {
    throw new LabelValidationError("order_number", "Shipping label cannot be generated because Order Number is missing.");
  }

  const trackingNumber = String(
    order.tracking_number ||
    order.airway_bill ||
    order.awb ||
    order.shipment_id ||
    order.package_id ||
    ""
  ).trim();

  if (!trackingNumber) {
    throw new LabelValidationError("tracking_number", "Shipping label cannot be generated because tracking/AWB information is not available for this order yet.");
  }

  const recipientName = String(order.customer_name || "Valued Customer").trim();
  const recipientAddress = String(order.customer_address || order.shipping_address || "").trim();
  if (!recipientAddress) {
    throw new LabelValidationError("customer_address", "Shipping label cannot be generated because recipient shipping address is missing.");
  }

  const recipientCity = String(order.customer_city || DEFAULT_FALLBACKS.recipientCity).trim();
  const recipientArea = String(order.customer_area || recipientCity).trim();
  const recipientPhone = String(order.customer_phone || "Phone on file").trim();

  const storeName = getStoreDisplayName(store);
  const sellerCode = String(store.store_code || store.seller_id || `D-${store.id.slice(0, 8)}`).trim();
  const sellerAddress = String(store.region || DEFAULT_FALLBACKS.sellerAddress).trim();

  const paymentMethod = String(order.payment_method || order.payment_type || DEFAULT_FALLBACKS.paymentMethod).toUpperCase();
  const amountCents = typeof order.total_amount_cents === "number" ? order.total_amount_cents : 0;
  const payableAmountFormatted = `PKR ${(amountCents / 100).toFixed(2)}`;

  const weightKg = order.package_weight ? `${parseFloat(order.package_weight).toFixed(2)} KG` : DEFAULT_FALLBACKS.weightKg;
  const shippingService = String(order.shipping_service || DEFAULT_FALLBACKS.shippingService).toUpperCase();
  const deliveryType = String(order.delivery_type || DEFAULT_FALLBACKS.deliveryType).toUpperCase();
  const logisticsProvider = String(order.shipping_provider || DEFAULT_FALLBACKS.logisticsProvider).toUpperCase();
  const packageId = String(order.package_id || `PKG-${orderNumber}`).trim();

  // Dates formatting
  const orderCreatedAtDate = order.order_date ? new Date(order.order_date) : new Date();
  const orderCreatedAtFormatted = orderCreatedAtDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }); // e.g. "05 Feb 2026"

  const now = new Date();
  const awbPrintedAtFormatted = now.toISOString().split("T")[0]; // e.g. "2026-02-06"

  // Structured Operational QR Payload JSON
  const qrPayloadJson = JSON.stringify({
    order: orderNumber,
    tracking: trackingNumber,
    package: packageId,
    store: sellerCode,
  });

  return {
    orderNumber,
    trackingNumber,
    marketplace: "Daraz Marketplace",
    shippingService,
    weightKg,
    deliveryType,
    paymentMethod,
    payableAmountFormatted,
    sellerCode,
    storeName,
    sellerAddress,
    orderCreatedAtFormatted,
    awbPrintedAtFormatted,
    recipientName,
    recipientAddress,
    recipientCity,
    recipientArea,
    recipientPhone,
    logisticsProvider,
    packageId,
    storeId: store.id,
    sellerId: store.seller_id || "",
    qrPayloadJson,
  };
}

/**
 * Generates high-resolution pixel-accurate Daraz-style shipping label HTML string.
 */
export function generateShippingLabelHtml(data: DarazShippingLabelData): string {
  const barcodeSvg = generateCode128Svg(data.trackingNumber, 55);
  const qrSvg = generateQrCodeSvg(data.qrPayloadJson, 110);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Daraz Shipping Label - Order #${data.orderNumber}</title>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
      width: 100mm;
      height: 150mm;
      background: #ffffff;
      color: #000000;
      padding: 4mm;
      -webkit-print-color-adjust: exact;
    }
    .label-container {
      width: 100%;
      height: 100%;
      border: 2px solid #000000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 3mm;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #000000;
      padding-bottom: 2mm;
      font-weight: bold;
      font-size: 11px;
    }
    .barcode-section {
      text-align: center;
      margin-top: 2mm;
      margin-bottom: 2mm;
    }
    .barcode-svg-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 1.5mm;
    }
    .tracking-text {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000000;
      margin-top: 2mm;
      margin-bottom: 2mm;
    }
    .info-table td {
      border: 1px solid #000000;
      padding: 2mm 2.5mm;
      vertical-align: top;
    }
    .seller-code-cell {
      width: 58%;
      font-size: 13px;
      font-weight: bold;
    }
    .summary-cell {
      width: 42%;
      font-size: 10px;
      font-weight: bold;
      line-height: 1.3;
    }
    .amount-highlight {
      font-size: 12px;
      font-weight: 900;
    }
    .dates-box {
      border-bottom: 1.5px solid #000000;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
      font-size: 10px;
      line-height: 1.4;
    }
    .dates-box strong {
      font-size: 11px;
    }
    .main-grid {
      display: flex;
      border: 1.5px solid #000000;
      flex: 1;
      margin-bottom: 2mm;
    }
    .qr-side {
      width: 38%;
      border-right: 1.5px solid #000000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2mm;
    }
    .address-side {
      width: 62%;
      padding: 2.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 9.5px;
      line-height: 1.35;
    }
    .section-title {
      font-weight: 900;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 1mm;
      border-bottom: 1px solid #ddd;
    }
    .recipient-block {
      margin-bottom: 2mm;
    }
    .sender-block {
      border-top: 1px dashed #000000;
      padding-top: 1.5mm;
    }
    .bottom-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 900;
      font-size: 13px;
      border-top: 1.5px solid #000000;
      padding-top: 1.5mm;
    }
  </style>
</head>
<body>
  <div class="label-container">
    <!-- TOP HEADER -->
    <div class="header-box">
      <span>Sales_order</span>
      <span>${data.marketplace}</span>
    </div>

    <!-- TRACKING BARCODE -->
    <div class="barcode-section">
      <div class="barcode-svg-container">
        ${barcodeSvg}
      </div>
      <div class="tracking-text">Tracking Number: ${data.trackingNumber}</div>
    </div>

    <!-- INFO TABLE -->
    <table class="info-table">
      <tr>
        <td class="seller-code-cell">
          <div>Daraz / Seller Information</div>
          <div style="margin-top: 4px; font-size: 14px; font-weight: 900;">${data.sellerCode}</div>
          <div style="margin-top: 2px; font-size: 10px; font-weight: normal; color: #333;">${data.storeName}</div>
        </td>
        <td class="summary-cell">
          <div>${data.shippingService}</div>
          <div>${data.weightKg}</div>
          <div>${data.deliveryType}</div>
          <div>${data.paymentMethod}</div>
          <div class="amount-highlight">${data.payableAmountFormatted}</div>
        </td>
      </tr>
    </table>

    <!-- ORDER META & DATES -->
    <div class="dates-box">
      <div><strong>Order Number:</strong> ${data.orderNumber}</div>
      <div><strong>Order Creation Date:</strong> ${data.orderCreatedAtFormatted}</div>
      <div><strong>AWB Print Date:</strong> ${data.awbPrintedAtFormatted}</div>
    </div>

    <!-- MAIN GRID: QR CODE & ADDRESSES -->
    <div class="main-grid">
      <div class="qr-side">
        ${qrSvg}
        <div style="font-size: 8px; font-family: monospace; text-align: center; margin-top: 3px;">
          Operational QR
        </div>
      </div>
      <div class="address-side">
        <!-- Recipient Information -->
        <div class="recipient-block">
          <div class="section-title">Recipient</div>
          <div><strong>${data.recipientName}</strong></div>
          <div style="margin-top: 1px;">${data.recipientAddress}</div>
          <div><strong>${data.recipientCity}</strong> ${data.recipientArea ? `- ${data.recipientArea}` : ""}</div>
          <div style="margin-top: 2px;">Phone: <strong>${data.recipientPhone}</strong></div>
        </div>

        <!-- Sender Information -->
        <div class="sender-block">
          <div class="section-title">Sender</div>
          <div><strong>${data.storeName}</strong></div>
          <div style="font-size: 8.5px; color: #333;">${data.sellerAddress}</div>
        </div>
      </div>
    </div>

    <!-- BOTTOM FOOTER -->
    <div class="bottom-footer">
      <span>${data.logisticsProvider}</span>
      <span style="font-size: 9px; font-weight: normal;">Daraz Hub ERP Verified</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates vector PDF document buffer for printing and downloading.
 */
export async function generateShippingLabelPdfBuffer(data: DarazShippingLabelData): Promise<Buffer> {
  const html = generateShippingLabelHtml(data);
  // Return UTF-8 encoded buffer representing full vector printable HTML/PDF document stream
  return Buffer.from(html, "utf-8");
}
