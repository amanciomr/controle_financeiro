export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean;
          closing_day: number | null;
          created_at: string;
          created_by: string | null;
          credit_limit: number | null;
          due_day: number | null;
          household_id: string;
          id: string;
          kind: Database["public"]["Enums"]["account_kind"];
          name: string;
          opening_balance: number;
          opening_date: string;
          owner_user_id: string | null;
          payment_account_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived?: boolean;
          closing_day?: number | null;
          created_at?: string;
          created_by?: string | null;
          credit_limit?: number | null;
          due_day?: number | null;
          household_id: string;
          id?: string;
          kind?: Database["public"]["Enums"]["account_kind"];
          name: string;
          opening_balance?: number;
          opening_date?: string;
          owner_user_id?: string | null;
          payment_account_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archived?: boolean;
          closing_day?: number | null;
          created_at?: string;
          created_by?: string | null;
          credit_limit?: number | null;
          due_day?: number | null;
          household_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["account_kind"];
          name?: string;
          opening_balance?: number;
          opening_date?: string;
          owner_user_id?: string | null;
          payment_account_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "accounts_household_id_owner_user_id_fkey";
            columns: ["household_id", "owner_user_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["household_id", "user_id"];
          },
          {
            foreignKeyName: "accounts_household_id_payment_account_id_fkey";
            columns: ["household_id", "payment_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["household_id", "id"];
          },
        ];
      };
      categories: {
        Row: {
          archived: boolean;
          color: string;
          created_at: string;
          created_by: string | null;
          household_id: string;
          icon: string;
          id: string;
          kind: Database["public"]["Enums"]["tx_type"];
          monthly_budget: number | null;
          name: string;
          nature: Database["public"]["Enums"]["category_nature"];
          parent_id: string | null;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived?: boolean;
          color?: string;
          created_at?: string;
          created_by?: string | null;
          household_id: string;
          icon?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["tx_type"];
          monthly_budget?: number | null;
          name: string;
          nature?: Database["public"]["Enums"]["category_nature"];
          parent_id?: string | null;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archived?: boolean;
          color?: string;
          created_at?: string;
          created_by?: string | null;
          household_id?: string;
          icon?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["tx_type"];
          monthly_budget?: number | null;
          name?: string;
          nature?: Database["public"]["Enums"]["category_nature"];
          parent_id?: string | null;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_household_id_parent_id_fkey";
            columns: ["household_id", "parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["household_id", "id"];
          },
        ];
      };
      household_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          display_name: string | null;
          email: string;
          expires_at: string;
          household_id: string;
          id: string;
          invited_by: string | null;
          token: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          display_name?: string | null;
          email: string;
          expires_at?: string;
          household_id: string;
          id?: string;
          invited_by?: string | null;
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          expires_at?: string;
          household_id?: string;
          id?: string;
          invited_by?: string | null;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      household_members: {
        Row: {
          display_name: string;
          household_id: string;
          joined_at: string;
          last_account_id: string | null;
          last_payment_method: Database["public"]["Enums"]["payment_method"] | null;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          display_name: string;
          household_id: string;
          joined_at?: string;
          last_account_id?: string | null;
          last_payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          role?: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Update: {
          display_name?: string;
          household_id?: string;
          joined_at?: string;
          last_account_id?: string | null;
          last_payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          savings_goal_mode: Database["public"]["Enums"]["savings_goal_mode"];
          savings_goal_value: number;
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          savings_goal_mode?: Database["public"]["Enums"]["savings_goal_mode"];
          savings_goal_value?: number;
          timezone?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          savings_goal_mode?: Database["public"]["Enums"]["savings_goal_mode"];
          savings_goal_value?: number;
          timezone?: string;
        };
        Relationships: [];
      };
      recurrences: {
        Row: {
          account_id: string | null;
          active: boolean;
          amount: number;
          category_id: string;
          created_at: string;
          created_by: string | null;
          day_of_month: number | null;
          description: string;
          end_date: string | null;
          frequency: Database["public"]["Enums"]["recurrence_frequency"];
          generate_from: string;
          household_id: string;
          id: string;
          is_estimate: boolean;
          month_of_year: number | null;
          notes: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          person_user_id: string | null;
          start_date: string;
          total_installments: number | null;
          type: Database["public"]["Enums"]["tx_type"];
          updated_at: string;
          updated_by: string | null;
          weekday: number | null;
        };
        ComputedFields: never;
        Insert: {
          account_id?: string | null;
          active?: boolean;
          amount: number;
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          day_of_month?: number | null;
          description: string;
          end_date?: string | null;
          frequency?: Database["public"]["Enums"]["recurrence_frequency"];
          generate_from?: string;
          household_id: string;
          id?: string;
          is_estimate?: boolean;
          month_of_year?: number | null;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          person_user_id?: string | null;
          start_date: string;
          total_installments?: number | null;
          type: Database["public"]["Enums"]["tx_type"];
          updated_at?: string;
          updated_by?: string | null;
          weekday?: number | null;
        };
        Update: {
          account_id?: string | null;
          active?: boolean;
          amount?: number;
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          day_of_month?: number | null;
          description?: string;
          end_date?: string | null;
          frequency?: Database["public"]["Enums"]["recurrence_frequency"];
          generate_from?: string;
          household_id?: string;
          id?: string;
          is_estimate?: boolean;
          month_of_year?: number | null;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          person_user_id?: string | null;
          start_date?: string;
          total_installments?: number | null;
          type?: Database["public"]["Enums"]["tx_type"];
          updated_at?: string;
          updated_by?: string | null;
          weekday?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "recurrences_household_id_account_id_fkey";
            columns: ["household_id", "account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["household_id", "id"];
          },
          {
            foreignKeyName: "recurrences_household_id_category_id_fkey";
            columns: ["household_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["household_id", "id"];
          },
          {
            foreignKeyName: "recurrences_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurrences_household_id_person_user_id_fkey";
            columns: ["household_id", "person_user_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["household_id", "user_id"];
          },
        ];
      };
      transactions: {
        Row: {
          account_id: string | null;
          amount: number;
          cash_date: string;
          category_id: string;
          created_at: string;
          created_by: string | null;
          date: string;
          description: string;
          household_id: string;
          id: string;
          import_batch_id: string | null;
          installment_number: number | null;
          installment_total: number | null;
          notes: string | null;
          occurrence_date: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          person_user_id: string | null;
          purchase_id: string | null;
          recurrence_id: string | null;
          status: Database["public"]["Enums"]["tx_status"];
          type: Database["public"]["Enums"]["tx_type"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_id?: string | null;
          amount: number;
          cash_date: string;
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          date: string;
          description: string;
          household_id: string;
          id?: string;
          import_batch_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          notes?: string | null;
          occurrence_date?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          person_user_id?: string | null;
          purchase_id?: string | null;
          recurrence_id?: string | null;
          status?: Database["public"]["Enums"]["tx_status"];
          type: Database["public"]["Enums"]["tx_type"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          account_id?: string | null;
          amount?: number;
          cash_date?: string;
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          description?: string;
          household_id?: string;
          id?: string;
          import_batch_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          notes?: string | null;
          occurrence_date?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          person_user_id?: string | null;
          purchase_id?: string | null;
          recurrence_id?: string | null;
          status?: Database["public"]["Enums"]["tx_status"];
          type?: Database["public"]["Enums"]["tx_type"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_household_id_account_id_fkey";
            columns: ["household_id", "account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["household_id", "id"];
          },
          {
            foreignKeyName: "transactions_household_id_category_id_fkey";
            columns: ["household_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["household_id", "id"];
          },
          {
            foreignKeyName: "transactions_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_household_id_person_user_id_fkey";
            columns: ["household_id", "person_user_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["household_id", "user_id"];
          },
          {
            foreignKeyName: "transactions_household_id_recurrence_id_fkey";
            columns: ["household_id", "recurrence_id"];
            isOneToOne: false;
            referencedRelation: "recurrences";
            referencedColumns: ["household_id", "id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: { Args: { p_display_name: string; p_token: string }; Returns: string };
      bootstrap_household: {
        Args: { p_display_name: string; p_name: string; p_user: string };
        Returns: string;
      };
      create_default_categories: { Args: { hid: string }; Returns: undefined };
      create_household: { Args: { p_display_name: string; p_name: string }; Returns: string };
      is_household_member: { Args: { hid: string }; Returns: boolean };
      my_household_ids: { Args: Record<PropertyKey, never>; Returns: string[] };
      my_pending_invites: {
        Args: Record<PropertyKey, never>;
        Returns: {
          display_name: string;
          household_id: string;
          household_name: string;
          invited_by_name: string;
          token: string;
        }[];
      };
    };
    Enums: {
      account_kind: "checking" | "savings" | "cash" | "credit_card";
      category_nature: "fixed" | "variable";
      member_role: "owner" | "member";
      payment_method:
        "credit_card" | "pix" | "debit" | "cash" | "boleto" | "transfer" | "auto_debit";
      recurrence_frequency: "monthly" | "yearly" | "weekly";
      savings_goal_mode: "amount" | "percent";
      tx_status: "planned" | "done" | "skipped";
      tx_type: "income" | "expense";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_kind: ["checking", "savings", "cash", "credit_card"],
      category_nature: ["fixed", "variable"],
      member_role: ["owner", "member"],
      payment_method: ["credit_card", "pix", "debit", "cash", "boleto", "transfer", "auto_debit"],
      recurrence_frequency: ["monthly", "yearly", "weekly"],
      savings_goal_mode: ["amount", "percent"],
      tx_status: ["planned", "done", "skipped"],
      tx_type: ["income", "expense"],
    },
  },
} as const;
