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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          catatan_perbaikan: string | null
          created_at: string
          id: string
          kategori: string | null
          nama_aset: string
          serial_number: string | null
          status: string
          tanggal_beli: string | null
          uker_id: string | null
          updated_at: string
        }
        Insert: {
          catatan_perbaikan?: string | null
          created_at?: string
          id?: string
          kategori?: string | null
          nama_aset: string
          serial_number?: string | null
          status?: string
          tanggal_beli?: string | null
          uker_id?: string | null
          updated_at?: string
        }
        Update: {
          catatan_perbaikan?: string | null
          created_at?: string
          id?: string
          kategori?: string | null
          nama_aset?: string
          serial_number?: string | null
          status?: string
          tanggal_beli?: string | null
          uker_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_uker_id_fkey"
            columns: ["uker_id"]
            isOneToOne: false
            referencedRelation: "ukers"
            referencedColumns: ["id"]
          },
        ]
      }
      atm_machines: {
        Row: {
          created_at: string
          id: string
          kode_atm: string
          lokasi: string | null
          status: string
          tanggal_maintenance_terakhir: string | null
          tanggal_pasang: string | null
          uker_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kode_atm: string
          lokasi?: string | null
          status?: string
          tanggal_maintenance_terakhir?: string | null
          tanggal_pasang?: string | null
          uker_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kode_atm?: string
          lokasi?: string | null
          status?: string
          tanggal_maintenance_terakhir?: string | null
          tanggal_pasang?: string | null
          uker_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atm_machines_uker_id_fkey"
            columns: ["uker_id"]
            isOneToOne: false
            referencedRelation: "ukers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendances: {
        Row: {
          catatan: string | null
          created_at: string
          employee_id: string | null
          event_id: string
          id: string
          nama_manual: string | null
          uker_manual: string | null
          waktu_hadir: string
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          employee_id?: string | null
          event_id: string
          id?: string
          nama_manual?: string | null
          uker_manual?: string | null
          waktu_hadir?: string
        }
        Update: {
          catatan?: string | null
          created_at?: string
          employee_id?: string | null
          event_id?: string
          id?: string
          nama_manual?: string | null
          uker_manual?: string | null
          waktu_hadir?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      edc_machines: {
        Row: {
          created_at: string
          id: string
          kode_edc: string
          lokasi: string | null
          merchant: string | null
          status: string
          tanggal_pasang: string | null
          uker_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kode_edc: string
          lokasi?: string | null
          merchant?: string | null
          status?: string
          tanggal_pasang?: string | null
          uker_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kode_edc?: string
          lokasi?: string | null
          merchant?: string | null
          status?: string
          tanggal_pasang?: string | null
          uker_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edc_machines_uker_id_fkey"
            columns: ["uker_id"]
            isOneToOne: false
            referencedRelation: "ukers"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          foto_url: string | null
          id: string
          jabatan: string | null
          nama: string
          nip: string
          no_hp: string | null
          status_aktif: boolean
          uker_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          jabatan?: string | null
          nama: string
          nip: string
          no_hp?: string | null
          status_aktif?: boolean
          uker_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          jabatan?: string | null
          nama?: string
          nip?: string
          no_hp?: string | null
          status_aktif?: boolean
          uker_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_uker_id_fkey"
            columns: ["uker_id"]
            isOneToOne: false
            referencedRelation: "ukers"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          deskripsi: string | null
          id: string
          is_active: boolean
          nama_event: string
          qr_token: string
          tanggal_mulai: string | null
          tanggal_selesai: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deskripsi?: string | null
          id?: string
          is_active?: boolean
          nama_event: string
          qr_token?: string
          tanggal_mulai?: string | null
          tanggal_selesai?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deskripsi?: string | null
          id?: string
          is_active?: boolean
          nama_event?: string
          qr_token?: string
          tanggal_mulai?: string | null
          tanggal_selesai?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      it_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          deskripsi: string | null
          id: string
          judul: string
          reported_by: string | null
          resolved_at: string | null
          status: string
          uker_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          deskripsi?: string | null
          id?: string
          judul: string
          reported_by?: string | null
          resolved_at?: string | null
          status?: string
          uker_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          deskripsi?: string | null
          id?: string
          judul?: string
          reported_by?: string | null
          resolved_at?: string | null
          status?: string
          uker_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_tickets_uker_id_fkey"
            columns: ["uker_id"]
            isOneToOne: false
            referencedRelation: "ukers"
            referencedColumns: ["id"]
          },
        ]
      }
      it_tools: {
        Row: {
          catatan: string | null
          created_at: string
          id: string
          kategori: string | null
          link_download: string | null
          nama_tool: string
          updated_at: string
          uploaded_by: string | null
          versi: string | null
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          id?: string
          kategori?: string | null
          link_download?: string | null
          nama_tool: string
          updated_at?: string
          uploaded_by?: string | null
          versi?: string | null
        }
        Update: {
          catatan?: string | null
          created_at?: string
          id?: string
          kategori?: string | null
          link_download?: string | null
          nama_tool?: string
          updated_at?: string
          uploaded_by?: string | null
          versi?: string | null
        }
        Relationships: []
      }
      photos: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          judul: string
          kategori: string | null
          uker_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          judul: string
          kategori?: string | null
          uker_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          judul?: string
          kategori?: string | null
          uker_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_uker_id_fkey"
            columns: ["uker_id"]
            isOneToOne: false
            referencedRelation: "ukers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_blocked: boolean
          last_activity: string | null
          last_activity_at: string | null
          last_online: string | null
          nama: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          is_blocked?: boolean
          last_activity?: string | null
          last_activity_at?: string | null
          last_online?: string | null
          nama?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          last_activity?: string | null
          last_activity_at?: string | null
          last_online?: string | null
          nama?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      tutorials: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          judul: string
          kategori: string | null
          konten: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          judul: string
          kategori?: string | null
          konten?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          judul?: string
          kategori?: string | null
          konten?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      ukers: {
        Row: {
          alamat: string | null
          created_at: string
          id: string
          ip_address: string | null
          kode_uker: string
          latitude: number | null
          longitude: number | null
          nama_uker: string
          pic_it: string | null
          status_aktif: boolean
          tipe: string | null
          updated_at: string
        }
        Insert: {
          alamat?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          kode_uker: string
          latitude?: number | null
          longitude?: number | null
          nama_uker: string
          pic_it?: string | null
          status_aktif?: boolean
          tipe?: string | null
          updated_at?: string
        }
        Update: {
          alamat?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          kode_uker?: string
          latitude?: number | null
          longitude?: number | null
          nama_uker?: string
          pic_it?: string | null
          status_aktif?: boolean
          tipe?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          is_blocked: boolean
          last_activity: string
          last_activity_at: string
          last_online: string
          nama: string
          roles: string[]
          username: string
        }[]
      }
      admin_set_blocked: {
        Args: { p_blocked: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_set_password: {
        Args: { p_password: string; p_user_id: string }
        Returns: undefined
      }
      get_uker_ips: {
        Args: never
        Returns: {
          id: string
          ip_address: string
          kode_uker: string
          nama_uker: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_event_admin: { Args: never; Returns: boolean }
      is_it_admin: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      touch_presence: { Args: { p_activity?: string }; Returns: undefined }
    }
    Enums: {
      app_role: "superadmin" | "it_admin" | "event_admin" | "employee"
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
      app_role: ["superadmin", "it_admin", "event_admin", "employee"],
    },
  },
} as const
