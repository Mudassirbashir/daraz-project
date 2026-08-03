# Daraz Small Operations Platform - Architecture Document

Production-ready architecture for a lean, internal Daraz Operations Platform built for a 3-person team: **Mubashir** (Super Admin), **Mudassir** (Product Manager), and **Zainab** (Operations Manager).

Built with **Next.js (App Router)**, **Supabase (PostgreSQL + RLS + Auth)**, **Tailwind CSS**, **shadcn/ui**, and **Role-Based Access Control (RBAC)**.

---

## 👥 Roles & Responsibilities

| Team Member | Role Enum | Key Responsibilities & Module Access |
|---|---|---|
| **Mubashir** | `super_admin` | Full system control, store API credentials, financial control, user & system admin |
| **Mudassir** | `product_manager` | Product R&D / Development, vendor relationship management, store listings specs |
| **Zainab** | `ops_manager` | Central inventory control, Daraz order fulfillment processing, task operations, API sync monitoring |

---

## 📦 9 Core Operations Modules

1. **Product Development (R&D)**: Sample pipeline (`ideation`, `sourcing_samples`, `sample_testing`, `costing_approved`, `ready_for_listing`).
2. **Vendors & Suppliers**: Manufacturer contact catalog, country of origin, MOQ, lead times, rating.
3. **Daraz Stores Accounts**: Regional store credentials (`PK`, `BD`, `LK`, `NP`), seller ID, API app keys, OAuth tokens.
4. **Store Listings**: Listings per store (`seller_sku`, `daraz_item_id`, price, special_price, stock_quantity, sync_status).
5. **Central Inventory Control**: Physical stock levels, reserved quantity, reorder points, unit costs, storage locations.
6. **Orders & Delivery**: Synced Daraz orders (`daraz_order_id`, store ID, customer details, status, payout status).
7. **Team Tasks Board**: Internal task management assigned to Mubashir, Mudassir, or Zainab with priorities and due dates.
8. **Financial Control**: Record payments, Daraz payouts, ad spend, shipping costs, and profit calculations (Mubashir).
9. **Daraz API Synchronization**: Operational log tracking API sync jobs (`orders_sync`, `inventory_sync`, `listings_sync`, `price_sync`).

---

## 📁 Directory Hierarchy

```
daraz-operations-app/
├── supabase/
│   ├── seed.sql                            # Seed profiles for Mubashir, Mudassir, Zainab & demo data
│   └── migrations/                         # SQL schema migrations & RLS policies
│       └── 20260803000000_refactored_daraz_ops_schema.sql
├── src/
│   ├── app/                                # Next.js App Router
│   │   ├── (auth)/                         # Login & Unauthorized routes
│   │   ├── (dashboard)/                    # Protected operational layout shell
│   │   │   ├── dashboard/                  # Command center overview
│   │   │   ├── product-dev/                # Product R&D module shell
│   │   │   ├── vendors/                    # Vendors module shell
│   │   │   ├── stores/                     # Daraz Stores module shell
│   │   │   ├── listings/                   # Listings module shell
│   │   │   ├── inventory/                  # Central Inventory module shell
│   │   │   ├── orders/                     # Synced Orders module shell
│   │   │   ├── tasks/                      # Team Tasks module shell
│   │   │   ├── finance/                    # Financial Control module shell (Mubashir)
│   │   │   ├── sync/                       # Daraz API Sync module shell
│   │   │   └── admin/                      # System Administration (Mubashir)
│   │   ├── globals.css                     # Tailwind CSS design tokens
│   │   └── layout.tsx                      # Root HTML layout
│   ├── components/
│   │   ├── ui/                             # shadcn/ui primitives (Button, Card, Badge)
│   │   └── common/                         # Header, Sidebar, RoleBadge
│   ├── lib/
│   │   ├── supabase/                       # Supabase client singletons (@supabase/ssr)
│   │   └── rbac/                           # RBAC permissions matrix & guards
│   ├── types/                              # TypeScript types (database, rbac, domain)
│   └── middleware.ts                       # Next.js Edge Auth & Route RBAC Guard
└── README.md
```
