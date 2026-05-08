export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointment_resources: {
        Row: {
          appointment_id: string
          created_at: string
          descripcion: string | null
          id: string
          tipo_recurso: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          tipo_recurso: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          tipo_recurso?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_resources_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          created_by: string | null
          doctor_id: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          motivo_consulta: string | null
          notas: string | null
          patient_id: string
          room_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doctor_id: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          motivo_consulta?: string | null
          notas?: string | null
          patient_id: string
          room_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doctor_id?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          motivo_consulta?: string | null
          notas?: string | null
          patient_id?: string
          room_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          accion: Database["public"]["Enums"]["audit_action"]
          created_at: string
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          id: string
          ip_address: string | null
          registro_id: string | null
          tabla: string
          user_id: string | null
        }
        Insert: {
          accion: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabla: string
          user_id?: string | null
        }
        Update: {
          accion?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabla?: string
          user_id?: string | null
        }
        Relationships: []
      }
      doctors: {
        Row: {
          activo: boolean
          apellidos: string
          cedula_profesional: string | null
          created_at: string
          duracion_cita_min: number
          especialidad: string
          horario_fin: string
          horario_inicio: string
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          apellidos: string
          cedula_profesional?: string | null
          created_at?: string
          duracion_cita_min?: number
          especialidad: string
          horario_fin?: string
          horario_inicio?: string
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          apellidos?: string
          cedula_profesional?: string | null
          created_at?: string
          duracion_cita_min?: number
          especialidad?: string
          horario_fin?: string
          horario_inicio?: string
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expedientes: {
        Row: {
          activo: boolean
          created_at: string
          doctor_id: string
          id: string
          patient_id: string
          tipo: Database["public"]["Enums"]["expediente_tipo"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          doctor_id: string
          id?: string
          patient_id: string
          tipo?: Database["public"]["Enums"]["expediente_tipo"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          doctor_id?: string
          id?: string
          patient_id?: string
          tipo?: Database["public"]["Enums"]["expediente_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedientes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedientes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_consulta: {
        Row: {
          analisis: string | null
          appointment_id: string | null
          created_at: string
          diagnostico_principal: string | null
          doctor_id: string
          expediente_id: string
          fecha_consulta: string
          id: string
          objetivo: string | null
          plan: string | null
          subjetivo: string | null
          updated_at: string
        }
        Insert: {
          analisis?: string | null
          appointment_id?: string | null
          created_at?: string
          diagnostico_principal?: string | null
          doctor_id: string
          expediente_id: string
          fecha_consulta?: string
          id?: string
          objetivo?: string | null
          plan?: string | null
          subjetivo?: string | null
          updated_at?: string
        }
        Update: {
          analisis?: string | null
          appointment_id?: string | null
          created_at?: string
          diagnostico_principal?: string | null
          doctor_id?: string
          expediente_id?: string
          fecha_consulta?: string
          id?: string
          objetivo?: string | null
          plan?: string | null
          subjetivo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_consulta_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_consulta_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          activo: boolean
          alergias: string | null
          apellidos: string
          codigo_postal: string | null
          colonia: string | null
          contacto_emergencia_nombre: string | null
          contacto_emergencia_telefono: string | null
          created_at: string
          curp: string | null
          direccion: string | null
          email: string | null
          estado: string | null
          fecha_nacimiento: string | null
          id: string
          municipio: string | null
          nombre: string
          notas: string | null
          rfc: string | null
          sexo: string | null
          telefono: string | null
          tipo_sangre: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          alergias?: string | null
          apellidos: string
          codigo_postal?: string | null
          colonia?: string | null
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          created_at?: string
          curp?: string | null
          direccion?: string | null
          email?: string | null
          estado?: string | null
          fecha_nacimiento?: string | null
          id?: string
          municipio?: string | null
          nombre: string
          notas?: string | null
          rfc?: string | null
          sexo?: string | null
          telefono?: string | null
          tipo_sangre?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          alergias?: string | null
          apellidos?: string
          codigo_postal?: string | null
          colonia?: string | null
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          created_at?: string
          curp?: string | null
          direccion?: string | null
          email?: string | null
          estado?: string | null
          fecha_nacimiento?: string | null
          id?: string
          municipio?: string | null
          nombre?: string
          notas?: string | null
          rfc?: string | null
          sexo?: string | null
          telefono?: string | null
          tipo_sangre?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          appointment_id: string
          canal: Database["public"]["Enums"]["reminder_channel"]
          created_at: string
          enviado_en: string | null
          estado: Database["public"]["Enums"]["reminder_status"]
          id: string
          intentos: number
          mensaje: string | null
          programado_para: string
        }
        Insert: {
          appointment_id: string
          canal?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          enviado_en?: string | null
          estado?: Database["public"]["Enums"]["reminder_status"]
          id?: string
          intentos?: number
          mensaje?: string | null
          programado_para: string
        }
        Update: {
          appointment_id?: string
          canal?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          enviado_en?: string | null
          estado?: Database["public"]["Enums"]["reminder_status"]
          id?: string
          intentos?: number
          mensaje?: string | null
          programado_para?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          activo: boolean
          capacidad: number
          created_at: string
          equipamiento: string | null
          id: string
          nombre: string
          piso: string | null
        }
        Insert: {
          activo?: boolean
          capacidad?: number
          created_at?: string
          equipamiento?: string | null
          id?: string
          nombre: string
          piso?: string | null
        }
        Update: {
          activo?: boolean
          capacidad?: number
          created_at?: string
          equipamiento?: string | null
          id?: string
          nombre?: string
          piso?: string | null
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
      has_role: {
        Args: { _user_id: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_appointment_participant: {
        Args: { _appointment_id: string }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _accion: Database["public"]["Enums"]["audit_action"]
          _tabla: string
          _registro_id: string
          _datos_anteriores?: Json
          _datos_nuevos?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "receptionist" | "doctor" | "nurse" | "patient"
      appointment_status:
        | "solicitada"
        | "tentativa"
        | "pendiente_formulario"
        | "confirmada"
        | "recordatorio_enviado"
        | "confirmada_paciente"
        | "confirmada_medico"
        | "cancelada"
        | "liberada"
      audit_action: "crear" | "actualizar" | "cancelar"
      expediente_tipo:
        | "primera_vez"
        | "seguimiento"
        | "urgencia"
        | "cirugia"
        | "cronico"
      reminder_channel: "whatsapp" | "sms" | "email"
      reminder_status: "pendiente" | "enviado" | "fallido"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][PublicCompositeTypeNameOrOptions["schema"]][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
