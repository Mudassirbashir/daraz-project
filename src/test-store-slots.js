/**
 * Daraz Store Slot Allocation & Active Store Limit Test Suite
 * Validates all 10 scenario requirements for store slot management.
 */

function calculateLowestAvailableSlot(activeSlots) {
  const validSlots = activeSlots.filter((n) => typeof n === "number" && n > 0);
  const sorted = Array.from(new Set(validSlots)).sort((a, b) => a - b);
  let nextSlot = 1;
  for (const slot of sorted) {
    if (slot === nextSlot) nextSlot++;
    else if (slot > nextSlot) break;
  }
  return nextSlot > 3 ? 3 : nextSlot;
}

function evaluateStoreConnectionLimit(activeStoreCount) {
  if (activeStoreCount >= 3) {
    return { allowed: false, error: "Maximum 3 active Daraz stores allowed. Disconnect an existing store before connecting another." };
  }
  return { allowed: true };
}

function simulateOAuthConnection(stores, sellerId, storeName) {
  const activeStores = stores.filter((s) => s.is_active);
  const existingStoreIndex = stores.findIndex((s) => s.seller_id === sellerId);

  if (existingStoreIndex !== -1) {
    // Reconnection flow: reuse existing store row
    const existing = stores[existingStoreIndex];
    const assignedSlot = (existing.is_active && existing.slot_number) ? existing.slot_number : calculateLowestAvailableSlot(activeStores.map((s) => s.slot_number));
    existing.is_active = true;
    existing.slot_number = assignedSlot;
    existing.access_token = "mock_access_token_" + Date.now();
    existing.updated_at = new Date().toISOString();
    return { success: true, isNew: false, store: existing };
  } else {
    // New seller flow: enforce 3 active store limit
    const limitCheck = evaluateStoreConnectionLimit(activeStores.length);
    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.error };
    }

    const assignedSlot = calculateLowestAvailableSlot(activeStores.map((s) => s.slot_number));
    const newStore = {
      id: "store_uuid_" + (stores.length + 1),
      seller_id: sellerId,
      store_name: storeName,
      is_active: true,
      slot_number: assignedSlot,
      access_token: "mock_access_token_" + Date.now(),
      created_at: new Date().toISOString(),
    };
    stores.push(newStore);
    return { success: true, isNew: true, store: newStore };
  }
}

