/**
 * Sanitized Daraz API Response Fixtures for Data Integrity & Reconciliation Tests
 * All secrets, tokens, customer PII, and sensitive keys are sanitized / synthetic mocks.
 */

export const SANITIZED_DARAZ_SELLER_PROFILE_FIXTURE = {
  code: "0",
  data: {
    seller_id: "SELLER_1009827",
    name: "Apex Electronics Official Store",
    short_code: "PK1009827",
    email: "seller.apex@example.com",
    location: "Karachi, Pakistan",
  },
};

export const SANITIZED_PASCAL_CASE_CATALOG_FIXTURE = {
  code: "0",
  data: {
    total_products: 2,
    Products: [
      {
        ItemId: "DRZ-ITEM-9001",
        Title: "Premium Noise Cancelling Wireless Headphones",
        PrimaryCategory: "Audio & Headphones",
        Attributes: {
          brand: "SoundMaster",
          name_en: "Premium Noise Cancelling Wireless Headphones",
          description: "High fidelity Bluetooth wireless headphones with active noise cancellation.",
          color_family: "Matte Black",
        },
        Images: [
          "//img.drz.lazcdn.com/g/p/headphone-1.jpg",
          "https://img.drz.lazcdn.com/g/p/headphone-2.jpg",
        ],
        Skus: [
          {
            SellerSku: "HDPHN-NC-BLK",
            SkuId: "SKU-9001-B",
            ShopSku: "PK-SKU-9001-B",
            Price: "149.99",
            SpecialPrice: "129.99",
            Quantity: 45,
            WithholdingQuantity: 5,
            Status: "active",
            Images: ["//img.drz.lazcdn.com/g/p/headphone-blk.jpg"],
          },
          {
            SellerSku: "HDPHN-NC-SLV",
            SkuId: "SKU-9001-S",
            ShopSku: "PK-SKU-9001-S",
            Price: "149.99",
            SpecialPrice: "139.99",
            Quantity: 20,
            WithholdingQuantity: 2,
            Status: "active",
            Images: ["//img.drz.lazcdn.com/g/p/headphone-slv.jpg"],
          },
        ],
      },
      {
        ItemId: "DRZ-ITEM-9002",
        Title: "Ergonomic Mechanical Gaming Keyboard",
        PrimaryCategory: "Computer Accessories",
        Attributes: {
          brand: "KeyPro",
          name: "Ergonomic Mechanical Gaming Keyboard",
          description: "RGB Mechanical Keyboard with blue tactile switches.",
        },
        Images: ["https://img.drz.lazcdn.com/g/p/keyboard-main.jpg"],
        Skus: [
          {
            SellerSku: "KB-GAMING-RGB",
            SkuId: "SKU-9002-RGB",
            ShopSku: "PK-SKU-9002-RGB",
            Price: "89.50",
            Quantity: 100,
            WithholdingQuantity: 0,
            Status: "active",
          },
        ],
      },
    ],
  },
};

export const SANITIZED_CAMEL_CASE_CATALOG_FIXTURE = {
  code: "0",
  data: {
    total_products: 1,
    products: [
      {
        item_id: "DRZ-ITEM-8001",
        title: "Smart Fitness Watch Ultra",
        category: "Wearable Technology",
        attributes: {
          brand: "TechFit",
          name: "Smart Fitness Watch Ultra",
          description: "Waterproof smartwatch with heart rate monitor and GPS.",
        },
        images: ["https://img.drz.lazcdn.com/g/p/smartwatch.jpg"],
        skus: [
          {
            seller_sku: "WATCH-ULTRA-BLK",
            sku_id: "SKU-8001-W",
            shop_sku: "PK-SKU-8001-W",
            price: "199.00",
            special_price: "179.00",
            quantity: 30,
            reserved_quantity: 3,
            status: "active",
          },
        ],
      },
    ],
  },
};

export const SANITIZED_PAGINATION_PAGE1_FIXTURE = {
  code: "0",
  data: {
    total_products: 4,
    products: [
      {
        item_id: "PAGE-ITEM-01",
        title: "Item Page 1 - A",
        attributes: { brand: "Brand A" },
        skus: [{ seller_sku: "PAGE1-SKU-A", price: "10.00", quantity: 15 }],
      },
      {
        item_id: "PAGE-ITEM-02",
        title: "Item Page 1 - B",
        attributes: { brand: "Brand B" },
        skus: [{ seller_sku: "PAGE1-SKU-B", price: "20.00", quantity: 25 }],
      },
    ],
  },
};

