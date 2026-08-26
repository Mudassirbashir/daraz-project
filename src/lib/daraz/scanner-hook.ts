import { handleBarcodeScan } from './scanner-service';

/**
 * Hook for handling barcode scans in React components
 * Provides a debounced, cached scanning function
 */
export const useBarcodeScanner = () => {
  return handleBarcodeScan;
};

/**
 * Clear the scan cache (useful for testing or when store credentials change)
 */
export const clearScanCache = () => {
  // Import here to avoid circular dependencies
  const { clearScanCache: clearCache } = require('./scanner-service');
  clearCache();
};

export default {
  useBarcodeScanner,
  clearScanCache,
};