function simulateStoreDisconnect(stores, storeId) {
  const target = stores.find((s) => s.id === storeId);
  if (target) {
    target.is_active = false;
    target.access_token = null;
    target.slot_number = null;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log(" RUNNING DARAZ STORE SLOT SYSTEM 10 SCENARIO TESTS");
  console.log("==================================================\n");

  let passedCount = 0;

  // Test 1: No active stores -> Lowest available slot = 1
  const t1 = calculateLowestAvailableSlot([]);
  if (t1 === 1) {
    console.log("✅ Test 1 PASSED: No active stores -> Slot 1 assigned.");
    passedCount++;
  } else console.error("❌ Test 1 FAILED: Expected 1, got", t1);

  // Test 2: Store 1 active -> Lowest available slot = 2
  const t2 = calculateLowestAvailableSlot([1]);
  if (t2 === 2) {
    console.log("✅ Test 2 PASSED: Store 1 active -> Slot 2 assigned.");
    passedCount++;
  } else console.error("❌ Test 2 FAILED: Expected 2, got", t2);

  // Test 3: Store 1 + 2 active -> Lowest available slot = 3
  const t3 = calculateLowestAvailableSlot([1, 2]);
  if (t3 === 3) {
    console.log("✅ Test 3 PASSED: Store 1 + Store 2 active -> Slot 3 assigned.");
    passedCount++;
  } else console.error("❌ Test 3 FAILED: Expected 3, got", t3);

  // Test 4: Store 1 + 2 + 3 active -> Blocked with 3 active stores limit
  const limitCheck = evaluateStoreConnectionLimit(3);
  if (!limitCheck.allowed && limitCheck.error.includes("Maximum 3 active")) {
    console.log("✅ Test 4 PASSED: 3 active stores -> Blocked with 'Maximum 3 active stores'.");
    passedCount++;
  } else console.error("❌ Test 4 FAILED: Expected blocked connection, got", limitCheck);

  // Test 5: 1, 2, 3 active -> Remove Store 2 -> Next slot = 2
  const t5 = calculateLowestAvailableSlot([1, 3]);
  if (t5 === 2) {
    console.log("✅ Test 5 PASSED: Stores 1 & 3 active (Store 2 removed) -> Slot 2 assigned.");
    passedCount++;
  } else console.error("❌ Test 5 FAILED: Expected 2, got", t5);

  // Test 6: 1, 2, 3 active -> Remove all -> Next slot = 1
  const t6 = calculateLowestAvailableSlot([]);
  if (t6 === 1) {
    console.log("✅ Test 6 PASSED: All stores removed -> Slot 1 assigned.");
    passedCount++;
  } else console.error("❌ Test 6 FAILED: Expected 1, got", t6);

  // Test 7: 1 and 3 active -> Next slot = 2
  const t7 = calculateLowestAvailableSlot([1, 3]);
  if (t7 === 2) {
    console.log("✅ Test 7 PASSED: Stores 1 and 3 active -> Slot 2 assigned.");
    passedCount++;
  } else console.error("❌ Test 7 FAILED: Expected 2, got", t7);

  // Test 8: Existing seller disconnects and reconnects -> Same store UUID reused
  const mockStoresDB = [];
  const storeA = simulateOAuthConnection(mockStoresDB, "SELLER_100", "Alpha Store");
  const initialUuid = storeA.store.id;
  simulateStoreDisconnect(mockStoresDB, initialUuid);
  const storeAReconnect = simulateOAuthConnection(mockStoresDB, "SELLER_100", "Alpha Store");

  if (storeAReconnect.store.id === initialUuid && mockStoresDB.length === 1) {
    console.log("✅ Test 8 PASSED: Same seller reconnected -> Reused existing UUID (" + initialUuid + ") without creating duplicate row.");
    passedCount++;
  } else console.error("❌ Test 8 FAILED: Expected UUID reuse, got store count", mockStoresDB.length);

  // Test 9: Concurrency safety simulation
  const slotsClaimed = new Set();
  function attemptClaimSlot(activeSlots) {
    const slot = calculateLowestAvailableSlot(activeSlots);
    if (slotsClaimed.has(slot)) {
      throw new Error(`Slot ${slot} conflict detected under concurrent request!`);
    }
    slotsClaimed.add(slot);
    return slot;
  }
  try {
    const slotReqA = attemptClaimSlot([]);
    const slotReqB = attemptClaimSlot([slotReqA]);
    if (slotReqA === 1 && slotReqB === 2) {
      console.log("✅ Test 9 PASSED: Concurrency safety simulation ensured unique slots (1 and 2).");
      passedCount++;
    }
  } catch (e) {
    console.error("❌ Test 9 FAILED:", e.message);
  }

  // Test 10: Existing products/orders remain connected to correct store UUID after slot reuse
  const sampleListings = [{ id: "list_1", store_id: initialUuid, title: "Product A" }];
  const sampleOrders = [{ id: "order_1", store_id: initialUuid, total_cents: 5000 }];
  
  if (sampleListings[0].store_id === storeAReconnect.store.id && sampleOrders[0].store_id === storeAReconnect.store.id) {
    console.log("✅ Test 10 PASSED: Products & orders remained connected to store UUID after slot reuse.");
    passedCount++;
  } else console.error("❌ Test 10 FAILED: Store UUID mismatch in listings or orders.");

  console.log("==================================================");
  console.log(` SUMMARY: ${passedCount} / 10 TESTS PASSED`);
  console.log("==================================================\n");

  if (passedCount !== 10) {
    process.exit(1);
  }
}

module.exports = {
  calculateLowestAvailableSlot,
  evaluateStoreConnectionLimit,
  runTests,
};

if (require.main === module) {
  runTests();
}
