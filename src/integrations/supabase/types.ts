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
          deposit_amount: number
          description: string | null
          hourly_rate: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          portal_bookable: boolean
          requires_approval: boolean
          updated_at: string
          vat_rate: number
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          deposit_amount?: number
          description?: string | null
          hourly_rate?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          portal_bookable?: boolean
          requires_approval?: boolean
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          capacity?: number | null
          created_at?: string
          deposit_amount?: number
          description?: string | null
          hourly_rate?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          portal_bookable?: boolean
          requires_approval?: boolean
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      amenity_bookings: {
        Row: {
          amenity_id: string
          base_amount: number
          created_at: string
          deposit_amount: number
          ends_at: string
          extras: Json
          extras_amount: number
          hours: number | null
          id: string
          notes: string | null
          payment_status: string | null
          purpose: Database["public"]["Enums"]["booking_purpose"]
          requested_by: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          unit_id: string | null
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          amenity_id: string
          base_amount?: number
          created_at?: string
          deposit_amount?: number
          ends_at: string
          extras?: Json
          extras_amount?: number
          hours?: number | null
          id?: string
          notes?: string | null
          payment_status?: string | null
          purpose?: Database["public"]["Enums"]["booking_purpose"]
          requested_by?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          unit_id?: string | null
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          amenity_id?: string
          base_amount?: number
          created_at?: string
          deposit_amount?: number
          ends_at?: string
          extras?: Json
          extras_amount?: number
          hours?: number | null
          id?: string
          notes?: string | null
          payment_status?: string | null
          purpose?: Database["public"]["Enums"]["booking_purpose"]
          requested_by?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          unit_id?: string | null
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
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
      bank_accounts: {
        Row: {
          account_number: string | null
          bank_name: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          account_id: string
          amount: number
          applied_amount: number
          applied_at: string | null
          applied_by: string | null
          applied_to_id: string | null
          applied_to_type: string | null
          apply_notes: string | null
          created_at: string
          description: string
          direction: Database["public"]["Enums"]["bank_txn_direction"]
          id: string
          matched_payment_id: string | null
          matched_vendor_payment_id: string | null
          notes: string | null
          reference: string | null
          source: string
          status: Database["public"]["Enums"]["bank_txn_status"]
          txn_date: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          applied_amount?: number
          applied_at?: string | null
          applied_by?: string | null
          applied_to_id?: string | null
          applied_to_type?: string | null
          apply_notes?: string | null
          created_at?: string
          description: string
          direction: Database["public"]["Enums"]["bank_txn_direction"]
          id?: string
          matched_payment_id?: string | null
          matched_vendor_payment_id?: string | null
          notes?: string | null
          reference?: string | null
          source?: string
          status?: Database["public"]["Enums"]["bank_txn_status"]
          txn_date: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          applied_amount?: number
          applied_at?: string | null
          applied_by?: string | null
          applied_to_id?: string | null
          applied_to_type?: string | null
          apply_notes?: string | null
          created_at?: string
          description?: string
          direction?: Database["public"]["Enums"]["bank_txn_direction"]
          id?: string
          matched_payment_id?: string | null
          matched_vendor_payment_id?: string | null
          notes?: string | null
          reference?: string | null
          source?: string
          status?: Database["public"]["Enums"]["bank_txn_status"]
          txn_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_vendor_payment_id_fkey"
            columns: ["matched_vendor_payment_id"]
            isOneToOne: false
            referencedRelation: "vendor_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          cr_number: string | null
          created_at: string
          default_currency: string
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          tax_invoice_footer: string | null
          updated_at: string
          vat_effective_date: string | null
          vat_number: string | null
          vat_rate: number
        }
        Insert: {
          address?: string | null
          company_name?: string
          cr_number?: string | null
          created_at?: string
          default_currency?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          tax_invoice_footer?: string | null
          updated_at?: string
          vat_effective_date?: string | null
          vat_number?: string | null
          vat_rate?: number
        }
        Update: {
          address?: string | null
          company_name?: string
          cr_number?: string | null
          created_at?: string
          default_currency?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          tax_invoice_footer?: string | null
          updated_at?: string
          vat_effective_date?: string | null
          vat_number?: string | null
          vat_rate?: number
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
      currencies: {
        Row: {
          code: string
          created_at: string
          decimals: number
          exchange_rate: number
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          decimals?: number
          exchange_rate?: number
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          decimals?: number
          exchange_rate?: number
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          attachments: Json
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          is_paid: boolean
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          reference: string | null
          total_amount: number | null
          updated_at: string
          vat_amount: number
          vendor: string | null
        }
        Insert: {
          amount: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reference?: string | null
          total_amount?: number | null
          updated_at?: string
          vat_amount?: number
          vendor?: string | null
        }
        Update: {
          amount?: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reference?: string | null
          total_amount?: number | null
          updated_at?: string
          vat_amount?: number
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
          attachments: Json
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          discount_amount: number
          due_date: string
          id: string
          invoice_number: string
          notes: string | null
          payment_terms: string | null
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
          attachments?: Json
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          discount_amount?: number
          due_date: string
          id?: string
          invoice_number: string
          notes?: string | null
          payment_terms?: string | null
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
          attachments?: Json
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          discount_amount?: number
          due_date?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          payment_terms?: string | null
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
      notice_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "notice_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notices: {
        Row: {
          audience: string
          body: string
          channel: string
          created_at: string
          group_id: string | null
          id: string
          recipient_count: number
          sent_at: string
          sent_by: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          channel?: string
          created_at?: string
          group_id?: string | null
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          channel?: string
          created_at?: string
          group_id?: string | null
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "notice_groups"
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
      purchase_invoices: {
        Row: {
          amount_paid: number
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          attachments: Json
          balance_due: number
          bill_number: string
          category: Database["public"]["Enums"]["expense_category"] | null
          created_at: string
          created_by: string | null
          description: string | null
          discount_amount: number
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          payment_terms: string | null
          reference: string | null
          status: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          amount_paid?: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json
          balance_due?: number
          bill_number: string
          category?: Database["public"]["Enums"]["expense_category"] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vendor_id?: string | null
          vendor_name: string
        }
        Update: {
          amount_paid?: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json
          balance_due?: number
          bill_number?: string
          category?: Database["public"]["Enums"]["expense_category"] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
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
      role_permissions: {
        Row: {
          can_apply_txn: boolean
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_apply_txn?: boolean
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_apply_txn?: boolean
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
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
      vendor_payments: {
        Row: {
          amount: number
          attachments: Json
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          notes: string | null
          payment_date: string
          payment_number: string
          purchase_invoice_id: string | null
          reference: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          attachments?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          payment_number: string
          purchase_invoice_id?: string | null
          reference?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          attachments?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          payment_number?: string
          purchase_invoice_id?: string | null
          reference?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          car_plate: string | null
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
          car_plate?: string | null
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
          car_plate?: string | null
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
      app_role:
        | "admin"
        | "resident"
        | "accountant"
        | "viewer"
        | "finance"
        | "operations"
        | "security"
      approval_status: "draft" | "pending" | "approved" | "rejected"
      bank_txn_direction: "in" | "out"
      bank_txn_status:
        | "matched"
        | "partial"
        | "unmatched"
        | "review"
        | "draft"
        | "applied"
        | "partially_applied"
        | "reversed"
      booking_purpose: "personal" | "commercial" | "event" | "wedding"
      booking_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "completed"
        | "confirmed"
        | "paid"
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
      purchase_invoice_status:
        | "unpaid"
        | "partial"
        | "paid"
        | "cancelled"
        | "overdue"
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
      app_role: [
        "admin",
        "resident",
        "accountant",
        "viewer",
        "finance",
        "operations",
        "security",
      ],
      approval_status: ["draft", "pending", "approved", "rejected"],
      bank_txn_direction: ["in", "out"],
      bank_txn_status: [
        "matched",
        "partial",
        "unmatched",
        "review",
        "draft",
        "applied",
        "partially_applied",
        "reversed",
      ],
      booking_purpose: ["personal", "commercial", "event", "wedding"],
      booking_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "completed",
        "confirmed",
        "paid",
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
      purchase_invoice_status: [
        "unpaid",
        "partial",
        "paid",
        "cancelled",
        "overdue",
      ],
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
