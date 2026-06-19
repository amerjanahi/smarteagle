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
      amenities: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          hourly_rate: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          hourly_rate?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          hourly_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      amenity_bookings: {
        Row: {
          amenity_id: string
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          requested_by: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          amenity_id: string
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          requested_by?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          amenity_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          requested_by?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenity_bookings_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_bookings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
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
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after_json: Json | null
          before_json: Json | null
          created_at: string
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      credit_note_line_items: {
        Row: {
          created_at: string
          credit_note_id: string
          description: string
          id: string
          line_total: number
          position: number
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          description: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          description?: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_line_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          applied_amount: number
          balance: number
          created_at: string
          credit_note_number: string
          id: string
          invoice_id: string | null
          issued_at: string
          issued_by: string | null
          reason: string
          status: string
          unit_id: string
        }
        Insert: {
          amount: number
          applied_amount?: number
          balance?: number
          created_at?: string
          credit_note_number: string
          id?: string
          invoice_id?: string | null
          issued_at?: string
          issued_by?: string | null
          reason: string
          status?: string
          unit_id: string
        }
        Update: {
          amount?: number
          applied_amount?: number
          balance?: number
          created_at?: string
          credit_note_number?: string
          id?: string
          invoice_id?: string | null
          issued_at?: string
          issued_by?: string | null
          reason?: string
          status?: string
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
      document_counters: {
        Row: {
          doc_type: string
          last_number: number
          year: number
        }
        Insert: {
          doc_type: string
          last_number?: number
          year: number
        }
        Update: {
          doc_type?: string
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          accent_color: string
          created_at: string
          created_by: string | null
          fields_json: Json
          footer_text: string | null
          header_text: string | null
          id: string
          is_default: boolean
          layout: string
          logo_url: string | null
          name: string
          primary_color: string
          template_type: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          created_by?: string | null
          fields_json?: Json
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_default?: boolean
          layout?: string
          logo_url?: string | null
          name: string
          primary_color?: string
          template_type: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          created_by?: string | null
          fields_json?: Json
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_default?: boolean
          layout?: string
          logo_url?: string | null
          name?: string
          primary_color?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
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
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          position: number
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          position?: number
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          position?: number
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          currency: string
          description: string | null
          due_date: string
          id: string
          invoice_number: string
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          unit_id: string
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date: string
          id?: string
          invoice_number: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          unit_id: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          unit_id?: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
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
      payment_allocations: {
        Row: {
          amount_applied: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount_applied: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount_applied?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          allocated_amount: number
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
          unallocated_amount: number
        }
        Insert: {
          allocated_amount?: number
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
          unallocated_amount?: number
        }
        Update: {
          allocated_amount?: number
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
          unallocated_amount?: number
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
          built_up_area_sqm: number | null
          created_at: string
          floor: number | null
          handover_date: string | null
          id: string
          is_occupied: boolean
          land_area_sqm: number | null
          monthly_service_charge: number
          notes: string | null
          unit_number: string
          updated_at: string
        }
        Insert: {
          area_sqm?: number | null
          bedrooms?: number | null
          building: string
          built_up_area_sqm?: number | null
          created_at?: string
          floor?: number | null
          handover_date?: string | null
          id?: string
          is_occupied?: boolean
          land_area_sqm?: number | null
          monthly_service_charge?: number
          notes?: string | null
          unit_number: string
          updated_at?: string
        }
        Update: {
          area_sqm?: number | null
          bedrooms?: number | null
          building?: string
          built_up_area_sqm?: number | null
          created_at?: string
          floor?: number | null
          handover_date?: string | null
          id?: string
          is_occupied?: boolean
          land_area_sqm?: number | null
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
      can_manage_sales: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_document_number: {
        Args: { _doc_type: string; _prefix: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "resident" | "accountant" | "viewer"
      booking_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "completed"
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
      app_role: ["admin", "resident", "accountant", "viewer"],
      booking_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "completed",
      ],
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
