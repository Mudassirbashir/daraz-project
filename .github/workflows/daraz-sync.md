---
# Daraz Multi-Store Sync & Operations Agentic Workflow
on:
  workflow_dispatch:
  schedule: daily

permissions:
  contents: read
  issues: read
  pull-requests: read

safe-outputs:
  create-issue:
    max: 2

---

# Daraz Operations Multi-Store Sync Agent

Automated agentic workflow responsible for monitoring, auditing, and verifying Daraz store synchronization, inventory stock tracking, and order ingestion.

## Workflow Instructions

1. **Verify Connected Daraz Stores & Token Health**:
   - Check store identity for all active connected stores.
   - Verify OAuth token expiration status and refresh credentials if needed.

2. **Verify Catalog & Stock Variations**:
   - Fetch item listings and SKU variations across connected stores.
   - Audit stock quantities, special prices, and reserved quantities.
   - Enforce multi-store SKU isolation using `(store_id, seller_sku)` scoping.

3. **Verify Orders & Line Items**:
   - Ingest historical and recent orders up to current timestamp.
   - Map order workflow statuses and customer shipping details accurately.

4. **Database & Store-Scoped UI Consistency Audit**:
   - Ensure child listing and order counts match database records per store.
   - Report any sync failures or API pagination errors in store status logs.

5. **Reporting**:
   - If persistent sync errors occur on any store, create a detailed GitHub issue summarizing the store ID, endpoint error, and diagnostic traceback.
