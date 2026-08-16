export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'super_admin' | 'product_manager' | 'ops_manager';

export type ProductDevStage =
  | 'ideation'
  | 'sourcing_samples'
  | 'sample_testing'
  | 'costing_approved'
  | 'ready_for_listing'
  | 'archived';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export type DarazOrderStatus =
  | 'unpaid'
  | 'pending'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'canceled'
  | 'returned'
  | 'failed';

export type FinancialRecordType =
  | 'vendor_payment'
  | 'daraz_payout'
  | 'ad_spend'
  | 'shipping_cost'
  | 'customs_tax'
  | 'other_expense';

export type SyncJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          employee_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          role: AppRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppRole;
          assigned_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_roles']['Row'], 'id' | 'assigned_at'> & {
          id?: string;
          assigned_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
      };
      vendors: {
        Row: {
          id: string;
          code: string;
          name: string;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          country: string | null;
          payment_terms: string | null;
          moq: number;
          lead_time_days: number;
          rating: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['vendors']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['vendors']['Insert']>;
      };
      product_developments: {
        Row: {
          id: string;
          code: string;
          name: string;
          category: string;
          stage: ProductDevStage;
          vendor_id: string | null;
          target_cost_cents: number;
          estimated_selling_price_cents: number;
          sample_ordered_date: string | null;
          sample_received_date: string | null;
          assigned_to: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['product_developments']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['product_developments']['Insert']>;
      };
      daraz_stores: {
        Row: {
          id: string;
          store_code: string;
          store_name: string;
          region: string;
          seller_id: string;
          api_app_key: string | null;
          api_app_secret: string | null;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          is_active: boolean;
          slot_number: number | null;
          user_id?: string | null;
          sync_status?: string | null;
          last_synced_at?: string | null;
          last_sync_error?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daraz_stores']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          slot_number?: number | null;
          user_id?: string | null;
          sync_status?: string | null;
          last_synced_at?: string | null;
          last_sync_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daraz_stores']['Insert']>;
      };
      inventory: {
        Row: {
          id: string;
          sku: string;
          title: string;
          category: string;
          quantity_on_hand: number;
          quantity_reserved: number;
          reorder_point: number;
          unit_cost_cents: number;
          storage_location: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>;
      };
      listings: {
        Row: {
          id: string;
          store_id: string;
          product_dev_id: string | null;
          inventory_id: string | null;
          seller_sku: string;
          daraz_item_id: string | null;
          daraz_sku_id: string | null;
          title: string;
          category: string | null;
          brand: string | null;
          status: string | null;
          description: string | null;
          images: Json;
          attributes: Json;
          variations: Json;
          product_url: string | null;
          price_cents: number;
          special_price_cents: number | null;
          stock_quantity: number;
          is_synced: boolean;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['listings']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['listings']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          store_id: string;
          daraz_order_id: string;
          tracking_number: string | null;
          customer_name: string | null;
          customer_city: string | null;
          total_amount_cents: number;
          status: DarazOrderStatus;
          is_payout_settled: boolean;
          is_packed: boolean;
          packed_at: string | null;
          packed_by: string | null;
          is_label_printed: boolean;
          label_printed_at: string | null;
          label_printed_by: string | null;
          reprint_count: number;
          order_date: string;
          created_at: string;
          updated_at: string;
          raw_payload?: Json;
          customer_phone?: string | null;
          customer_email?: string | null;
          customer_address?: string | null;
          customer_province?: string | null;
          customer_district?: string | null;
          customer_area?: string | null;
          customer_landmark?: string | null;
          customer_postcode?: string | null;
          customer_id?: string | null;
          customer_notes?: string | null;
          order_number?: string | null;
          package_id?: string | null;
          shipping_provider?: string | null;
          shipping_method?: string | null;
          payment_method?: string | null;
          currency?: string | null;
          shipping_fee_cents?: number;
          voucher_discount_cents?: number;
          seller_discount_cents?: number;
          tax_cents?: number;
          daraz_created_at?: string | null;
          daraz_updated_at?: string | null;
          workflow_status?: string;
          sync_status?: string;
          sync_error?: string | null;
          last_synced_at?: string | null;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          daraz_order_id: string;
          order_item_id: string;
          name: string;
          seller_sku: string;
          shop_sku: string | null;
          item_id: string | null;
          product_id: string | null;
          variation: string | null;
          quantity: number;
          picked_quantity: number;
          is_picked: boolean;
          item_price_cents: number;
          paid_price_cents: number;
          discount_cents: number;
          product_main_image: string | null;
          status: string | null;
          shipment_provider: string | null;
          tracking_code: string | null;
          reason: string | null;
          raw_item_payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
      };
      order_activities: {
        Row: {
          id: string;
          order_id: string;
          daraz_order_id: string;
          previous_status: string | null;
          new_status: string;
          actor: string;
          source: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_activities']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['order_activities']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          actor_name: string;
          entity_type: string;
          entity_id: string;
          action: string;
          changes: Json;
          source: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      sync_retry_queue: {
        Row: {
          id: string;
          store_id: string | null;
          operation_type: string;
          entity_type: string;
          entity_id: string;
          attempt_count: number;
          last_attempt_at: string;
          next_retry_at: string | null;
          error_message: string;
          status: string;
          payload: Json;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sync_retry_queue']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['sync_retry_queue']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          priority: TaskPriority;
          status: TaskStatus;
          assigned_to: string;
          created_by: string;
          due_date: string | null;
          related_entity_type: string | null;
          related_entity_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      financial_records: {
        Row: {
          id: string;
          record_type: FinancialRecordType;
          amount_cents: number;
          reference_code: string | null;
          description: string | null;
          record_date: string;
          store_id: string | null;
          vendor_id: string | null;
          order_id: string | null;
          recorded_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['financial_records']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['financial_records']['Insert']>;
      };
      daraz_api_logs: {
        Row: {
          id: string;
          store_id: string;
          sync_type: string;
          status: SyncJobStatus;
          records_synced: number;
          error_message: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daraz_api_logs']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daraz_api_logs']['Insert']>;
      };
      daraz_packages: {
        Row: {
          id: string;
          order_id: string;
          daraz_order_id: string;
          package_id: string;
          tracking_number: string | null;
          shipment_provider: string | null;
          package_status: string;
          item_ids: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daraz_packages']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daraz_packages']['Insert']>;
      };
      shipping_labels: {
        Row: {
          id: string;
          order_id: string;
          daraz_order_id: string;
          package_id: string | null;
          doc_type: string;
          mime_type: string;
          file_content: string;
          is_official: boolean;
          retrieved_at: string;
          printed_count: number;
          last_printed_at: string | null;
          last_printed_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['shipping_labels']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['shipping_labels']['Insert']>;
      };
      daraz_shipments: {
        Row: {
          id: string;
          store_id: string;
          order_id: string;
          daraz_order_id: string;
          package_id: string | null;
          shipment_provider_id: string | null;
          shipment_provider_name: string | null;
          tracking_number: string | null;
          awb_number: string | null;
          status: string;
          raw_response: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daraz_shipments']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daraz_shipments']['Insert']>;
      };
      daraz_shipping_labels: {
        Row: {
          id: string;
          shipment_id: string | null;
          order_id: string;
          daraz_order_id: string;
          label_type: string;
          document_url: string | null;
          document_data: string | null;
          mime_type: string;
          status: string;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daraz_shipping_labels']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daraz_shipping_labels']['Insert']>;
      };
      daraz_products: {
        Row: {
          id: string;
          store_id: string;
          daraz_item_id: string;
          title: string;
          category: string;
          brand: string;
          status: string;
          description: string | null;
          images: Json;
          attributes: Json;
          product_url: string | null;
          skus_count: number;
          total_stock: number;
          is_synced: boolean;
          last_synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daraz_products']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daraz_products']['Insert']>;
      };
      daraz_product_skus: {
        Row: {
          id: string;
          store_id: string;
          product_id: string | null;
          daraz_item_id: string;
          daraz_sku_id: string | null;
          seller_sku: string;
          shop_sku: string | null;
          price_cents: number;
          special_price_cents: number | null;
          quantity: number;
          reserved_quantity: number;
          status: string;
          images: Json;
          package_content: string | null;
          is_synced: boolean;
          last_synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daraz_product_skus']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daraz_product_skus']['Insert']>;
      };
    };
    Views: {};
    Functions: {
      get_user_role: {
        Args: { target_user_id: string };
        Returns: AppRole;
      };
      is_super_admin: {
        Args: { target_user_id: string };
        Returns: boolean;
      };
    };
  };
}