export const SANITIZED_PAGINATION_PAGE2_FIXTURE = {
  code: "0",
  data: {
    total_products: 4,
    products: [
      {
        item_id: "PAGE-ITEM-03",
        title: "Item Page 2 - C",
        attributes: { brand: "Brand C" },
        skus: [{ seller_sku: "PAGE2-SKU-C", price: "30.00", quantity: 35 }],
      },
      {
        item_id: "PAGE-ITEM-04",
        title: "Item Page 2 - D",
        attributes: { brand: "Brand D" },
        skus: [{ seller_sku: "PAGE2-SKU-D", price: "40.00", quantity: 45 }],
      },
    ],
  },
};

export const SANITIZED_MALFORMED_ITEMS_FIXTURE = {
  code: "0",
  data: {
    total_products: 3,
    products: [
      // Valid item
      {
        item_id: "VALID-ITEM-101",
        title: "Valid Item 101",
        attributes: { brand: "Valid Brand" },
        skus: [{ seller_sku: "VALID-SKU-101", price: "15.00", quantity: 10 }],
      },
      // Invalid item: missing item_id
      {
        title: "Invalid Item Missing ItemId",
        attributes: { brand: "No ID Brand" },
        skus: [{ seller_sku: "ORPHAN-SKU-001", price: "25.00", quantity: 5 }],
      },
      // Invalid item: missing seller_sku on SKU
      {
        item_id: "VALID-ITEM-102",
        title: "Valid Parent with Invalid SKU",
        attributes: { brand: "Valid Brand" },
        skus: [{ price: "35.00", quantity: 12 }],
      },
    ],
  },
};

export const SANITIZED_ORDERS_FIXTURE = {
  code: "0",
  data: {
    countTotal: 1,
    orders: [
      {
        order_id: "DRZ-ORD-5501",
        order_number: "55019823",
        package_id: "PKG-5501",
        tracking_code: "DEX-PK-9876543",
        customer_first_name: "Tariq",
        customer_last_name: "Mahmood",
        customer_phone: "+923001234567",
        statuses: ["pending"],
        price: "149.99",
        shipping_fee: "5.00",
        created_at: "2026-08-18T09:30:00Z",
        address_shipping: {
          first_name: "Tariq",
          last_name: "Mahmood",
          phone: "+923001234567",
          city: "Karachi",
          address1: "House 123, Street 4, Block B",
          address3: "Sindh",
          postCode: "75500",
        },
      },
    ],
  },
};

export interface MockStoreOrderFixture {
  store_id: string;
  order_id: string;
  daraz_order_id: string;
  order_item_id: string;
  seller_sku: string;
  sku: string;
  barcode: string;
  tracking_number: string;
  product_name: string;
  quantity: number;
  order_status: string;
}

/**
 * Realistic Multi-Store Order Scanning Test Fixtures (Task 6)
 * Store A and Store B deliberately share seller_sku ("SHIRT-BLUE-M"), SKU ("SKU-001"), and barcode ("890000000001").
 */
export const MULTI_STORE_SCANNER_FIXTURES: Record<string, MockStoreOrderFixture[]> = {
  "STORE-ID-A": [
    {
      store_id: "STORE-ID-A",
      order_id: "ORD-A-10001",
      daraz_order_id: "A-10001",
      order_item_id: "A-ITEM-01",
      seller_sku: "SHIRT-BLUE-M",
      sku: "SKU-001",
      barcode: "890000000001",
      tracking_number: "TRACK-A-10001",
      product_name: "Blue Cotton Shirt M (Store A)",
      quantity: 1,
      order_status: "pending",
    },
    {
      store_id: "STORE-ID-A",
      order_id: "ORD-A-10002",
      daraz_order_id: "A-10002",
      order_item_id: "A-ITEM-02",
      seller_sku: "SHIRT-BLUE-M",
      sku: "SKU-001",
      barcode: "890000000001",
      tracking_number: "TRACK-A-10002",
      product_name: "Blue Cotton Shirt M (Store A - Order 2)",
      quantity: 2,
      order_status: "pending",
    },
  ],
  "STORE-ID-B": [
    {
      store_id: "STORE-ID-B",
      order_id: "ORD-B-20001",
      daraz_order_id: "B-20001",
      order_item_id: "B-ITEM-01",
      seller_sku: "SHIRT-BLUE-M",
      sku: "SKU-001",
      barcode: "890000000001",
      tracking_number: "TRACK-B-20001",
      product_name: "Blue Cotton Shirt M (Store B)",
      quantity: 1,
      order_status: "pending",
    },
  ],
};

