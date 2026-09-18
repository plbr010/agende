export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      client_profiles: {
        Row: {
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          code: Database["public"]["Enums"]["subscription_plan"];
          created_at: string;
          description: string | null;
          max_professionals: number;
          monthly_price_cents: number;
          name: string;
          updated_at: string;
        };
        Insert: {
          code: Database["public"]["Enums"]["subscription_plan"];
          created_at?: string;
          description?: string | null;
          max_professionals: number;
          monthly_price_cents: number;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: Database["public"]["Enums"]["subscription_plan"];
          created_at?: string;
          description?: string | null;
          max_professionals?: number;
          monthly_price_cents?: number;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      professional_profiles: {
        Row: {
          bio: string | null;
          booking_enabled: boolean;
          created_at: string;
          display_name: string;
          member_id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          bio?: string | null;
          booking_enabled?: boolean;
          created_at?: string;
          display_name: string;
          member_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          bio?: string | null;
          booking_enabled?: boolean;
          created_at?: string;
          display_name?: string;
          member_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      professional_services: {
        Row: {
          active: boolean;
          created_at: string;
          duration_override_minutes: number | null;
          id: string;
          price_override_cents: number | null;
          professional_member_id: string;
          service_id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          duration_override_minutes?: number | null;
          id?: string;
          price_override_cents?: number | null;
          professional_member_id: string;
          service_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          duration_override_minutes?: number | null;
          id?: string;
          price_override_cents?: number | null;
          professional_member_id?: string;
          service_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      professional_trial_claims: {
        Row: {
          claimed_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          claimed_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          claimed_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          intended_use: Database["public"]["Enums"]["signup_intent"];
          phone: string | null;
          privacy_accepted_at: string | null;
          terms_accepted_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          intended_use: Database["public"]["Enums"]["signup_intent"];
          phone?: string | null;
          privacy_accepted_at?: string | null;
          terms_accepted_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          intended_use?: Database["public"]["Enums"]["signup_intent"];
          phone?: string | null;
          privacy_accepted_at?: string | null;
          terms_accepted_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          active: boolean;
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          duration_minutes: number;
          id: string;
          name: string;
          price_cents: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          duration_minutes: number;
          id?: string;
          name: string;
          price_cents: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          name?: string;
          price_cents?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          plan: Database["public"]["Enums"]["subscription_plan"];
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at: string | null;
          trial_started_at: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan: Database["public"]["Enums"]["subscription_plan"];
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          trial_started_at?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan?: Database["public"]["Enums"]["subscription_plan"];
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          trial_started_at?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      workspace_clients: {
        Row: {
          archived_at: string | null;
          birth_date: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          full_name: string;
          id: string;
          linked_user_id: string | null;
          notes: string | null;
          phone: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          birth_date?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          linked_user_id?: string | null;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          birth_date?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          linked_user_id?: string | null;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      workspace_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          created_by: string;
          email: string | null;
          expires_at: string;
          id: string;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by: string;
          email?: string | null;
          expires_at: string;
          id?: string;
          revoked_at?: string | null;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          token_hash?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["member_status"];
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_settings: {
        Row: {
          address: string | null;
          business_email: string | null;
          business_phone: string | null;
          city: string | null;
          created_at: string;
          description: string | null;
          instagram: string | null;
          logo_path: string | null;
          postal_code: string | null;
          state: string | null;
          timezone: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          address?: string | null;
          business_email?: string | null;
          business_phone?: string | null;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          instagram?: string | null;
          logo_path?: string | null;
          postal_code?: string | null;
          state?: string | null;
          timezone?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          address?: string | null;
          business_email?: string | null;
          business_phone?: string | null;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          instagram?: string | null;
          logo_path?: string | null;
          postal_code?: string | null;
          state?: string | null;
          timezone?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_user_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_user_id: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_user_id?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_workspace_invite: { Args: { p_token: string }; Returns: Json };
      create_client_profile: { Args: Record<PropertyKey, never>; Returns: string };
      create_workspace: {
        Args: { p_name: string; p_slug?: string };
        Returns: Json;
      };
      create_workspace_invite: {
        Args: {
          p_email?: string;
          p_role: Database["public"]["Enums"]["member_role"];
          p_workspace_id: string;
        };
        Returns: Json;
      };
      deactivate_workspace_member: {
        Args: { p_member_id: string; p_workspace_id: string };
        Returns: Json;
      };
      get_public_workspace_profile: { Args: { p_slug: string }; Returns: Json };
      get_workspace_seat_usage: {
        Args: { p_workspace_id: string };
        Returns: Json;
      };
      peek_workspace_invite: { Args: { p_token: string }; Returns: Json };
      reactivate_workspace_member: {
        Args: { p_member_id: string; p_workspace_id: string };
        Returns: Json;
      };
      remove_workspace_member: {
        Args: { p_member_id: string; p_workspace_id: string };
        Returns: Json;
      };
      revoke_workspace_invite: {
        Args: { p_invite_id: string; p_workspace_id: string };
        Returns: Json;
      };
      update_workspace_member_role: {
        Args: {
          p_member_id: string;
          p_role: Database["public"]["Enums"]["member_role"];
          p_workspace_id: string;
        };
        Returns: Json;
      };
      update_workspace_settings: {
        Args: {
          p_address?: string | null;
          p_business_email?: string | null;
          p_business_phone?: string | null;
          p_city?: string | null;
          p_clear_logo?: boolean;
          p_description?: string | null;
          p_instagram?: string | null;
          p_logo_path?: string | null;
          p_name: string;
          p_postal_code?: string | null;
          p_slug: string;
          p_state?: string | null;
          p_timezone?: string | null;
          p_workspace_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      member_role: "owner" | "admin" | "professional" | "receptionist";
      member_status: "invited" | "active" | "inactive" | "removed";
      signup_intent: "client" | "professional";
      subscription_plan: "solo" | "equipe" | "salao";
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "expired"
        | "canceled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
