// Generated from repository migrations in local PostgreSQL. Run: node scripts/generate-database-types.mjs
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          professional_member_id: string;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          price_cents: number;
          duration_minutes: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          customer_note: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          professional_member_id: string;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          price_cents: number;
          duration_minutes: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          customer_note?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          professional_member_id?: string;
          service_id?: string;
          starts_at?: string;
          ends_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          price_cents?: number;
          duration_minutes?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          customer_note?: string | null;
        };
        Relationships: [
          { foreignKeyName: "appointments_client_fk"; columns: ["client_id","workspace_id"]; isOneToOne: false; referencedRelation: "workspace_clients"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "appointments_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "appointments_professional_fk"; columns: ["professional_member_id","workspace_id"]; isOneToOne: false; referencedRelation: "professional_profiles"; referencedColumns: ["member_id","workspace_id"] },
          { foreignKeyName: "appointments_service_fk"; columns: ["service_id","workspace_id"]; isOneToOne: false; referencedRelation: "services"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "appointments_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      audit_events: {
        Row: {
          id: string;
          workspace_id: string;
          actor_user_id: string | null;
          actor_kind: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          actor_user_id?: string | null;
          actor_kind: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          actor_user_id?: string | null;
          actor_kind?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "audit_events_actor_user_id_fkey"; columns: ["actor_user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "audit_events_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      billing_events: {
        Row: {
          id: string;
          workspace_id: string;
          provider: string;
          external_event_id: string;
          event_type: string;
          amount_cents: number | null;
          currency: string;
          billing_interval: Database["public"]["Enums"]["billing_interval"] | null;
          event_status: string | null;
          occurred_at: string;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          provider: string;
          external_event_id: string;
          event_type: string;
          amount_cents?: number | null;
          currency?: string;
          billing_interval?: Database["public"]["Enums"]["billing_interval"] | null;
          event_status?: string | null;
          occurred_at: string;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          provider?: string;
          external_event_id?: string;
          event_type?: string;
          amount_cents?: number | null;
          currency?: string;
          billing_interval?: Database["public"]["Enums"]["billing_interval"] | null;
          event_status?: string | null;
          occurred_at?: string;
          processed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "billing_events_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      client_package_items: {
        Row: {
          id: string;
          workspace_id: string;
          client_package_id: string;
          service_id: string;
          included_quantity: number;
          used_quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_package_id: string;
          service_id: string;
          included_quantity: number;
          used_quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_package_id?: string;
          service_id?: string;
          included_quantity?: number;
          used_quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "client_package_items_package_fk"; columns: ["client_package_id","workspace_id"]; isOneToOne: false; referencedRelation: "client_packages"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "client_package_items_service_fk"; columns: ["service_id","workspace_id"]; isOneToOne: false; referencedRelation: "services"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "client_package_items_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      client_packages: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          package_id: string;
          package_name_snapshot: string;
          price_cents: number;
          purchased_at: string;
          expires_at: string | null;
          status: Database["public"]["Enums"]["client_package_status"];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          package_id: string;
          package_name_snapshot: string;
          price_cents: number;
          purchased_at?: string;
          expires_at?: string | null;
          status?: Database["public"]["Enums"]["client_package_status"];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          package_id?: string;
          package_name_snapshot?: string;
          price_cents?: number;
          purchased_at?: string;
          expires_at?: string | null;
          status?: Database["public"]["Enums"]["client_package_status"];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "client_packages_client_fk"; columns: ["client_id","workspace_id"]; isOneToOne: false; referencedRelation: "workspace_clients"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "client_packages_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "client_packages_package_fk"; columns: ["package_id","workspace_id"]; isOneToOne: false; referencedRelation: "service_packages"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "client_packages_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      client_profiles: {
        Row: {
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "client_profiles_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
        ];
      };
      financial_categories: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          entry_type: Database["public"]["Enums"]["financial_entry_type"];
          system_key: string | null;
          active: boolean;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          entry_type: Database["public"]["Enums"]["financial_entry_type"];
          system_key?: string | null;
          active?: boolean;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          entry_type?: Database["public"]["Enums"]["financial_entry_type"];
          system_key?: string | null;
          active?: boolean;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "financial_categories_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "financial_categories_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      financial_entries: {
        Row: {
          id: string;
          workspace_id: string;
          entry_type: Database["public"]["Enums"]["financial_entry_type"];
          status: Database["public"]["Enums"]["financial_entry_status"];
          source: Database["public"]["Enums"]["financial_entry_source"];
          description: string;
          amount_cents: number;
          due_date: string | null;
          paid_at: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          appointment_id: string | null;
          client_package_id: string | null;
          client_id: string | null;
          created_by: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
          category_id: string | null;
          idempotency_key: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          entry_type: Database["public"]["Enums"]["financial_entry_type"];
          status?: Database["public"]["Enums"]["financial_entry_status"];
          source?: Database["public"]["Enums"]["financial_entry_source"];
          description: string;
          amount_cents: number;
          due_date?: string | null;
          paid_at?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          appointment_id?: string | null;
          client_package_id?: string | null;
          client_id?: string | null;
          created_by?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
          category_id?: string | null;
          idempotency_key?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          entry_type?: Database["public"]["Enums"]["financial_entry_type"];
          status?: Database["public"]["Enums"]["financial_entry_status"];
          source?: Database["public"]["Enums"]["financial_entry_source"];
          description?: string;
          amount_cents?: number;
          due_date?: string | null;
          paid_at?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          appointment_id?: string | null;
          client_package_id?: string | null;
          client_id?: string | null;
          created_by?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
          category_id?: string | null;
          idempotency_key?: string | null;
        };
        Relationships: [
          { foreignKeyName: "financial_entries_appointment_fk"; columns: ["appointment_id","workspace_id"]; isOneToOne: false; referencedRelation: "appointments"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "financial_entries_category_fk"; columns: ["category_id","workspace_id"]; isOneToOne: false; referencedRelation: "financial_categories"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "financial_entries_client_fk"; columns: ["client_id","workspace_id"]; isOneToOne: false; referencedRelation: "workspace_clients"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "financial_entries_client_package_fk"; columns: ["client_package_id","workspace_id"]; isOneToOne: false; referencedRelation: "client_packages"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "financial_entries_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "financial_entries_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      financial_refunds: {
        Row: {
          id: string;
          workspace_id: string;
          financial_entry_id: string;
          amount_cents: number;
          reason: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          refunded_at: string;
          created_by: string | null;
          created_at: string;
          idempotency_key: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          financial_entry_id: string;
          amount_cents: number;
          reason: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          refunded_at?: string;
          created_by?: string | null;
          created_at?: string;
          idempotency_key?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          financial_entry_id?: string;
          amount_cents?: number;
          reason?: string;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          refunded_at?: string;
          created_by?: string | null;
          created_at?: string;
          idempotency_key?: string | null;
        };
        Relationships: [
          { foreignKeyName: "financial_refunds_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "financial_refunds_entry_fk"; columns: ["financial_entry_id","workspace_id"]; isOneToOne: false; referencedRelation: "financial_entries"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "financial_refunds_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      inventory_movements: {
        Row: {
          id: string;
          workspace_id: string;
          product_id: string;
          type: Database["public"]["Enums"]["inventory_movement_type"];
          quantity: number;
          quantity_before: number;
          quantity_after: number;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          product_id: string;
          type: Database["public"]["Enums"]["inventory_movement_type"];
          quantity: number;
          quantity_before: number;
          quantity_after: number;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          product_id?: string;
          type?: Database["public"]["Enums"]["inventory_movement_type"];
          quantity?: number;
          quantity_before?: number;
          quantity_after?: number;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "inventory_movements_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "inventory_movements_product_workspace_fk"; columns: ["product_id","workspace_id"]; isOneToOne: false; referencedRelation: "inventory_products"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "inventory_movements_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      inventory_products: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          sku: string | null;
          unit: Database["public"]["Enums"]["inventory_unit"];
          quantity: number;
          minimum_quantity: number;
          cost_cents: number | null;
          active: boolean;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string | null;
          sku?: string | null;
          unit?: Database["public"]["Enums"]["inventory_unit"];
          quantity?: number;
          minimum_quantity?: number;
          cost_cents?: number | null;
          active?: boolean;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          description?: string | null;
          sku?: string | null;
          unit?: Database["public"]["Enums"]["inventory_unit"];
          quantity?: number;
          minimum_quantity?: number;
          cost_cents?: number | null;
          active?: boolean;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "inventory_products_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "inventory_products_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      package_redemptions: {
        Row: {
          id: string;
          workspace_id: string;
          client_package_id: string;
          client_package_item_id: string;
          appointment_id: string;
          quantity: number;
          created_by: string | null;
          created_at: string;
          reversed_at: string | null;
          reversed_by: string | null;
          reversal_reason: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_package_id: string;
          client_package_item_id: string;
          appointment_id: string;
          quantity?: number;
          created_by?: string | null;
          created_at?: string;
          reversed_at?: string | null;
          reversed_by?: string | null;
          reversal_reason?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_package_id?: string;
          client_package_item_id?: string;
          appointment_id?: string;
          quantity?: number;
          created_by?: string | null;
          created_at?: string;
          reversed_at?: string | null;
          reversed_by?: string | null;
          reversal_reason?: string | null;
        };
        Relationships: [
          { foreignKeyName: "package_redemptions_appointment_fk"; columns: ["appointment_id","workspace_id"]; isOneToOne: false; referencedRelation: "appointments"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "package_redemptions_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "package_redemptions_item_fk"; columns: ["client_package_item_id","workspace_id"]; isOneToOne: false; referencedRelation: "client_package_items"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "package_redemptions_package_fk"; columns: ["client_package_id","workspace_id"]; isOneToOne: false; referencedRelation: "client_packages"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "package_redemptions_reversed_by_fkey"; columns: ["reversed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "package_redemptions_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      plans: {
        Row: {
          code: Database["public"]["Enums"]["subscription_plan"];
          name: string;
          monthly_price_cents: number;
          max_professionals: number;
          description: string | null;
          created_at: string;
          updated_at: string;
          annual_price_cents: number | null;
        };
        Insert: {
          code: Database["public"]["Enums"]["subscription_plan"];
          name: string;
          monthly_price_cents: number;
          max_professionals: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          annual_price_cents?: number | null;
        };
        Update: {
          code?: Database["public"]["Enums"]["subscription_plan"];
          name?: string;
          monthly_price_cents?: number;
          max_professionals?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          annual_price_cents?: number | null;
        };
        Relationships: [
        ];
      };
      privacy_requests: {
        Row: {
          id: string;
          user_id: string;
          request_type: Database["public"]["Enums"]["privacy_request_type"];
          status: Database["public"]["Enums"]["privacy_request_status"];
          reason: string | null;
          resolution_note: string | null;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          request_type: Database["public"]["Enums"]["privacy_request_type"];
          status?: Database["public"]["Enums"]["privacy_request_status"];
          reason?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          request_type?: Database["public"]["Enums"]["privacy_request_type"];
          status?: Database["public"]["Enums"]["privacy_request_status"];
          reason?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
        ];
      };
      professional_breaks: {
        Row: {
          id: string;
          workspace_id: string;
          professional_member_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          label: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          professional_member_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          label?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          professional_member_id?: string;
          weekday?: number;
          start_time?: string;
          end_time?: string;
          label?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "professional_breaks_professional_fk"; columns: ["professional_member_id","workspace_id"]; isOneToOne: false; referencedRelation: "professional_profiles"; referencedColumns: ["member_id","workspace_id"] },
          { foreignKeyName: "professional_breaks_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      professional_profiles: {
        Row: {
          member_id: string;
          workspace_id: string;
          display_name: string;
          bio: string | null;
          booking_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          member_id: string;
          workspace_id: string;
          display_name: string;
          bio?: string | null;
          booking_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          member_id?: string;
          workspace_id?: string;
          display_name?: string;
          bio?: string | null;
          booking_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "professional_profiles_member_workspace_fk"; columns: ["member_id","workspace_id"]; isOneToOne: true; referencedRelation: "workspace_members"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "professional_profiles_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      professional_services: {
        Row: {
          id: string;
          workspace_id: string;
          professional_member_id: string;
          service_id: string;
          price_override_cents: number | null;
          duration_override_minutes: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          professional_member_id: string;
          service_id: string;
          price_override_cents?: number | null;
          duration_override_minutes?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          professional_member_id?: string;
          service_id?: string;
          price_override_cents?: number | null;
          duration_override_minutes?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "professional_services_professional_fk"; columns: ["professional_member_id","workspace_id"]; isOneToOne: false; referencedRelation: "professional_profiles"; referencedColumns: ["member_id","workspace_id"] },
          { foreignKeyName: "professional_services_service_fk"; columns: ["service_id","workspace_id"]; isOneToOne: false; referencedRelation: "services"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "professional_services_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      professional_time_blocks: {
        Row: {
          id: string;
          workspace_id: string;
          professional_member_id: string;
          starts_at: string;
          ends_at: string;
          reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          professional_member_id: string;
          starts_at: string;
          ends_at: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          professional_member_id?: string;
          starts_at?: string;
          ends_at?: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "professional_time_blocks_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "professional_time_blocks_professional_fk"; columns: ["professional_member_id","workspace_id"]; isOneToOne: false; referencedRelation: "professional_profiles"; referencedColumns: ["member_id","workspace_id"] },
          { foreignKeyName: "professional_time_blocks_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      professional_trial_claims: {
        Row: {
          user_id: string;
          workspace_id: string;
          claimed_at: string;
        };
        Insert: {
          user_id: string;
          workspace_id: string;
          claimed_at?: string;
        };
        Update: {
          user_id?: string;
          workspace_id?: string;
          claimed_at?: string;
        };
        Relationships: [
          { foreignKeyName: "professional_trial_claims_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "professional_trial_claims_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      professional_working_hours: {
        Row: {
          id: string;
          workspace_id: string;
          professional_member_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          professional_member_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          professional_member_id?: string;
          weekday?: number;
          start_time?: string;
          end_time?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "professional_working_hours_professional_fk"; columns: ["professional_member_id","workspace_id"]; isOneToOne: false; referencedRelation: "professional_profiles"; referencedColumns: ["member_id","workspace_id"] },
          { foreignKeyName: "professional_working_hours_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: {
          user_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          intended_use: Database["public"]["Enums"]["signup_intent"];
          terms_accepted_at: string | null;
          privacy_accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          intended_use: Database["public"]["Enums"]["signup_intent"];
          terms_accepted_at?: string | null;
          privacy_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          intended_use?: Database["public"]["Enums"]["signup_intent"];
          terms_accepted_at?: string | null;
          privacy_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      public_booking_rate_events: {
        Row: {
          id: string;
          workspace_id: string;
          email: string | null;
          phone: string | null;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email?: string | null;
          phone?: string | null;
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          email?: string | null;
          phone?: string | null;
          ip_hash?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "public_booking_rate_events_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      service_package_items: {
        Row: {
          id: string;
          workspace_id: string;
          package_id: string;
          service_id: string;
          quantity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          package_id: string;
          service_id: string;
          quantity: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          package_id?: string;
          service_id?: string;
          quantity?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "service_package_items_package_fk"; columns: ["package_id","workspace_id"]; isOneToOne: false; referencedRelation: "service_packages"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "service_package_items_service_fk"; columns: ["service_id","workspace_id"]; isOneToOne: false; referencedRelation: "services"; referencedColumns: ["id","workspace_id"] },
          { foreignKeyName: "service_package_items_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      service_packages: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          price_cents: number;
          validity_days: number | null;
          active: boolean;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string | null;
          price_cents: number;
          validity_days?: number | null;
          active?: boolean;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          description?: string | null;
          price_cents?: number;
          validity_days?: number | null;
          active?: boolean;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "service_packages_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "service_packages_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      services: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          price_cents: number;
          active: boolean;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string | null;
          duration_minutes: number;
          price_cents: number;
          active?: boolean;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          description?: string | null;
          duration_minutes?: number;
          price_cents?: number;
          active?: boolean;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "services_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "services_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          workspace_id: string;
          plan: Database["public"]["Enums"]["subscription_plan"];
          status: Database["public"]["Enums"]["subscription_status"];
          trial_started_at: string | null;
          trial_ends_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          canceled_at: string | null;
          created_at: string;
          updated_at: string;
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          billing_provider: string | null;
          external_customer_id: string | null;
          external_subscription_id: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          plan: Database["public"]["Enums"]["subscription_plan"];
          status: Database["public"]["Enums"]["subscription_status"];
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          updated_at?: string;
          billing_interval?: Database["public"]["Enums"]["billing_interval"];
          billing_provider?: string | null;
          external_customer_id?: string | null;
          external_subscription_id?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          plan?: Database["public"]["Enums"]["subscription_plan"];
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          updated_at?: string;
          billing_interval?: Database["public"]["Enums"]["billing_interval"];
          billing_provider?: string | null;
          external_customer_id?: string | null;
          external_subscription_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: "subscriptions_plan_fkey"; columns: ["plan"]; isOneToOne: false; referencedRelation: "plans"; referencedColumns: ["code"] },
          { foreignKeyName: "subscriptions_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: true; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      workspace_clients: {
        Row: {
          id: string;
          workspace_id: string;
          linked_user_id: string | null;
          full_name: string;
          email: string | null;
          phone: string | null;
          birth_date: string | null;
          notes: string | null;
          created_by: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          linked_user_id?: string | null;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          birth_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          linked_user_id?: string | null;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          birth_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "workspace_clients_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "workspace_clients_linked_user_id_fkey"; columns: ["linked_user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "workspace_clients_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      workspace_invites: {
        Row: {
          id: string;
          workspace_id: string;
          email: string | null;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          revoked_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email?: string | null;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
          expires_at: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          email?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          token_hash?: string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "workspace_invites_accepted_by_fkey"; columns: ["accepted_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "workspace_invites_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "workspace_invites_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["member_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "workspace_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "workspace_members_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      workspace_settings: {
        Row: {
          workspace_id: string;
          business_phone: string | null;
          business_email: string | null;
          description: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          instagram: string | null;
          logo_path: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          business_phone?: string | null;
          business_email?: string | null;
          description?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          instagram?: string | null;
          logo_path?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          workspace_id?: string;
          business_phone?: string | null;
          business_email?: string | null;
          description?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          instagram?: string | null;
          logo_path?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "workspace_settings_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: true; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      workspaces: {
        Row: {
          id: string;
          owner_user_id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "workspaces_owner_user_id_fkey"; columns: ["owner_user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_workspace_invite: { Args: { p_token: string | null }; Returns: Json };
      apply_inventory_movement: { Args: { p_workspace_id: string | null; p_product_id: string | null; p_type: Database["public"]["Enums"]["inventory_movement_type"] | null; p_quantity?: number | null; p_new_quantity?: number | null; p_reason?: string | null }; Returns: Json };
      archive_financial_category: { Args: { p_workspace_id: string | null; p_category_id: string | null }; Returns: string };
      archive_inventory_product: { Args: { p_workspace_id: string | null; p_product_id: string | null }; Returns: Json };
      archive_service_package: { Args: { p_workspace_id: string | null; p_package_id: string | null }; Returns: string };
      bind_billing_customer: { Args: { p_workspace_id: string | null; p_provider: string | null; p_external_customer_id: string | null }; Returns: undefined };
      bind_stripe_checkout: { Args: { p_workspace_id: string | null; p_payer_email: string | null; p_external_customer_id: string | null; p_external_subscription_id: string | null; p_plan: Database["public"]["Enums"]["subscription_plan"] | null; p_billing_interval: Database["public"]["Enums"]["billing_interval"] | null; p_external_event_id: string | null; p_event_type: string | null; p_event_status?: string | null; p_occurred_at?: string | null }; Returns: undefined };
      cancel_client_package: { Args: { p_workspace_id: string | null; p_client_package_id: string | null }; Returns: string };
      cancel_financial_entry: { Args: { p_workspace_id: string | null; p_entry_id: string | null }; Returns: string };
      cancel_my_appointment: { Args: { p_appointment_id: string | null }; Returns: Json };
      cancel_my_privacy_request: { Args: { p_request_id: string | null }; Returns: string };
      change_trial_plan: { Args: { p_workspace_id: string | null; p_plan: string | null }; Returns: Json };
      create_appointment: { Args: { p_workspace_id: string | null; p_client_id: string | null; p_professional_member_id: string | null; p_service_id: string | null; p_starts_at: string | null; p_notes?: string | null }; Returns: string };
      create_client_profile: { Args: Record<PropertyKey, never>; Returns: string };
      create_financial_category: { Args: { p_workspace_id: string | null; p_name: string | null; p_entry_type: Database["public"]["Enums"]["financial_entry_type"] | null }; Returns: string };
      create_financial_entry: { Args: { p_workspace_id: string | null; p_entry_type: Database["public"]["Enums"]["financial_entry_type"] | null; p_description: string | null; p_amount_cents: number | null; p_due_date?: string | null; p_category_id?: string | null; p_idempotency_key?: string | null }; Returns: string };
      create_inventory_product: { Args: { p_workspace_id: string | null; p_name: string | null; p_description?: string | null; p_sku?: string | null; p_unit?: Database["public"]["Enums"]["inventory_unit"] | null; p_initial_quantity?: number | null; p_minimum_quantity?: number | null; p_cost_cents?: number | null }; Returns: Json };
      create_privacy_request: { Args: { p_request_type: Database["public"]["Enums"]["privacy_request_type"] | null; p_reason?: string | null }; Returns: string };
      create_public_appointment: { Args: { p_slug: string | null; p_service_id: string | null; p_professional_member_id: string | null; p_starts_at: string | null; p_full_name: string | null; p_phone: string | null; p_email: string | null; p_customer_note?: string | null; p_ip_hash?: string | null }; Returns: Json };
      create_service_package: { Args: { p_workspace_id: string | null; p_name: string | null; p_description: string | null; p_price_cents: number | null; p_validity_days: number | null; p_items: Json | null }; Returns: string };
      create_workspace: { Args: { p_name: string | null; p_slug?: string | null; p_plan?: string | null }; Returns: Json };
      create_workspace_invite: { Args: { p_workspace_id: string | null; p_role: Database["public"]["Enums"]["member_role"] | null; p_email?: string | null }; Returns: Json };
      deactivate_workspace_member: { Args: { p_workspace_id: string | null; p_member_id: string | null }; Returns: Json };
      export_my_personal_data: { Args: Record<PropertyKey, never>; Returns: Json };
      get_finance_ui: { Args: { p_workspace_id: string | null; p_start_date: string | null; p_end_date: string | null }; Returns: Json };
      get_inventory_ui: { Args: { p_workspace_id: string | null }; Returns: Json };
      get_packages_ui: { Args: { p_workspace_id: string | null }; Returns: Json };
      get_public_workspace_profile: { Args: { p_slug: string | null }; Returns: Json };
      get_stripe_api_key: { Args: Record<PropertyKey, never>; Returns: string };
      get_stripe_webhook_secret: { Args: Record<PropertyKey, never>; Returns: string };
      get_workspace_advanced_report: { Args: { p_workspace_id: string | null; p_start_date: string | null; p_end_date: string | null }; Returns: Json };
      get_workspace_report: { Args: { p_workspace_id: string | null; p_start_date: string | null; p_end_date: string | null }; Returns: Json };
      get_workspace_seat_usage: { Args: { p_workspace_id: string | null }; Returns: Json };
      list_available_slots: { Args: { p_workspace_id: string | null; p_professional_member_id: string | null; p_service_id: string | null; p_local_date: string | null }; Returns: { starts_at: string }[] };
      list_my_appointments: { Args: Record<PropertyKey, never>; Returns: Json };
      list_my_packages: { Args: Record<PropertyKey, never>; Returns: Json };
      list_public_available_slots: { Args: { p_slug: string | null; p_service_id: string | null; p_professional_member_id: string | null; p_local_date: string | null }; Returns: { starts_at: string }[] };
      list_public_booking_catalog: { Args: { p_slug: string | null }; Returns: Json };
      mark_financial_entry_paid: { Args: { p_workspace_id: string | null; p_entry_id: string | null; p_payment_method: Database["public"]["Enums"]["payment_method"] | null; p_paid_at?: string | null }; Returns: string };
      peek_workspace_invite: { Args: { p_token: string | null }; Returns: Json };
      reactivate_inventory_product: { Args: { p_workspace_id: string | null; p_product_id: string | null }; Returns: Json };
      reactivate_service_package: { Args: { p_workspace_id: string | null; p_package_id: string | null }; Returns: string };
      reactivate_workspace_member: { Args: { p_workspace_id: string | null; p_member_id: string | null }; Returns: Json };
      record_billing_event: { Args: { p_workspace_id: string | null; p_provider: string | null; p_external_event_id: string | null; p_event_type: string | null; p_amount_cents?: number | null; p_currency?: string | null; p_billing_interval?: Database["public"]["Enums"]["billing_interval"] | null; p_event_status?: string | null; p_occurred_at?: string | null }; Returns: string };
      redeem_client_package: { Args: { p_workspace_id: string | null; p_client_package_id: string | null; p_appointment_id: string | null }; Returns: Json };
      refund_financial_entry: { Args: { p_workspace_id: string | null; p_entry_id: string | null; p_amount_cents: number | null; p_reason: string | null; p_payment_method: Database["public"]["Enums"]["payment_method"] | null; p_refunded_at?: string | null; p_idempotency_key?: string | null }; Returns: string };
      remove_workspace_member: { Args: { p_workspace_id: string | null; p_member_id: string | null }; Returns: Json };
      reopen_financial_entry: { Args: { p_workspace_id: string | null; p_entry_id: string | null }; Returns: string };
      reschedule_appointment: { Args: { p_appointment_id: string | null; p_professional_member_id: string | null; p_service_id: string | null; p_starts_at: string | null; p_notes?: string | null }; Returns: string };
      reschedule_my_appointment: { Args: { p_appointment_id: string | null; p_starts_at: string | null; p_professional_member_id?: string | null }; Returns: Json };
      reverse_package_redemption: { Args: { p_workspace_id: string | null; p_redemption_id: string | null; p_reason: string | null }; Returns: Json };
      revoke_workspace_invite: { Args: { p_workspace_id: string | null; p_invite_id: string | null }; Returns: Json };
      sell_service_package: { Args: { p_workspace_id: string | null; p_client_id: string | null; p_package_id: string | null }; Returns: string };
      set_appointment_status: { Args: { p_appointment_id: string | null; p_status: Database["public"]["Enums"]["appointment_status"] | null }; Returns: string };
      sync_billing_subscription: { Args: { p_workspace_id: string | null; p_provider: string | null; p_external_customer_id: string | null; p_external_subscription_id: string | null; p_plan: Database["public"]["Enums"]["subscription_plan"] | null; p_billing_interval: Database["public"]["Enums"]["billing_interval"] | null; p_status: Database["public"]["Enums"]["subscription_status"] | null; p_current_period_start?: string | null; p_current_period_end?: string | null; p_canceled_at?: string | null }; Returns: undefined };
      update_financial_category: { Args: { p_workspace_id: string | null; p_category_id: string | null; p_name: string | null }; Returns: string };
      update_financial_entry: { Args: { p_workspace_id: string | null; p_entry_id: string | null; p_description: string | null; p_amount_cents: number | null; p_due_date: string | null }; Returns: string };
      update_inventory_product: { Args: { p_workspace_id: string | null; p_product_id: string | null; p_name: string | null; p_description?: string | null; p_sku?: string | null; p_unit?: Database["public"]["Enums"]["inventory_unit"] | null; p_minimum_quantity?: number | null; p_cost_cents?: number | null; p_active?: boolean | null }; Returns: Json };
      update_service_package: { Args: { p_workspace_id: string | null; p_package_id: string | null; p_name: string | null; p_description: string | null; p_price_cents: number | null; p_validity_days: number | null; p_active: boolean | null; p_items: Json | null }; Returns: string };
      update_workspace_member_role: { Args: { p_workspace_id: string | null; p_member_id: string | null; p_role: Database["public"]["Enums"]["member_role"] | null }; Returns: Json };
      update_workspace_settings: { Args: { p_workspace_id: string | null; p_name: string | null; p_slug: string | null; p_business_phone?: string | null; p_business_email?: string | null; p_description?: string | null; p_address?: string | null; p_city?: string | null; p_state?: string | null; p_postal_code?: string | null; p_instagram?: string | null; p_timezone?: string | null; p_logo_path?: string | null; p_clear_logo?: boolean | null }; Returns: Json };
    };
    Enums: {
      appointment_status: "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
      billing_interval: "monthly" | "annual";
      client_package_status: "active" | "exhausted" | "cancelled" | "expired";
      financial_entry_source: "manual" | "appointment" | "package_sale";
      financial_entry_status: "pending" | "paid" | "cancelled";
      financial_entry_type: "income" | "expense";
      inventory_movement_type: "entry" | "exit" | "adjustment";
      inventory_unit: "unidade" | "ml" | "g";
      member_role: "owner" | "admin" | "professional" | "receptionist";
      member_status: "invited" | "active" | "inactive" | "removed";
      payment_method: "cash" | "pix" | "debit_card" | "credit_card" | "bank_transfer" | "other";
      privacy_request_status: "pending" | "processing" | "completed" | "rejected" | "cancelled";
      privacy_request_type: "export" | "deletion" | "correction";
      signup_intent: "client" | "professional";
      subscription_plan: "solo" | "equipe" | "salao";
      subscription_status: "trialing" | "active" | "past_due" | "expired" | "canceled";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
