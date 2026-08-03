import { Database } from "./database.types";

export type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
export type ProductDevelopment = Database["public"]["Tables"]["product_developments"]["Row"];
export type DarazStore = Database["public"]["Tables"]["daraz_stores"]["Row"];
export type Inventory = Database["public"]["Tables"]["inventory"]["Row"];
export type Listing = Database["public"]["Tables"]["listings"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type FinancialRecord = Database["public"]["Tables"]["financial_records"]["Row"];
export type DarazApiLog = Database["public"]["Tables"]["daraz_api_logs"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
