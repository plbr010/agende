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
