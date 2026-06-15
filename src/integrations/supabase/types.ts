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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      almacen_alertas: {
        Row: {
          clinic_id: string | null
          created_at: string
          generic_name: string | null
          id: string
          medicamento_id: string | null
          prescription_id: string | null
          prescription_item_id: string | null
          quantity_available: number
          quantity_needed: number
          resolved_at: string | null
          status: string
          tipo: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          generic_name?: string | null
          id?: string
          medicamento_id?: string | null
          prescription_id?: string | null
          prescription_item_id?: string | null
          quantity_available?: number
          quantity_needed: number
          resolved_at?: string | null
          status?: string
          tipo: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          generic_name?: string | null
          id?: string
          medicamento_id?: string | null
          prescription_id?: string | null
          prescription_item_id?: string | null
          quantity_available?: number
          quantity_needed?: number
          resolved_at?: string | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      appointment_economics: {
        Row: {
          appointment_id: string
          automation_cost_mxn: number
          conversation_id: string | null
          created_at: string
          doctor_id: string | null
          gross_revenue_mxn: number
          id: string
          net_before_doctor_split_mxn: number | null
          organization_id: string
          service_id: string | null
        }
        Insert: {
          appointment_id: string
          automation_cost_mxn?: number
          conversation_id?: string | null
          created_at?: string
          doctor_id?: string | null
          gross_revenue_mxn?: number
          id?: string
          net_before_doctor_split_mxn?: number | null
          organization_id: string
          service_id?: string | null
        }
        Update: {
          appointment_id?: string
          automation_cost_mxn?: number
          conversation_id?: string | null
          created_at?: string
          doctor_id?: string | null
          gross_revenue_mxn?: number
          id?: string
          net_before_doctor_split_mxn?: number | null
          organization_id?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_economics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "bot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          conversacion_id: string | null
          creada_por_bot: boolean | null
          created_at: string
          created_by: string | null
          doctor_confirmation_at: string | null
          doctor_confirmation_reason: string | null
          doctor_confirmation_status: string
          doctor_id: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          motivo_consulta: string | null
          notas: string | null
          origen: string | null
          patient_id: string
          room_id: string | null
          servicio_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          conversacion_id?: string | null
          creada_por_bot?: boolean | null
          created_at?: string
          created_by?: string | null
          doctor_confirmation_at?: string | null
          doctor_confirmation_reason?: string | null
          doctor_confirmation_status?: string
          doctor_id: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          motivo_consulta?: string | null
          notas?: string | null
          origen?: string | null
          patient_id: string
          room_id?: string | null
          servicio_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          conversacion_id?: string | null
          creada_por_bot?: boolean | null
          created_at?: string
          created_by?: string | null
          doctor_confirmation_at?: string | null
          doctor_confirmation_reason?: string | null
          doctor_confirmation_status?: string
          doctor_id?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          motivo_consulta?: string | null
          notas?: string | null
          origen?: string | null
          patient_id?: string
          room_id?: string | null
          servicio_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "appointments_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      atribucion_campania: {
        Row: {
          ad_id: string | null
          created_at: string | null
          id: string
          identidad_canal_id: string | null
          mensaje_inicial: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          ad_id?: string | null
          created_at?: string | null
          id?: string
          identidad_canal_id?: string | null
          mensaje_inicial?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          ad_id?: string | null
          created_at?: string | null
          id?: string
          identidad_canal_id?: string | null
          mensaje_inicial?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atribucion_campania_identidad_canal_id_fkey"
            columns: ["identidad_canal_id"]
            isOneToOne: false
            referencedRelation: "identidades_canal"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          accion: Database["public"]["Enums"]["audit_action"]
          clinic_id: string | null
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
          clinic_id?: string | null
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
          clinic_id?: string | null
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabla?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_conversations: {
        Row: {
          appointment_id: string | null
          channel: string
          created_at: string
          ended_at: string | null
          external_user_id: string
          id: string
          organization_id: string
          outcome: string | null
          patient_id: string | null
          started_at: string
        }
        Insert: {
          appointment_id?: string | null
          channel: string
          created_at?: string
          ended_at?: string | null
          external_user_id: string
          id?: string
          organization_id: string
          outcome?: string | null
          patient_id?: string | null
          started_at?: string
        }
        Update: {
          appointment_id?: string | null
          channel?: string
          created_at?: string
          ended_at?: string | null
          external_user_id?: string
          id?: string
          organization_id?: string
          outcome?: string | null
          patient_id?: string | null
          started_at?: string
        }
        Relationships: []
      }
      bot_sesiones: {
        Row: {
          borrador_cita: Json | null
          borrador_paciente: Json | null
          consentimiento_dado: boolean | null
          consentimiento_fecha: string | null
          conversacion_id: string | null
          doctor_id: string | null
          flow_data: Json | null
          flow_step: string | null
          id: string
          servicio_id: string | null
          slot_propuesto: string | null
          updated_at: string | null
        }
        Insert: {
          borrador_cita?: Json | null
          borrador_paciente?: Json | null
          consentimiento_dado?: boolean | null
          consentimiento_fecha?: string | null
          conversacion_id?: string | null
          doctor_id?: string | null
          flow_data?: Json | null
          flow_step?: string | null
          id?: string
          servicio_id?: string | null
          slot_propuesto?: string | null
          updated_at?: string | null
        }
        Update: {
          borrador_cita?: Json | null
          borrador_paciente?: Json | null
          consentimiento_dado?: boolean | null
          consentimiento_fecha?: string | null
          conversacion_id?: string | null
          doctor_id?: string | null
          flow_data?: Json | null
          flow_step?: string | null
          id?: string
          servicio_id?: string | null
          slot_propuesto?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_sesiones_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: true
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_usage_costs: {
        Row: {
          channel: string
          conversation_id: string
          created_at: string
          event_type: string
          id: string
          input_tokens: number | null
          model: string | null
          organization_id: string
          output_tokens: number | null
          provider: string
          provider_cost_mxn: number | null
          provider_cost_usd: number | null
        }
        Insert: {
          channel: string
          conversation_id: string
          created_at?: string
          event_type: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          organization_id: string
          output_tokens?: number | null
          provider: string
          provider_cost_mxn?: number | null
          provider_cost_usd?: number | null
        }
        Update: {
          channel?: string
          conversation_id?: string
          created_at?: string
          event_type?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          organization_id?: string
          output_tokens?: number | null
          provider?: string
          provider_cost_mxn?: number | null
          provider_cost_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_usage_costs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "bot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cajas: {
        Row: {
          activo: boolean
          clinic_id: string
          created_at: string
          descripcion: string | null
          es_farmacia: boolean
          fondo_default: number
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clinic_id: string
          created_at?: string
          descripcion?: string | null
          es_farmacia?: boolean
          fondo_default?: number
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clinic_id?: string
          created_at?: string
          descripcion?: string | null
          es_farmacia?: boolean
          fondo_default?: number
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      canales: {
        Row: {
          activo: boolean | null
          display_name: string
          id: string
        }
        Insert: {
          activo?: boolean | null
          display_name: string
          id: string
        }
        Update: {
          activo?: boolean | null
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      checklists: {
        Row: {
          activo: boolean
          bloquear_avance: boolean
          clinic_id: string
          created_at: string
          id: string
          pasos: number
          permitir_justificacion: boolean
          responsable: string | null
          servicio: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          bloquear_avance?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          pasos?: number
          permitir_justificacion?: boolean
          responsable?: string | null
          servicio: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          bloquear_avance?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          pasos?: number
          permitir_justificacion?: boolean
          responsable?: string | null
          servicio?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_memberships: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_memberships_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          clinic_id: string
          data: Json
          id: string
          section: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          clinic_id: string
          data?: Json
          id?: string
          section: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          clinic_id?: string
          data?: Json
          id?: string
          section?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          city: string | null
          code: string
          country: string
          created_at: string
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          rfc: string | null
          state: string | null
          status: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          rfc?: string | null
          state?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          rfc?: string | null
          state?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conceptos: {
        Row: {
          activo: boolean
          clave: string
          clave_sat: string | null
          clinic_id: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          precio_default: number
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clave: string
          clave_sat?: string | null
          clinic_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          precio_default?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clave?: string
          clave_sat?: string | null
          clinic_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          precio_default?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      consentimientos: {
        Row: {
          id: string
          identidad_canal_id: string | null
          otorgado: boolean
          otorgado_at: string | null
          patient_id: string | null
          tipo: string
          version_texto: string
        }
        Insert: {
          id?: string
          identidad_canal_id?: string | null
          otorgado: boolean
          otorgado_at?: string | null
          patient_id?: string | null
          tipo: string
          version_texto: string
        }
        Update: {
          id?: string
          identidad_canal_id?: string | null
          otorgado?: boolean
          otorgado_at?: string | null
          patient_id?: string | null
          tipo?: string
          version_texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimientos_identidad_canal_id_fkey"
            columns: ["identidad_canal_id"]
            isOneToOne: false
            referencedRelation: "identidades_canal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consentimientos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          asignada_humano_id: string | null
          clinic_id: string | null
          created_at: string | null
          dolor_intensidad: number | null
          escalated_followup_count: number
          id: string
          identidad_canal_id: string | null
          insiste: boolean
          intencion_actual: string | null
          last_message_at: string | null
          last_patient_followup_at: string | null
          motivo_resumen: string | null
          prioridad: string | null
          status: string
        }
        Insert: {
          asignada_humano_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          dolor_intensidad?: number | null
          escalated_followup_count?: number
          id?: string
          identidad_canal_id?: string | null
          insiste?: boolean
          intencion_actual?: string | null
          last_message_at?: string | null
          last_patient_followup_at?: string | null
          motivo_resumen?: string | null
          prioridad?: string | null
          status?: string
        }
        Update: {
          asignada_humano_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          dolor_intensidad?: number | null
          escalated_followup_count?: number
          id?: string
          identidad_canal_id?: string | null
          insiste?: boolean
          intencion_actual?: string | null
          last_message_at?: string | null
          last_patient_followup_at?: string | null
          motivo_resumen?: string | null
          prioridad?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_identidad_canal_id_fkey"
            columns: ["identidad_canal_id"]
            isOneToOne: false
            referencedRelation: "identidades_canal"
            referencedColumns: ["id"]
          },
        ]
      }
      cortes: {
        Row: {
          autorizado_at: string | null
          autorizado_by: string | null
          clinic_id: string
          conteo_ciego: number | null
          conteo_movimientos: number
          created_at: string
          datos_json: Json
          diferencia: number | null
          efectivo_esperado: number | null
          folio_secuencial: number | null
          generado_by: string | null
          id: string
          pharmacy_shift_id: string | null
          requiere_autorizacion: boolean
          tipo: string
          total_efectivo: number
          total_general: number
          total_otros: number
          total_tarjeta: number
          total_transferencia: number
          turno_id: string | null
          updated_at: string
        }
        Insert: {
          autorizado_at?: string | null
          autorizado_by?: string | null
          clinic_id: string
          conteo_ciego?: number | null
          conteo_movimientos?: number
          created_at?: string
          datos_json?: Json
          diferencia?: number | null
          efectivo_esperado?: number | null
          folio_secuencial?: number | null
          generado_by?: string | null
          id?: string
          pharmacy_shift_id?: string | null
          requiere_autorizacion?: boolean
          tipo?: string
          total_efectivo?: number
          total_general?: number
          total_otros?: number
          total_tarjeta?: number
          total_transferencia?: number
          turno_id?: string | null
          updated_at?: string
        }
        Update: {
          autorizado_at?: string | null
          autorizado_by?: string | null
          clinic_id?: string
          conteo_ciego?: number | null
          conteo_movimientos?: number
          created_at?: string
          datos_json?: Json
          diferencia?: number | null
          efectivo_esperado?: number | null
          folio_secuencial?: number | null
          generado_by?: string | null
          id?: string
          pharmacy_shift_id?: string | null
          requiere_autorizacion?: boolean
          tipo?: string
          total_efectivo?: number
          total_general?: number
          total_otros?: number
          total_tarjeta?: number
          total_transferencia?: number
          turno_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cortes_pharmacy_shift_id_fkey"
            columns: ["pharmacy_shift_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_cash_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cortes_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_contact_attempts: {
        Row: {
          appointment_id: string | null
          attempted_at: string
          created_at: string
          created_by: string | null
          doctor_id: string | null
          id: string
          notes: string | null
          status: string
        }
        Insert: {
          appointment_id?: string | null
          attempted_at?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string | null
          attempted_at?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_contact_attempts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_contact_attempts_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_servicios: {
        Row: {
          doctor_id: string
          servicio_id: string
        }
        Insert: {
          doctor_id: string
          servicio_id: string
        }
        Update: {
          doctor_id?: string
          servicio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_servicios_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_servicios_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
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
      fondos_movimientos: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          monto: number
          motivo: string
          pharmacy_shift_id: string
          registrado_by: string
          tipo: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          monto: number
          motivo: string
          pharmacy_shift_id: string
          registrado_by: string
          tipo: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          monto?: number
          motivo?: string
          pharmacy_shift_id?: string
          registrado_by?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fondos_movimientos_pharmacy_shift_id_fkey"
            columns: ["pharmacy_shift_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_cash_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      identidades_canal: {
        Row: {
          canal_id: string | null
          created_at: string | null
          display_name: string | null
          external_id: string
          id: string
          metadata: Json | null
          patient_id: string | null
        }
        Insert: {
          canal_id?: string | null
          created_at?: string | null
          display_name?: string | null
          external_id: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
        }
        Update: {
          canal_id?: string | null
          created_at?: string | null
          display_name?: string | null
          external_id?: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identidades_canal_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identidades_canal_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      impresoras: {
        Row: {
          activo: boolean
          clinic_id: string
          conexion: string
          created_at: string
          direccion_ip: string | null
          es_default: boolean
          id: string
          nombre: string
          puerto: number | null
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clinic_id: string
          conexion?: string
          created_at?: string
          direccion_ip?: string | null
          es_default?: boolean
          id?: string
          nombre: string
          puerto?: number | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clinic_id?: string
          conexion?: string
          created_at?: string
          direccion_ip?: string | null
          es_default?: boolean
          id?: string
          nombre?: string
          puerto?: number | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      insumos: {
        Row: {
          activo: boolean
          caducidad: string | null
          clinic_id: string
          costo_centavos: number
          created_at: string
          id: string
          nombre: string
          proveedor_id: string | null
          stock: number
          stock_minimo: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          caducidad?: string | null
          clinic_id: string
          costo_centavos?: number
          created_at?: string
          id?: string
          nombre: string
          proveedor_id?: string | null
          stock?: number
          stock_minimo?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          caducidad?: string | null
          clinic_id?: string
          costo_centavos?: number
          created_at?: string
          id?: string
          nombre?: string
          proveedor_id?: string | null
          stock?: number
          stock_minimo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_items: {
        Row: {
          cantidad: number
          clinic_id: string
          created_at: string
          id: string
          insumo_id: string
          kit_id: string
          updated_at: string
        }
        Insert: {
          cantidad?: number
          clinic_id: string
          created_at?: string
          id?: string
          insumo_id: string
          kit_id: string
          updated_at?: string
        }
        Update: {
          cantidad?: number
          clinic_id?: string
          created_at?: string
          id?: string
          insumo_id?: string
          kit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_items_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      kits: {
        Row: {
          activo: boolean
          clinic_id: string
          costo_centavos: number
          created_at: string
          id: string
          margen_objetivo: number
          num_insumos: number
          precio_centavos: number
          tratamiento: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clinic_id: string
          costo_centavos?: number
          created_at?: string
          id?: string
          margen_objetivo?: number
          num_insumos?: number
          precio_centavos?: number
          tratamiento: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clinic_id?: string
          costo_centavos?: number
          created_at?: string
          id?: string
          margen_objetivo?: number
          num_insumos?: number
          precio_centavos?: number
          tratamiento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_medicamento: {
        Row: {
          clinic_id: string | null
          costo_unitario: number | null
          created_at: string
          existencia: number
          fecha_caducidad: string
          fecha_entrada: string
          id: string
          medicamento_id: string
          numero_lote: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          costo_unitario?: number | null
          created_at?: string
          existencia?: number
          fecha_caducidad: string
          fecha_entrada?: string
          id?: string
          medicamento_id: string
          numero_lote: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          costo_unitario?: number | null
          created_at?: string
          existencia?: number
          fecha_caducidad?: string
          fecha_entrada?: string
          id?: string
          medicamento_id?: string
          numero_lote?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_medicamento_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamentos: {
        Row: {
          activo: boolean
          allow_direct_sale: boolean
          categoria: string
          clave_cuadro_basico: string | null
          concentracion: string | null
          controlado: boolean
          created_at: string
          descripcion: string | null
          forma_farmaceutica: string | null
          grupo_terapeutico: string | null
          id: string
          is_controlled: boolean
          nombre: string
          precio_unitario: number
          principio_activo: string | null
          registro_cofepris: string | null
          regulatory_notes: string | null
          requiere_receta: boolean
          requires_prescription: boolean
          requires_retained_prescription: boolean
          requires_special_prescription: boolean
          stock_minimo: number
          tasa_iva: number
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          allow_direct_sale?: boolean
          categoria: string
          clave_cuadro_basico?: string | null
          concentracion?: string | null
          controlado?: boolean
          created_at?: string
          descripcion?: string | null
          forma_farmaceutica?: string | null
          grupo_terapeutico?: string | null
          id?: string
          is_controlled?: boolean
          nombre: string
          precio_unitario?: number
          principio_activo?: string | null
          registro_cofepris?: string | null
          regulatory_notes?: string | null
          requiere_receta?: boolean
          requires_prescription?: boolean
          requires_retained_prescription?: boolean
          requires_special_prescription?: boolean
          stock_minimo?: number
          tasa_iva?: number
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          allow_direct_sale?: boolean
          categoria?: string
          clave_cuadro_basico?: string | null
          concentracion?: string | null
          controlado?: boolean
          created_at?: string
          descripcion?: string | null
          forma_farmaceutica?: string | null
          grupo_terapeutico?: string | null
          id?: string
          is_controlled?: boolean
          nombre?: string
          precio_unitario?: number
          principio_activo?: string | null
          registro_cofepris?: string | null
          regulatory_notes?: string | null
          requiere_receta?: boolean
          requires_prescription?: boolean
          requires_retained_prescription?: boolean
          requires_special_prescription?: boolean
          stock_minimo?: number
          tasa_iva?: number
          unidad?: string
          updated_at?: string
        }
        Relationships: []
      }
      mensajes: {
        Row: {
          contenido: string | null
          conversacion_id: string | null
          created_at: string | null
          id: string
          raw_payload: Json | null
          rol: string
          tool_calls: Json | null
          tool_result: Json | null
        }
        Insert: {
          contenido?: string | null
          conversacion_id?: string | null
          created_at?: string | null
          id?: string
          raw_payload?: Json | null
          rol: string
          tool_calls?: Json | null
          tool_result?: Json | null
        }
        Update: {
          contenido?: string | null
          conversacion_id?: string | null
          created_at?: string | null
          id?: string
          raw_payload?: Json | null
          rol?: string
          tool_calls?: Json | null
          tool_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      metodos_pago: {
        Row: {
          activo: boolean
          clinic_id: string
          codigo_sat: string
          created_at: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clinic_id: string
          codigo_sat: string
          created_at?: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clinic_id?: string
          codigo_sat?: string
          created_at?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimiento_lineas: {
        Row: {
          cantidad: number
          clinic_id: string
          concepto_id: string | null
          created_at: string
          descripcion: string
          descuento: number
          id: string
          movimiento_id: string
          precio_unitario: number
          subtotal: number
          updated_at: string
        }
        Insert: {
          cantidad?: number
          clinic_id: string
          concepto_id?: string | null
          created_at?: string
          descripcion: string
          descuento?: number
          id?: string
          movimiento_id: string
          precio_unitario: number
          subtotal: number
          updated_at?: string
        }
        Update: {
          cantidad?: number
          clinic_id?: string
          concepto_id?: string | null
          created_at?: string
          descripcion?: string
          descuento?: number
          id?: string
          movimiento_id?: string
          precio_unitario?: number
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_lineas_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_lineas_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimiento_pagos: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          metodo_pago_id: string
          monto: number
          movimiento_id: string
          referencia: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          metodo_pago_id: string
          monto: number
          movimiento_id: string
          referencia?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          metodo_pago_id?: string
          monto?: number
          movimiento_id?: string
          referencia?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_pagos_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_pagos_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos: {
        Row: {
          appointment_id: string | null
          caja_id: string | null
          cajero_user_id: string | null
          clinic_id: string
          created_at: string
          descuento: number
          estado: string
          folio: string | null
          id: string
          notas: string | null
          patient_id: string | null
          subtotal: number
          tipo: string
          total: number
          turno_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          caja_id?: string | null
          cajero_user_id?: string | null
          clinic_id: string
          created_at?: string
          descuento?: number
          estado?: string
          folio?: string | null
          id?: string
          notas?: string | null
          patient_id?: string | null
          subtotal?: number
          tipo?: string
          total?: number
          turno_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          caja_id?: string | null
          cajero_user_id?: string | null
          clinic_id?: string
          created_at?: string
          descuento?: number
          estado?: string
          folio?: string | null
          id?: string
          notas?: string | null
          patient_id?: string | null
          subtotal?: number
          tipo?: string
          total?: number
          turno_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_inventario: {
        Row: {
          cantidad: number
          clinic_id: string | null
          created_at: string
          created_by: string | null
          id: string
          lote_id: string | null
          medicamento_id: string
          motivo: string | null
          reference_id: string | null
          reference_type: string | null
          tipo: Database["public"]["Enums"]["movimiento_tipo"]
        }
        Insert: {
          cantidad: number
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lote_id?: string | null
          medicamento_id: string
          motivo?: string | null
          reference_id?: string | null
          reference_type?: string | null
          tipo: Database["public"]["Enums"]["movimiento_tipo"]
        }
        Update: {
          cantidad?: number
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lote_id?: string | null
          medicamento_id?: string
          motivo?: string | null
          reference_id?: string | null
          reference_type?: string | null
          tipo?: Database["public"]["Enums"]["movimiento_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_inventario_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
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
            foreignKeyName: "notas_consulta_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
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
      patient_channel_identities: {
        Row: {
          channel: string
          consent_at: string | null
          consent_status: string
          created_at: string
          display_name: string | null
          external_user_id: string
          id: string
          organization_id: string
          patient_id: string | null
          phone_e164: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          consent_at?: string | null
          consent_status?: string
          created_at?: string
          display_name?: string | null
          external_user_id: string
          id?: string
          organization_id: string
          patient_id?: string | null
          phone_e164?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          consent_at?: string | null
          consent_status?: string
          created_at?: string
          display_name?: string | null
          external_user_id?: string
          id?: string
          organization_id?: string
          patient_id?: string | null
          phone_e164?: string | null
          updated_at?: string
        }
        Relationships: []
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
      pharmacy_cash_shifts: {
        Row: {
          cash_difference: number | null
          cashier_user_id: string
          clinic_id: string
          close_notes: string | null
          closed_at: string | null
          closed_by: string | null
          closing_cash_count: number | null
          created_at: string
          expected_cash_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          cash_difference?: number | null
          cashier_user_id: string
          clinic_id: string
          close_notes?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closing_cash_count?: number | null
          created_at?: string
          expected_cash_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          cash_difference?: number | null
          cashier_user_id?: string
          clinic_id?: string
          close_notes?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closing_cash_count?: number | null
          created_at?: string
          expected_cash_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pharmacy_return_items: {
        Row: {
          created_at: string
          id: string
          lote_id: string | null
          medicamento_id: string
          quantity: number
          return_id: string
          sale_item_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          lote_id?: string | null
          medicamento_id: string
          quantity: number
          return_id: string
          sale_item_id: string
          subtotal?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          lote_id?: string | null
          medicamento_id?: string
          quantity?: number
          return_id?: string
          sale_item_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_return_items_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_return_items_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_return_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_returns: {
        Row: {
          authorized_by: string
          clinic_id: string
          created_at: string
          created_by: string
          id: string
          motivo: string
          original_sale_id: string
          refund_method: string
          shift_id: string | null
          total_refund: number
        }
        Insert: {
          authorized_by: string
          clinic_id: string
          created_at?: string
          created_by: string
          id?: string
          motivo: string
          original_sale_id: string
          refund_method: string
          shift_id?: string | null
          total_refund?: number
        }
        Update: {
          authorized_by?: string
          clinic_id?: string
          created_at?: string
          created_by?: string
          id?: string
          motivo?: string
          original_sale_id?: string
          refund_method?: string
          shift_id?: string | null
          total_refund?: number
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_returns_original_sale_id_fkey"
            columns: ["original_sale_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_returns_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_cash_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_sale_items: {
        Row: {
          base_imponible: number | null
          clinic_id: string
          created_at: string
          discount: number
          id: string
          iva_amount: number | null
          lote_id: string | null
          medicamento_id: string
          prescription_item_id: string | null
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          base_imponible?: number | null
          clinic_id: string
          created_at?: string
          discount?: number
          id?: string
          iva_amount?: number | null
          lote_id?: string | null
          medicamento_id: string
          prescription_item_id?: string | null
          quantity: number
          sale_id: string
          subtotal?: number
          unit_price?: number
        }
        Update: {
          base_imponible?: number | null
          clinic_id?: string
          created_at?: string
          discount?: number
          id?: string
          iva_amount?: number | null
          lote_id?: string | null
          medicamento_id?: string
          prescription_item_id?: string | null
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_sale_items_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_sale_items_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_sale_payments: {
        Row: {
          acquirer: string | null
          amount: number
          authorization_code: string | null
          bank_name: string | null
          cambio_entregado: number | null
          card_brand: string | null
          card_last4: string | null
          card_type: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          monto_recibido: number | null
          notes: string | null
          payment_method: string
          sale_id: string
          terminal_id: string | null
          transfer_reference: string | null
        }
        Insert: {
          acquirer?: string | null
          amount: number
          authorization_code?: string | null
          bank_name?: string | null
          cambio_entregado?: number | null
          card_brand?: string | null
          card_last4?: string | null
          card_type?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          monto_recibido?: number | null
          notes?: string | null
          payment_method: string
          sale_id: string
          terminal_id?: string | null
          transfer_reference?: string | null
        }
        Update: {
          acquirer?: string | null
          amount?: number
          authorization_code?: string | null
          bank_name?: string | null
          cambio_entregado?: number | null
          card_brand?: string | null
          card_last4?: string | null
          card_type?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          monto_recibido?: number | null
          notes?: string | null
          payment_method?: string
          sale_id?: string
          terminal_id?: string | null
          transfer_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_sales: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          customer_name: string | null
          discount: number
          id: string
          notes: string | null
          patient_id: string | null
          payment_method: string | null
          payment_status: string
          prescription_id: string | null
          requires_invoice: boolean
          sale_type: string
          shift_id: string | null
          status: string
          subtotal: number
          total: number
          total_iva: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          discount?: number
          id?: string
          notes?: string | null
          patient_id?: string | null
          payment_method?: string | null
          payment_status?: string
          prescription_id?: string | null
          requires_invoice?: boolean
          sale_type: string
          shift_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          total_iva?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          discount?: number
          id?: string
          notes?: string | null
          patient_id?: string | null
          payment_method?: string | null
          payment_status?: string
          prescription_id?: string | null
          requires_invoice?: boolean
          sale_type?: string
          shift_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          total_iva?: number
          updated_at?: string
        }
        Relationships: []
      }
      pos_error_logs: {
        Row: {
          clinic_id: string | null
          created_at: string
          error_detail: string | null
          error_msg: string
          funcion: string
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          error_detail?: string | null
          error_msg: string
          funcion: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          error_detail?: string | null
          error_msg?: string
          funcion?: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          activo: boolean
          clinic_id: string
          contacto: string | null
          created_at: string
          email: string | null
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clinic_id: string
          contacto?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clinic_id?: string
          contacto?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      recetas_capturadas: {
        Row: {
          cedula_profesional: string
          clinic_id: string
          created_at: string
          created_by: string | null
          diagnostico: string | null
          especialidad: string | null
          fecha_receta: string
          folio_cofepris: string | null
          folio_receta: string | null
          folio_secuencial: number | null
          grupo: string | null
          id: string
          nombre_medico: string
          nombre_paciente: string | null
          notas: string | null
          receta_retenida: boolean
          sale_id: string | null
        }
        Insert: {
          cedula_profesional: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          diagnostico?: string | null
          especialidad?: string | null
          fecha_receta: string
          folio_cofepris?: string | null
          folio_receta?: string | null
          folio_secuencial?: number | null
          grupo?: string | null
          id?: string
          nombre_medico: string
          nombre_paciente?: string | null
          notas?: string | null
          receta_retenida?: boolean
          sale_id?: string | null
        }
        Update: {
          cedula_profesional?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          diagnostico?: string | null
          especialidad?: string | null
          fecha_receta?: string
          folio_cofepris?: string | null
          folio_receta?: string | null
          folio_secuencial?: number | null
          grupo?: string | null
          id?: string
          nombre_medico?: string
          nombre_paciente?: string | null
          notas?: string | null
          receta_retenida?: boolean
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recetas_capturadas_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      recordatorios_cita: {
        Row: {
          appointment_id: string | null
          enviado_at: string | null
          error: string | null
          id: string
          identidad_canal_id: string | null
          intentos: number | null
          mensaje: string | null
          programado_para: string
          status: string | null
          tipo: string
          ultimo_error: string | null
        }
        Insert: {
          appointment_id?: string | null
          enviado_at?: string | null
          error?: string | null
          id?: string
          identidad_canal_id?: string | null
          intentos?: number | null
          mensaje?: string | null
          programado_para: string
          status?: string | null
          tipo: string
          ultimo_error?: string | null
        }
        Update: {
          appointment_id?: string | null
          enviado_at?: string | null
          error?: string | null
          id?: string
          identidad_canal_id?: string | null
          intentos?: number | null
          mensaje?: string | null
          programado_para?: string
          status?: string | null
          tipo?: string
          ultimo_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recordatorios_cita_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordatorios_cita_identidad_canal_id_fkey"
            columns: ["identidad_canal_id"]
            isOneToOne: false
            referencedRelation: "identidades_canal"
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
      servicios: {
        Row: {
          activo: boolean | null
          created_at: string | null
          descripcion: string | null
          duracion_minutos: number
          especialidad: string
          id: string
          nombre: string
          precio_centavos: number | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          duracion_minutos: number
          especialidad: string
          id?: string
          nombre: string
          precio_centavos?: number | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          duracion_minutos?: number
          especialidad?: string
          id?: string
          nombre?: string
          precio_centavos?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      turnos: {
        Row: {
          abierto_at: string
          caja_id: string
          cajero_user_id: string
          cerrado_at: string | null
          clinic_id: string
          created_at: string
          estado: string
          id: string
          monto_apertura: number
          monto_cierre: number | null
          notas_apertura: string | null
          notas_cierre: string | null
          pharmacy_shift_id: string | null
          updated_at: string
        }
        Insert: {
          abierto_at?: string
          caja_id: string
          cajero_user_id: string
          cerrado_at?: string | null
          clinic_id: string
          created_at?: string
          estado?: string
          id?: string
          monto_apertura?: number
          monto_cierre?: number | null
          notas_apertura?: string | null
          notas_cierre?: string | null
          pharmacy_shift_id?: string | null
          updated_at?: string
        }
        Update: {
          abierto_at?: string
          caja_id?: string
          cajero_user_id?: string
          cerrado_at?: string | null
          clinic_id?: string
          created_at?: string
          estado?: string
          id?: string
          monto_apertura?: number
          monto_cierre?: number | null
          notas_apertura?: string | null
          notas_cierre?: string | null
          pharmacy_shift_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_pharmacy_shift_id_fkey"
            columns: ["pharmacy_shift_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_cash_shifts"
            referencedColumns: ["id"]
          },
        ]
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
      can_configure_caja: { Args: { _user_id: string }; Returns: boolean }
      cleanup_abandoned_bot_sesiones: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_appointment_participant: {
        Args: { _appointment_id: string }
        Returns: boolean
      }
      is_caja_staff: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          _accion: Database["public"]["Enums"]["audit_action"]
          _datos_anteriores?: Json
          _datos_nuevos?: Json
          _registro_id: string
          _tabla: string
        }
        Returns: undefined
      }
      pharmacy_close_shift:
        | {
            Args: { p_cash_count: number; p_notes?: string; p_shift_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_cash_count: number
              p_notes?: string
              p_shift_id: string
              p_supervisor_override?: boolean
            }
            Returns: Json
          }
      pharmacy_corte_x: { Args: { p_shift_id: string }; Returns: Json }
      pharmacy_current_shift: {
        Args: { p_clinic?: string }
        Returns: {
          cash_difference: number | null
          cashier_user_id: string
          clinic_id: string
          close_notes: string | null
          closed_at: string | null
          closed_by: string | null
          closing_cash_count: number | null
          created_at: string
          expected_cash_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pharmacy_cash_shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pharmacy_fondo_movimiento: {
        Args: {
          p_monto: number
          p_motivo: string
          p_shift_id: string
          p_tipo: string
        }
        Returns: string
      }
      pharmacy_open_shift: {
        Args: {
          p_clinic_id: string
          p_notes?: string
          p_opening_amount: number
        }
        Returns: string
      }
      pharmacy_register_return: { Args: { p_payload: Json }; Returns: string }
      pharmacy_register_sale: { Args: { p_payload: Json }; Returns: string }
      turno_close: {
        Args: {
          p_cash_count: number
          p_notes?: string
          p_supervisor_override?: boolean
          p_turno_id: string
        }
        Returns: Json
      }
      user_has_clinic_access: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "receptionist"
        | "doctor"
        | "nurse"
        | "patient"
        | "manager"
        | "cajero"
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
      movimiento_tipo:
        | "entrada"
        | "salida"
        | "ajuste"
        | "caducidad"
        | "salida_venta"
        | "salida_surtido_receta"
        | "cancelacion"
        | "entrada_devolucion"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "admin",
        "receptionist",
        "doctor",
        "nurse",
        "patient",
        "manager",
        "cajero",
      ],
      appointment_status: [
        "solicitada",
        "tentativa",
        "pendiente_formulario",
        "confirmada",
        "recordatorio_enviado",
        "confirmada_paciente",
        "confirmada_medico",
        "cancelada",
        "liberada",
      ],
      audit_action: ["crear", "actualizar", "cancelar"],
      expediente_tipo: [
        "primera_vez",
        "seguimiento",
        "urgencia",
        "cirugia",
        "cronico",
      ],
      movimiento_tipo: [
        "entrada",
        "salida",
        "ajuste",
        "caducidad",
        "salida_venta",
        "salida_surtido_receta",
        "cancelacion",
        "entrada_devolucion",
      ],
    },
  },
} as const
