export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          published_at: string
          published_by: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          published_at?: string
          published_by?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          published_at?: string
          published_by?: string | null
          title?: string
        }
        Relationships: []
      }
      credit_notes: {
        Row: {
          amount: number
          created_at: string
          credit_note_number: string
          id: string
          invoice_id: string | null
          issued_at: string
          issued_by: string | null
          reason: string
          unit_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credit_note_number: string
          id?: string
          invoice_id?: string | null
          issued_at?: string
          issued_by?: string | null
          reason: string
          unit_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_note_number?: string
          id?: string
          invoice_id?: string | null
          issued_at?: string
          issued_by?: string | null
          reason?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_url: string
          id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          is_paid: boolean
          notes: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          description: string | null
          due_date: string
          id: string
          invoice_number: string
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          invoice_number: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          assigned_vendor: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          photo_urls: string[]
          priority: Database["public"]["Enums"]["maintenance_priority"]
          status: Database["public"]["Enums"]["maintenance_status"]
          submitted_by: string | null
          title: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          assigned_vendor?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          photo_urls?: string[]
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          status?: Database["public"]["Enums"]["maintenance_status"]
          submitted_by?: string | null
          title: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          assigned_vendor?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          photo_urls?: string[]
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          status?: Database["public"]["Enums"]["maintenance_status"]
          submitted_by?: string | null
          title?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          gateway_provider: string
          gateway_reference: string | null
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string
          paid_by_user_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_number: string
        }
        Insert: {
          amount: number
          created_at?: string
          gateway_provider?: string
          gateway_reference?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          paid_at?: string
          paid_by_user_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_number: string
        }
        Update: {
          amount?: number
          created_at?: string
          gateway_provider?: string
          gateway_reference?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          paid_at?: string
          paid_by_user_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      residents: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          move_in_date: string | null
          move_out_date: string | null
          phone: string | null
          resident_type: Database["public"]["Enums"]["resident_type"]
          unit_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          move_in_date?: string | null
          move_out_date?: string | null
          phone?: string | null
          resident_type?: Database["public"]["Enums"]["resident_type"]
          unit_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          move_in_date?: string | null
          move_out_date?: string | null
          phone?: string | null
          resident_type?: Database["public"]["Enums"]["resident_type"]
          unit_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          area_sqm: number | null
          bedrooms: number | null
          building: string
          created_at: string
          floor: number | null
          handover_date: string | null
          id: string
          is_occupied: boolean
          monthly_service_charge: number
          notes: string | null
          unit_number: string
          updated_at: string
        }
        Insert: {
          area_sqm?: number | null
          bedrooms?: number | null
          building: string
          created_at?: string
          floor?: number | null
          handover_date?: string | null
          id?: string
          is_occupied?: boolean
          monthly_service_charge?: number
          notes?: string | null
          unit_number: string
          updated_at?: string
        }
        Update: {
          area_sqm?: number | null
          bedrooms?: number | null
          building?: string
          created_at?: string
          floor?: number | null
          handover_date?: string | null
          id?: string
          is_occupied?: boolean
          monthly_service_charge?: number
          notes?: string | null
          unit_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string
          expected_at: string
          id: string
          purpose: string | null
          qr_code: string
          requested_by: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          unit_id: string
          updated_at: string
          visitor_name: string
          visitor_phone: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          expected_at: string
          id?: string
          purpose?: string | null
          qr_code?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          unit_id: string
          updated_at?: string
          visitor_name: string
          visitor_phone?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          expected_at?: string
          id?: string
          purpose?: string | null
          qr_code?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          unit_id?: string
          updated_at?: string
          visitor_name?: string
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "resident"
      expense_category:
        | "admin"
        | "security"
        | "utility"
        | "fm"
        | "maintenance"
        | "other"
      invoice_status: "unpaid" | "paid" | "partial" | "cancelled" | "overdue"
      maintenance_priority: "low" | "normal" | "high" | "urgent"
      maintenance_status: "pending" | "in_progress" | "completed" | "cancelled"
      payment_method: "card" | "bank_transfer" | "cash" | "cheque" | "mock"
      resident_type: "owner" | "tenant"
      visitor_status:
        | "pending"
        | "approved"
        | "rejected"
        | "checked_in"
        | "checked_out"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "resident"],
      expense_category: [
        "admin",
        "security",
        "utility",
        "fm",
        "maintenance",
        "other",
      ],
      invoice_status: ["unpaid", "paid", "partial", "cancelled", "overdue"],
      maintenance_priority: ["low", "normal", "high", "urgent"],
      maintenance_status: ["pending", "in_progress", "completed", "cancelled"],
      payment_method: ["card", "bank_transfer", "cash", "cheque", "mock"],
      resident_type: ["owner", "tenant"],
      visitor_status: [
        "pending",
        "approved",
        "rejected",
        "checked_in",
        "checked_out",
      ],
    },
  },
} as const
