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
      actas_merma: {
        Row: {
          autorizada_at: string | null
          autorizada_by: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          descripcion: string | null
          estatus: string
          fecha_merma: string
          folio: string
          id: string
          motivo: string
          rechazada_motivo: string | null
          total_costo_centavos: number
          updated_at: string | null
        }
        Insert: {
          autorizada_at?: string | null
          autorizada_by?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          estatus?: string
          fecha_merma?: string
          folio: string
          id?: string
          motivo: string
          rechazada_motivo?: string | null
          total_costo_centavos?: number
          updated_at?: string | null
        }
        Update: {
          autorizada_at?: string | null
          autorizada_by?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          estatus?: string
          fecha_merma?: string
          folio?: string
          id?: string
          motivo?: string
          rechazada_motivo?: string | null
          total_costo_centavos?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actas_merma_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      actas_merma_items: {
        Row: {
          acta_id: string
          cantidad: number
          costo_unitario_centavos: number
          id: string
          lote_id: string | null
          medicamento_id: string
          medicamento_nombre: string | null
          numero_lote: string | null
          observacion: string | null
          subtotal_centavos: number | null
        }
        Insert: {
          acta_id: string
          cantidad: number
          costo_unitario_centavos?: number
          id?: string
          lote_id?: string | null
          medicamento_id: string
          medicamento_nombre?: string | null
          numero_lote?: string | null
          observacion?: string | null
          subtotal_centavos?: number | null
        }
        Update: {
          acta_id?: string
          cantidad?: number
          costo_unitario_centavos?: number
          id?: string
          lote_id?: string | null
          medicamento_id?: string
          medicamento_nombre?: string | null
          numero_lote?: string | null
          observacion?: string | null
          subtotal_centavos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actas_merma_items_acta_id_fkey"
            columns: ["acta_id"]
            isOneToOne: false
            referencedRelation: "actas_merma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actas_merma_items_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actas_merma_items_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
        ]
      }
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
          clinic_id: string | null
          created_at: string
          descripcion: string | null
          id: string
          tipo_recurso: string
        }
        Insert: {
          appointment_id: string
          clinic_id?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          tipo_recurso: string
        }
        Update: {
          appointment_id?: string
          clinic_id?: string | null
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
          {
            foreignKeyName: "appointment_resources_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          assigned_nurse_id: string | null
          cita_padre_id: string | null
          clinic_id: string | null
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
          gcal_last_error: string | null
          google_event_id: string | null
          id: string
          motivo_consulta: string | null
          notas: string | null
          origen: string | null
          patient_id: string
          recurrencia_hasta: string | null
          recurrencia_num: number | null
          recurrencia_tipo: string | null
          room_id: string | null
          servicio_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          assigned_nurse_id?: string | null
          cita_padre_id?: string | null
          clinic_id?: string | null
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
          gcal_last_error?: string | null
          google_event_id?: string | null
          id?: string
          motivo_consulta?: string | null
          notas?: string | null
          origen?: string | null
          patient_id: string
          recurrencia_hasta?: string | null
          recurrencia_num?: number | null
          recurrencia_tipo?: string | null
          room_id?: string | null
          servicio_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          assigned_nurse_id?: string | null
          cita_padre_id?: string | null
          clinic_id?: string | null
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
          gcal_last_error?: string | null
          google_event_id?: string | null
          id?: string
          motivo_consulta?: string | null
          notas?: string | null
          origen?: string | null
          patient_id?: string
          recurrencia_hasta?: string | null
          recurrencia_num?: number | null
          recurrencia_tipo?: string | null
          room_id?: string | null
          servicio_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cita_padre_id_fkey"
            columns: ["cita_padre_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
      arco_requests: {
        Row: {
          clinic_name: string | null
          created_at: string
          deadline_at: string
          descripcion: string
          email: string
          folio: string
          id: string
          nombre: string
          notas_internas: string | null
          patient_id: string | null
          resolved_at: string | null
          respuesta: string | null
          status: string
          telefono: string | null
          tipo: string
        }
        Insert: {
          clinic_name?: string | null
          created_at?: string
          deadline_at?: string
          descripcion: string
          email: string
          folio?: string
          id?: string
          nombre: string
          notas_internas?: string | null
          patient_id?: string | null
          resolved_at?: string | null
          respuesta?: string | null
          status?: string
          telefono?: string | null
          tipo: string
        }
        Update: {
          clinic_name?: string | null
          created_at?: string
          deadline_at?: string
          descripcion?: string
          email?: string
          folio?: string
          id?: string
          nombre?: string
          notas_internas?: string | null
          patient_id?: string | null
          resolved_at?: string | null
          respuesta?: string | null
          status?: string
          telefono?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "arco_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      audit_log: {
        Row: {
          campo: string | null
          clinic_id: string | null
          created_at: string | null
          id: string
          ip: string | null
          operacion: string
          registro_id: string | null
          tabla: string
          usuario_email: string | null
          usuario_id: string | null
          valor_antes: string | null
          valor_despues: string | null
        }
        Insert: {
          campo?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          ip?: string | null
          operacion: string
          registro_id?: string | null
          tabla: string
          usuario_email?: string | null
          usuario_id?: string | null
          valor_antes?: string | null
          valor_despues?: string | null
        }
        Update: {
          campo?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          ip?: string | null
          operacion?: string
          registro_id?: string | null
          tabla?: string
          usuario_email?: string | null
          usuario_id?: string | null
          valor_antes?: string | null
          valor_despues?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
      auto_reorden_log: {
        Row: {
          clinic_id: string
          ejecutado_en: string | null
          error_mensaje: string | null
          estado: string
          id: string
          medicamento_id: string
          orden_compra_id: string | null
          proveedor_id: string
        }
        Insert: {
          clinic_id: string
          ejecutado_en?: string | null
          error_mensaje?: string | null
          estado?: string
          id?: string
          medicamento_id: string
          orden_compra_id?: string | null
          proveedor_id: string
        }
        Update: {
          clinic_id?: string
          ejecutado_en?: string | null
          error_mensaje?: string | null
          estado?: string
          id?: string
          medicamento_id?: string
          orden_compra_id?: string | null
          proveedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_reorden_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_reorden_log_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_reorden_log_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_reorden_log_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      ayuda_chat_mensajes: {
        Row: {
          autor_id: string | null
          contenido: string
          created_at: string
          id: string
          rol: Database["public"]["Enums"]["ayuda_chat_rol_mensaje"]
          sesion_id: string
        }
        Insert: {
          autor_id?: string | null
          contenido: string
          created_at?: string
          id?: string
          rol: Database["public"]["Enums"]["ayuda_chat_rol_mensaje"]
          sesion_id: string
        }
        Update: {
          autor_id?: string | null
          contenido?: string
          created_at?: string
          id?: string
          rol?: Database["public"]["Enums"]["ayuda_chat_rol_mensaje"]
          sesion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ayuda_chat_mensajes_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "ayuda_chat_sesiones"
            referencedColumns: ["id"]
          },
        ]
      }
      ayuda_chat_sesiones: {
        Row: {
          atendido_por: string | null
          clinic_id: string | null
          closed_at: string | null
          estado: Database["public"]["Enums"]["ayuda_chat_estado"]
          id: string
          ruta_origen: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          atendido_por?: string | null
          clinic_id?: string | null
          closed_at?: string | null
          estado?: Database["public"]["Enums"]["ayuda_chat_estado"]
          id?: string
          ruta_origen?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          atendido_por?: string | null
          clinic_id?: string | null
          closed_at?: string | null
          estado?: Database["public"]["Enums"]["ayuda_chat_estado"]
          id?: string
          ruta_origen?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ayuda_chat_sesiones_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      bitacora_temperatura: {
        Row: {
          alerta_enviada: boolean
          clinic_id: string
          created_at: string | null
          fuera_de_rango: boolean
          humedad_pct: number | null
          id: string
          observaciones: string | null
          registrado_by: string | null
          registrado_nombre: string | null
          temperatura_celsius: number
          zona: string
        }
        Insert: {
          alerta_enviada?: boolean
          clinic_id: string
          created_at?: string | null
          fuera_de_rango?: boolean
          humedad_pct?: number | null
          id?: string
          observaciones?: string | null
          registrado_by?: string | null
          registrado_nombre?: string | null
          temperatura_celsius: number
          zona?: string
        }
        Update: {
          alerta_enviada?: boolean
          clinic_id?: string
          created_at?: string | null
          fuera_de_rango?: boolean
          humedad_pct?: number | null
          id?: string
          observaciones?: string | null
          registrado_by?: string | null
          registrado_nombre?: string | null
          temperatura_celsius?: number
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_temperatura_clinic_id_fkey"
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
          clinic_id: string | null
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
          clinic_id?: string | null
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
          clinic_id?: string | null
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
            foreignKeyName: "bot_sesiones_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "cajas_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
      cfdi_conceptos: {
        Row: {
          cantidad: number
          cfdi_id: string
          clave_prod_serv: string
          clave_unidad: string
          created_at: string | null
          descripcion: string
          descuento: number
          id: string
          importe: number
          iva_importe: number | null
          iva_tasa: number | null
          objeto_imp: string
          valor_unitario: number
        }
        Insert: {
          cantidad?: number
          cfdi_id: string
          clave_prod_serv: string
          clave_unidad: string
          created_at?: string | null
          descripcion: string
          descuento?: number
          id?: string
          importe: number
          iva_importe?: number | null
          iva_tasa?: number | null
          objeto_imp?: string
          valor_unitario: number
        }
        Update: {
          cantidad?: number
          cfdi_id?: string
          clave_prod_serv?: string
          clave_unidad?: string
          created_at?: string | null
          descripcion?: string
          descuento?: number
          id?: string
          importe?: number
          iva_importe?: number | null
          iva_tasa?: number | null
          objeto_imp?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "cfdi_conceptos_cfdi_id_fkey"
            columns: ["cfdi_id"]
            isOneToOne: false
            referencedRelation: "cfdi_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cfdi_config: {
        Row: {
          activo: boolean | null
          clinic_id: string
          created_at: string | null
          csd_cer_nombre: string | null
          csd_cer_path: string | null
          csd_contrasena: string | null
          csd_key_nombre: string | null
          csd_key_path: string | null
          csd_secret_id: string | null
          domicilio_fiscal_cp: string | null
          id: string
          iva_default: number | null
          pac_ambiente: string | null
          pac_contrasena: string | null
          pac_proveedor: string | null
          pac_secret_id: string | null
          pac_usuario: string | null
          razon_social: string | null
          regimen_fiscal: string | null
          rfc: string | null
          serie_defecto: string | null
          updated_at: string | null
          zona_fronteriza: boolean | null
        }
        Insert: {
          activo?: boolean | null
          clinic_id: string
          created_at?: string | null
          csd_cer_nombre?: string | null
          csd_cer_path?: string | null
          csd_contrasena?: string | null
          csd_key_nombre?: string | null
          csd_key_path?: string | null
          csd_secret_id?: string | null
          domicilio_fiscal_cp?: string | null
          id?: string
          iva_default?: number | null
          pac_ambiente?: string | null
          pac_contrasena?: string | null
          pac_proveedor?: string | null
          pac_secret_id?: string | null
          pac_usuario?: string | null
          razon_social?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          serie_defecto?: string | null
          updated_at?: string | null
          zona_fronteriza?: boolean | null
        }
        Update: {
          activo?: boolean | null
          clinic_id?: string
          created_at?: string | null
          csd_cer_nombre?: string | null
          csd_cer_path?: string | null
          csd_contrasena?: string | null
          csd_key_nombre?: string | null
          csd_key_path?: string | null
          csd_secret_id?: string | null
          domicilio_fiscal_cp?: string | null
          id?: string
          iva_default?: number | null
          pac_ambiente?: string | null
          pac_contrasena?: string | null
          pac_proveedor?: string | null
          pac_secret_id?: string | null
          pac_usuario?: string | null
          razon_social?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          serie_defecto?: string | null
          updated_at?: string | null
          zona_fronteriza?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "cfdi_config_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      cfdi_documentos: {
        Row: {
          appointment_id: string | null
          cfdi_relacionado_uuid: string | null
          clinic_id: string
          created_at: string | null
          descuento: number
          fecha_emision: string
          folio: string | null
          forma_pago: string | null
          id: string
          metodo_pago: string | null
          moneda: string
          motivo_cancelacion: string | null
          nombre_receptor: string
          pac_id_externo: string | null
          patient_id: string | null
          pdf_path: string | null
          rfc_emisor: string
          rfc_receptor: string
          sale_id: string | null
          serie: string | null
          status: string
          subtotal: number
          tipo: string
          total: number
          updated_at: string | null
          uuid_fiscal: string | null
          xml_contenido: string | null
        }
        Insert: {
          appointment_id?: string | null
          cfdi_relacionado_uuid?: string | null
          clinic_id: string
          created_at?: string | null
          descuento?: number
          fecha_emision?: string
          folio?: string | null
          forma_pago?: string | null
          id?: string
          metodo_pago?: string | null
          moneda?: string
          motivo_cancelacion?: string | null
          nombre_receptor: string
          pac_id_externo?: string | null
          patient_id?: string | null
          pdf_path?: string | null
          rfc_emisor: string
          rfc_receptor: string
          sale_id?: string | null
          serie?: string | null
          status?: string
          subtotal?: number
          tipo: string
          total?: number
          updated_at?: string | null
          uuid_fiscal?: string | null
          xml_contenido?: string | null
        }
        Update: {
          appointment_id?: string | null
          cfdi_relacionado_uuid?: string | null
          clinic_id?: string
          created_at?: string | null
          descuento?: number
          fecha_emision?: string
          folio?: string | null
          forma_pago?: string | null
          id?: string
          metodo_pago?: string | null
          moneda?: string
          motivo_cancelacion?: string | null
          nombre_receptor?: string
          pac_id_externo?: string | null
          patient_id?: string | null
          pdf_path?: string | null
          rfc_emisor?: string
          rfc_receptor?: string
          sale_id?: string | null
          serie?: string | null
          status?: string
          subtotal?: number
          tipo?: string
          total?: number
          updated_at?: string | null
          uuid_fiscal?: string | null
          xml_contenido?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cfdi_documentos_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfdi_documentos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfdi_documentos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      cfdi_receptores: {
        Row: {
          clinic_id: string
          created_at: string | null
          domicilio_fiscal_cp: string
          email_envio: string | null
          id: string
          nombre: string
          patient_id: string | null
          regimen_fiscal: string
          rfc: string
          updated_at: string | null
          uso_cfdi_defecto: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          domicilio_fiscal_cp: string
          email_envio?: string | null
          id?: string
          nombre: string
          patient_id?: string | null
          regimen_fiscal: string
          rfc: string
          updated_at?: string | null
          uso_cfdi_defecto?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          domicilio_fiscal_cp?: string
          email_envio?: string | null
          id?: string
          nombre?: string
          patient_id?: string | null
          regimen_fiscal?: string
          rfc?: string
          updated_at?: string | null
          uso_cfdi_defecto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cfdi_receptores_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfdi_receptores_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_preguntas_pendientes: {
        Row: {
          aprobado: boolean
          clinic_id: string | null
          created_at: string
          faq_id: string | null
          id: string
          pregunta: string
          repeticiones: number
          respuesta_ia: string | null
          ruta_activa: string | null
          updated_at: string
        }
        Insert: {
          aprobado?: boolean
          clinic_id?: string | null
          created_at?: string
          faq_id?: string | null
          id?: string
          pregunta: string
          repeticiones?: number
          respuesta_ia?: string | null
          ruta_activa?: string | null
          updated_at?: string
        }
        Update: {
          aprobado?: boolean
          clinic_id?: string | null
          created_at?: string
          faq_id?: string | null
          id?: string
          pregunta?: string
          repeticiones?: number
          respuesta_ia?: string | null
          ruta_activa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_preguntas_pendientes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_preguntas_pendientes_faq_id_fkey"
            columns: ["faq_id"]
            isOneToOne: false
            referencedRelation: "faq_items"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "conceptos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      consentimientos: {
        Row: {
          clinic_id: string | null
          id: string
          identidad_canal_id: string | null
          otorgado: boolean
          otorgado_at: string | null
          patient_id: string | null
          tipo: string
          version_texto: string
        }
        Insert: {
          clinic_id?: string | null
          id?: string
          identidad_canal_id?: string | null
          otorgado: boolean
          otorgado_at?: string | null
          patient_id?: string | null
          tipo: string
          version_texto: string
        }
        Update: {
          clinic_id?: string | null
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
            foreignKeyName: "consentimientos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
      conteos_inventario: {
        Row: {
          categoria_filtro: string | null
          cerrado_por: string | null
          clinic_id: string
          created_at: string
          estatus: string
          fecha_cierre: string | null
          fecha_inicio: string
          folio: string
          id: string
          iniciado_por: string | null
          notas: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          categoria_filtro?: string | null
          cerrado_por?: string | null
          clinic_id: string
          created_at?: string
          estatus?: string
          fecha_cierre?: string | null
          fecha_inicio?: string
          folio: string
          id?: string
          iniciado_por?: string | null
          notas?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          categoria_filtro?: string | null
          cerrado_por?: string | null
          clinic_id?: string
          created_at?: string
          estatus?: string
          fecha_cierre?: string | null
          fecha_inicio?: string
          folio?: string
          id?: string
          iniciado_por?: string | null
          notas?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteos_inventario_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      conteos_items: {
        Row: {
          contado_at: string | null
          contado_por: string | null
          conteo_id: string
          created_at: string
          diferencia: number | null
          existencia_contada: number | null
          existencia_sistema: number
          fue_ajustado: boolean
          id: string
          lote_id: string | null
          medicamento_id: string
          nota_diferencia: string | null
          numero_lote: string | null
        }
        Insert: {
          contado_at?: string | null
          contado_por?: string | null
          conteo_id: string
          created_at?: string
          diferencia?: number | null
          existencia_contada?: number | null
          existencia_sistema?: number
          fue_ajustado?: boolean
          id?: string
          lote_id?: string | null
          medicamento_id: string
          nota_diferencia?: string | null
          numero_lote?: string | null
        }
        Update: {
          contado_at?: string | null
          contado_por?: string | null
          conteo_id?: string
          created_at?: string
          diferencia?: number | null
          existencia_contada?: number | null
          existencia_sistema?: number
          fue_ajustado?: boolean
          id?: string
          lote_id?: string | null
          medicamento_id?: string
          nota_diferencia?: string | null
          numero_lote?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conteos_items_conteo_id_fkey"
            columns: ["conteo_id"]
            isOneToOne: false
            referencedRelation: "conteos_inventario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteos_items_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteos_items_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
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
          efectivo_deposito: number | null
          efectivo_esperado: number | null
          folio_secuencial: number | null
          fondo_siguiente_turno: number | null
          generado_by: string | null
          id: string
          pharmacy_shift_id: string | null
          requiere_autorizacion: boolean
          tarjeta_tpv_declarado: number | null
          tarjeta_tpv_diferencia: number | null
          tipo: string
          total_efectivo: number
          total_general: number
          total_otros: number
          total_tarjeta: number
          total_transferencia: number
          transferencia_declarado: number | null
          transferencia_diferencia: number | null
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
          efectivo_deposito?: number | null
          efectivo_esperado?: number | null
          folio_secuencial?: number | null
          fondo_siguiente_turno?: number | null
          generado_by?: string | null
          id?: string
          pharmacy_shift_id?: string | null
          requiere_autorizacion?: boolean
          tarjeta_tpv_declarado?: number | null
          tarjeta_tpv_diferencia?: number | null
          tipo?: string
          total_efectivo?: number
          total_general?: number
          total_otros?: number
          total_tarjeta?: number
          total_transferencia?: number
          transferencia_declarado?: number | null
          transferencia_diferencia?: number | null
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
          efectivo_deposito?: number | null
          efectivo_esperado?: number | null
          folio_secuencial?: number | null
          fondo_siguiente_turno?: number | null
          generado_by?: string | null
          id?: string
          pharmacy_shift_id?: string | null
          requiere_autorizacion?: boolean
          tarjeta_tpv_declarado?: number | null
          tarjeta_tpv_diferencia?: number | null
          tipo?: string
          total_efectivo?: number
          total_general?: number
          total_otros?: number
          total_tarjeta?: number
          total_transferencia?: number
          transferencia_declarado?: number | null
          transferencia_diferencia?: number | null
          turno_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cortes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
      cotizaciones: {
        Row: {
          clinic_id: string
          created_at: string | null
          created_by: string | null
          fecha_cotizacion: string
          folio: string
          id: string
          iva_centavos: number
          notas: string | null
          orden_compra_id: string | null
          plazo_entrega_dias: number | null
          proveedor_id: string
          seleccionada: boolean
          solicitud_compra_id: string | null
          subtotal_centavos: number
          total_centavos: number
          updated_at: string | null
          vigente_hasta: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          fecha_cotizacion?: string
          folio: string
          id?: string
          iva_centavos?: number
          notas?: string | null
          orden_compra_id?: string | null
          plazo_entrega_dias?: number | null
          proveedor_id: string
          seleccionada?: boolean
          solicitud_compra_id?: string | null
          subtotal_centavos?: number
          total_centavos?: number
          updated_at?: string | null
          vigente_hasta?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          fecha_cotizacion?: string
          folio?: string
          id?: string
          iva_centavos?: number
          notas?: string | null
          orden_compra_id?: string | null
          plazo_entrega_dias?: number | null
          proveedor_id?: string
          seleccionada?: boolean
          solicitud_compra_id?: string | null
          subtotal_centavos?: number
          total_centavos?: number
          updated_at?: string | null
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_solicitud_compra_id_fkey"
            columns: ["solicitud_compra_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones_items: {
        Row: {
          cantidad: number
          cotizacion_id: string
          descripcion: string
          descuento_pct: number | null
          id: string
          iva_aplica: boolean | null
          linea_numero: number | null
          medicamento_id: string | null
          precio_unitario_centavos: number
          subtotal_centavos: number
        }
        Insert: {
          cantidad: number
          cotizacion_id: string
          descripcion: string
          descuento_pct?: number | null
          id?: string
          iva_aplica?: boolean | null
          linea_numero?: number | null
          medicamento_id?: string | null
          precio_unitario_centavos: number
          subtotal_centavos?: number
        }
        Update: {
          cantidad?: number
          cotizacion_id?: string
          descripcion?: string
          descuento_pct?: number | null
          id?: string
          iva_aplica?: boolean | null
          linea_numero?: number | null
          medicamento_id?: string | null
          precio_unitario_centavos?: number
          subtotal_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_items_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_items_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      devoluciones_items: {
        Row: {
          cantidad_devuelta: number
          created_at: string
          devolucion_id: string
          id: string
          lote_id: string | null
          medicamento_id: string
          motivo_item: string | null
          precio_unitario_centavos: number
        }
        Insert: {
          cantidad_devuelta: number
          created_at?: string
          devolucion_id: string
          id?: string
          lote_id?: string | null
          medicamento_id: string
          motivo_item?: string | null
          precio_unitario_centavos?: number
        }
        Update: {
          cantidad_devuelta?: number
          created_at?: string
          devolucion_id?: string
          id?: string
          lote_id?: string | null
          medicamento_id?: string
          motivo_item?: string | null
          precio_unitario_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_items_devolucion_id_fkey"
            columns: ["devolucion_id"]
            isOneToOne: false
            referencedRelation: "devoluciones_proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_items_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_items_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      devoluciones_proveedor: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          estatus: string
          fecha_devolucion: string
          folio: string
          id: string
          inventario_revertido: boolean
          motivo: string
          nota_credito_fecha: string | null
          nota_credito_folio: string | null
          nota_credito_monto_centavos: number | null
          notas: string | null
          orden_id: string | null
          proveedor_id: string
          recepcion_id: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          estatus?: string
          fecha_devolucion?: string
          folio: string
          id?: string
          inventario_revertido?: boolean
          motivo: string
          nota_credito_fecha?: string | null
          nota_credito_folio?: string | null
          nota_credito_monto_centavos?: number | null
          notas?: string | null
          orden_id?: string | null
          proveedor_id: string
          recepcion_id?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          estatus?: string
          fecha_devolucion?: string
          folio?: string
          id?: string
          inventario_revertido?: boolean
          motivo?: string
          nota_credito_fecha?: string | null
          nota_credito_folio?: string | null
          nota_credito_monto_centavos?: number | null
          notas?: string | null
          orden_id?: string | null
          proveedor_id?: string
          recepcion_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_proveedor_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_proveedor_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_proveedor_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_proveedor_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "recepciones_mercancia"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_bloqueos: {
        Row: {
          activo: boolean
          clinic_id: string
          created_at: string | null
          created_by: string | null
          doctor_id: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          motivo: string | null
          tipo: string
          todo_el_dia: boolean
        }
        Insert: {
          activo?: boolean
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          doctor_id: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          motivo?: string | null
          tipo?: string
          todo_el_dia?: boolean
        }
        Update: {
          activo?: boolean
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          motivo?: string | null
          tipo?: string
          todo_el_dia?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "doctor_bloqueos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_bloqueos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_calendars: {
        Row: {
          activo: boolean
          calendar_id: string
          clinic_id: string | null
          connected_at: string | null
          doctor_id: string
          google_email: string
          id: string
          token_expiry: string
          vault_access_token_id: string | null
          vault_refresh_token_id: string | null
        }
        Insert: {
          activo?: boolean
          calendar_id?: string
          clinic_id?: string | null
          connected_at?: string | null
          doctor_id: string
          google_email: string
          id?: string
          token_expiry: string
          vault_access_token_id?: string | null
          vault_refresh_token_id?: string | null
        }
        Update: {
          activo?: boolean
          calendar_id?: string
          clinic_id?: string | null
          connected_at?: string | null
          doctor_id?: string
          google_email?: string
          id?: string
          token_expiry?: string
          vault_access_token_id?: string | null
          vault_refresh_token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_calendars_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_calendars_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_contact_attempts: {
        Row: {
          appointment_id: string | null
          attempted_at: string
          channel: Database["public"]["Enums"]["doctor_contact_channel"]
          clinic_id: string | null
          contacted_by: string | null
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
          channel?: Database["public"]["Enums"]["doctor_contact_channel"]
          clinic_id?: string | null
          contacted_by?: string | null
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
          channel?: Database["public"]["Enums"]["doctor_contact_channel"]
          clinic_id?: string | null
          contacted_by?: string | null
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
            foreignKeyName: "doctor_contact_attempts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
      doctor_prescription_template_versions: {
        Row: {
          doctor_id: string
          id: string
          publish_reason: string | null
          published_at: string
          published_by: string | null
          snapshot_json: Json
          template_id: string
          version_number: number
        }
        Insert: {
          doctor_id: string
          id?: string
          publish_reason?: string | null
          published_at?: string
          published_by?: string | null
          snapshot_json?: Json
          template_id: string
          version_number?: number
        }
        Update: {
          doctor_id?: string
          id?: string
          publish_reason?: string | null
          published_at?: string
          published_by?: string | null
          snapshot_json?: Json
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_prescription_template_versions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_prescription_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "doctor_prescription_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_prescription_templates: {
        Row: {
          color_primario: string | null
          consultorio_direccion: string | null
          consultorio_email: string | null
          consultorio_nombre: string | null
          consultorio_telefono: string | null
          created_at: string
          current_version_id: string | null
          current_version_number: number
          doctor_id: string
          encabezado_extra: string | null
          firma_path: string | null
          id: string
          indicaciones_default: string | null
          logo_path: string | null
          mostrar_cedula: boolean
          mostrar_especialidad: boolean
          mostrar_firma: boolean
          mostrar_qr: boolean
          pie_pagina: string | null
          tamano_papel: string
          updated_at: string
        }
        Insert: {
          color_primario?: string | null
          consultorio_direccion?: string | null
          consultorio_email?: string | null
          consultorio_nombre?: string | null
          consultorio_telefono?: string | null
          created_at?: string
          current_version_id?: string | null
          current_version_number?: number
          doctor_id: string
          encabezado_extra?: string | null
          firma_path?: string | null
          id?: string
          indicaciones_default?: string | null
          logo_path?: string | null
          mostrar_cedula?: boolean
          mostrar_especialidad?: boolean
          mostrar_firma?: boolean
          mostrar_qr?: boolean
          pie_pagina?: string | null
          tamano_papel?: string
          updated_at?: string
        }
        Update: {
          color_primario?: string | null
          consultorio_direccion?: string | null
          consultorio_email?: string | null
          consultorio_nombre?: string | null
          consultorio_telefono?: string | null
          created_at?: string
          current_version_id?: string | null
          current_version_number?: number
          doctor_id?: string
          encabezado_extra?: string | null
          firma_path?: string | null
          id?: string
          indicaciones_default?: string | null
          logo_path?: string | null
          mostrar_cedula?: boolean
          mostrar_especialidad?: boolean
          mostrar_firma?: boolean
          mostrar_qr?: boolean
          pie_pagina?: string | null
          tamano_papel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_prescription_templates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: true
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_current_version"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "doctor_prescription_template_versions"
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
          clinic_id: string | null
          created_at: string
          duracion_cita_min: number
          especialidad: string
          horario_fin: string
          horario_inicio: string
          id: string
          nombre: string
          operational_status: Database["public"]["Enums"]["doctor_operational_status"]
          operational_status_reason: string | null
          operational_status_until: string | null
          telefono: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          apellidos: string
          cedula_profesional?: string | null
          clinic_id?: string | null
          created_at?: string
          duracion_cita_min?: number
          especialidad: string
          horario_fin?: string
          horario_inicio?: string
          id?: string
          nombre: string
          operational_status?: Database["public"]["Enums"]["doctor_operational_status"]
          operational_status_reason?: string | null
          operational_status_until?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          apellidos?: string
          cedula_profesional?: string | null
          clinic_id?: string | null
          created_at?: string
          duracion_cita_min?: number
          especialidad?: string
          horario_fin?: string
          horario_inicio?: string
          id?: string
          nombre?: string
          operational_status?: Database["public"]["Enums"]["doctor_operational_status"]
          operational_status_reason?: string | null
          operational_status_until?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas_turno: {
        Row: {
          clinic_id: string
          closed_at: string | null
          created_at: string
          enfermera_entrega: string | null
          enfermera_recibe: string | null
          fecha: string
          id: string
          pacientes_json: Json
          pendientes_json: Json
          resumen: string | null
          sala: string
          turno: string
        }
        Insert: {
          clinic_id: string
          closed_at?: string | null
          created_at?: string
          enfermera_entrega?: string | null
          enfermera_recibe?: string | null
          fecha?: string
          id?: string
          pacientes_json?: Json
          pendientes_json?: Json
          resumen?: string | null
          sala: string
          turno: string
        }
        Update: {
          clinic_id?: string
          closed_at?: string | null
          created_at?: string
          enfermera_entrega?: string | null
          enfermera_recibe?: string | null
          fecha?: string
          id?: string
          pacientes_json?: Json
          pendientes_json?: Json
          resumen?: string | null
          sala?: string
          turno?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregas_turno_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      expediente_permissions: {
        Row: {
          clinic_id: string
          created_at: string
          doctor_id: string
          expediente_id: string
          granted_by: string | null
          id: string
          permission: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          doctor_id: string
          expediente_id: string
          granted_by?: string | null
          id?: string
          permission: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          doctor_id?: string
          expediente_id?: string
          granted_by?: string | null
          id?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "expediente_permissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expediente_permissions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expediente_permissions_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expediente_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      expedientes: {
        Row: {
          activo: boolean
          clinic_id: string | null
          created_at: string
          doctor_id: string
          id: string
          patient_id: string
          tipo: Database["public"]["Enums"]["expediente_tipo"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clinic_id?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          patient_id: string
          tipo?: Database["public"]["Enums"]["expediente_tipo"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          patient_id?: string
          tipo?: Database["public"]["Enums"]["expediente_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedientes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
      facturas_proveedor: {
        Row: {
          archivo_pdf_url: string | null
          archivo_xml_url: string | null
          cfdi_parseado: boolean
          clinic_id: string
          concepto: string | null
          created_at: string
          created_by: string | null
          es_provisional: boolean
          estatus: string
          fecha_factura: string
          fecha_vencimiento: string
          folio_interno: string
          fp_cfdi_id: string | null
          id: string
          iva_centavos: number
          match_alertas_count: number
          match_diferencia_centavos: number | null
          match_notas: string | null
          match_oc_total_centavos: number | null
          match_recepcion_total_centavos: number | null
          match_revisado_at: string | null
          match_revisado_by: string | null
          match_status: string
          moneda: string
          notas: string | null
          orden_id: string | null
          proveedor_id: string
          recepcion_id: string | null
          saldo_pendiente_centavos: number
          serie_folio_proveedor: string | null
          subtotal_centavos: number
          tiene_alertas_criticas: boolean
          tipo_cambio: number
          total_centavos: number
          ultima_notificacion_vencimiento_at: string | null
          updated_at: string
          uuid_sat: string | null
        }
        Insert: {
          archivo_pdf_url?: string | null
          archivo_xml_url?: string | null
          cfdi_parseado?: boolean
          clinic_id: string
          concepto?: string | null
          created_at?: string
          created_by?: string | null
          es_provisional?: boolean
          estatus?: string
          fecha_factura: string
          fecha_vencimiento: string
          folio_interno: string
          fp_cfdi_id?: string | null
          id?: string
          iva_centavos?: number
          match_alertas_count?: number
          match_diferencia_centavos?: number | null
          match_notas?: string | null
          match_oc_total_centavos?: number | null
          match_recepcion_total_centavos?: number | null
          match_revisado_at?: string | null
          match_revisado_by?: string | null
          match_status?: string
          moneda?: string
          notas?: string | null
          orden_id?: string | null
          proveedor_id: string
          recepcion_id?: string | null
          saldo_pendiente_centavos: number
          serie_folio_proveedor?: string | null
          subtotal_centavos: number
          tiene_alertas_criticas?: boolean
          tipo_cambio?: number
          total_centavos: number
          ultima_notificacion_vencimiento_at?: string | null
          updated_at?: string
          uuid_sat?: string | null
        }
        Update: {
          archivo_pdf_url?: string | null
          archivo_xml_url?: string | null
          cfdi_parseado?: boolean
          clinic_id?: string
          concepto?: string | null
          created_at?: string
          created_by?: string | null
          es_provisional?: boolean
          estatus?: string
          fecha_factura?: string
          fecha_vencimiento?: string
          folio_interno?: string
          fp_cfdi_id?: string | null
          id?: string
          iva_centavos?: number
          match_alertas_count?: number
          match_diferencia_centavos?: number | null
          match_notas?: string | null
          match_oc_total_centavos?: number | null
          match_recepcion_total_centavos?: number | null
          match_revisado_at?: string | null
          match_revisado_by?: string | null
          match_status?: string
          moneda?: string
          notas?: string | null
          orden_id?: string | null
          proveedor_id?: string
          recepcion_id?: string | null
          saldo_pendiente_centavos?: number
          serie_folio_proveedor?: string | null
          subtotal_centavos?: number
          tiene_alertas_criticas?: boolean
          tipo_cambio?: number
          total_centavos?: number
          ultima_notificacion_vencimiento_at?: string | null
          updated_at?: string
          uuid_sat?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturas_proveedor_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_fp_cfdi_id_fkey"
            columns: ["fp_cfdi_id"]
            isOneToOne: false
            referencedRelation: "fp_cfdi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "recepciones_mercancia"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          activo: boolean
          aprobado: boolean
          clinic_id: string | null
          created_at: string
          id: string
          origen: string
          pregunta: string
          respuesta: string
          roles: string[]
          ruta_activa: string | null
          triggers: string[]
          updated_at: string
          uso_count: number
        }
        Insert: {
          activo?: boolean
          aprobado?: boolean
          clinic_id?: string | null
          created_at?: string
          id?: string
          origen?: string
          pregunta: string
          respuesta: string
          roles?: string[]
          ruta_activa?: string | null
          triggers?: string[]
          updated_at?: string
          uso_count?: number
        }
        Update: {
          activo?: boolean
          aprobado?: boolean
          clinic_id?: string | null
          created_at?: string
          id?: string
          origen?: string
          pregunta?: string
          respuesta?: string
          roles?: string[]
          ruta_activa?: string | null
          triggers?: string[]
          updated_at?: string
          uso_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "faq_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
          pharmacy_shift_id: string | null
          registrado_by: string
          tipo: string
          turno_id: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          monto: number
          motivo: string
          pharmacy_shift_id?: string | null
          registrado_by: string
          tipo: string
          turno_id?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          monto?: number
          motivo?: string
          pharmacy_shift_id?: string | null
          registrado_by?: string
          tipo?: string
          turno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fondos_movimientos_pharmacy_shift_id_fkey"
            columns: ["pharmacy_shift_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_cash_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fondos_movimientos_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      fp_cfdi: {
        Row: {
          clinic_id: string
          conceptos_json: Json
          created_at: string | null
          descuento_centavos: number
          errores_aritmeticos: string[] | null
          estado_sat: string | null
          factura_proveedor_id: string
          fecha_cfdi: string
          fecha_consulta_sat: string | null
          fecha_timbrado: string | null
          folio: string | null
          forma_pago: string | null
          id: string
          iva_centavos: number
          metodo_pago: string | null
          moneda: string | null
          nombre_emisor: string | null
          nombre_receptor: string | null
          rfc_emisor: string
          rfc_receptor: string | null
          serie: string | null
          subtotal_centavos: number
          tipo_comprobante: string | null
          total_centavos: number
          updated_at: string | null
          uuid_cfdi: string
          xml_raw: string | null
        }
        Insert: {
          clinic_id: string
          conceptos_json?: Json
          created_at?: string | null
          descuento_centavos?: number
          errores_aritmeticos?: string[] | null
          estado_sat?: string | null
          factura_proveedor_id: string
          fecha_cfdi: string
          fecha_consulta_sat?: string | null
          fecha_timbrado?: string | null
          folio?: string | null
          forma_pago?: string | null
          id?: string
          iva_centavos?: number
          metodo_pago?: string | null
          moneda?: string | null
          nombre_emisor?: string | null
          nombre_receptor?: string | null
          rfc_emisor: string
          rfc_receptor?: string | null
          serie?: string | null
          subtotal_centavos?: number
          tipo_comprobante?: string | null
          total_centavos?: number
          updated_at?: string | null
          uuid_cfdi: string
          xml_raw?: string | null
        }
        Update: {
          clinic_id?: string
          conceptos_json?: Json
          created_at?: string | null
          descuento_centavos?: number
          errores_aritmeticos?: string[] | null
          estado_sat?: string | null
          factura_proveedor_id?: string
          fecha_cfdi?: string
          fecha_consulta_sat?: string | null
          fecha_timbrado?: string | null
          folio?: string | null
          forma_pago?: string | null
          id?: string
          iva_centavos?: number
          metodo_pago?: string | null
          moneda?: string | null
          nombre_emisor?: string | null
          nombre_receptor?: string | null
          rfc_emisor?: string
          rfc_receptor?: string | null
          serie?: string | null
          subtotal_centavos?: number
          tipo_comprobante?: string | null
          total_centavos?: number
          updated_at?: string | null
          uuid_cfdi?: string
          xml_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fp_cfdi_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fp_cfdi_factura_proveedor_id_fkey"
            columns: ["factura_proveedor_id"]
            isOneToOne: false
            referencedRelation: "facturas_proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      fp_cfdi_lineas: {
        Row: {
          alertas: Json | null
          cantidad: number
          clave_prod_serv: string | null
          clave_unidad: string | null
          clinic_id: string
          created_at: string | null
          descripcion: string
          descuento_centavos: number | null
          dif_cantidad_vs_oc: number | null
          dif_cantidad_vs_recepcion: number | null
          dif_precio_pct: number | null
          fp_cfdi_id: string
          id: string
          importe_centavos: number
          iva_centavos: number | null
          linea_numero: number | null
          match_method: string | null
          match_score: number | null
          match_validado: boolean | null
          medicamento_id: string | null
          no_identificacion: string | null
          objeto_imp: string | null
          oc_cantidad_pedida: number | null
          oc_precio_unit_centavos: number | null
          recepcion_cantidad_recibida: number | null
          tasa_iva: number | null
          tiene_alerta_critica: boolean | null
          total_centavos: number
          valor_unitario_centavos: number
        }
        Insert: {
          alertas?: Json | null
          cantidad: number
          clave_prod_serv?: string | null
          clave_unidad?: string | null
          clinic_id: string
          created_at?: string | null
          descripcion: string
          descuento_centavos?: number | null
          dif_cantidad_vs_oc?: number | null
          dif_cantidad_vs_recepcion?: number | null
          dif_precio_pct?: number | null
          fp_cfdi_id: string
          id?: string
          importe_centavos: number
          iva_centavos?: number | null
          linea_numero?: number | null
          match_method?: string | null
          match_score?: number | null
          match_validado?: boolean | null
          medicamento_id?: string | null
          no_identificacion?: string | null
          objeto_imp?: string | null
          oc_cantidad_pedida?: number | null
          oc_precio_unit_centavos?: number | null
          recepcion_cantidad_recibida?: number | null
          tasa_iva?: number | null
          tiene_alerta_critica?: boolean | null
          total_centavos: number
          valor_unitario_centavos: number
        }
        Update: {
          alertas?: Json | null
          cantidad?: number
          clave_prod_serv?: string | null
          clave_unidad?: string | null
          clinic_id?: string
          created_at?: string | null
          descripcion?: string
          descuento_centavos?: number | null
          dif_cantidad_vs_oc?: number | null
          dif_cantidad_vs_recepcion?: number | null
          dif_precio_pct?: number | null
          fp_cfdi_id?: string
          id?: string
          importe_centavos?: number
          iva_centavos?: number | null
          linea_numero?: number | null
          match_method?: string | null
          match_score?: number | null
          match_validado?: boolean | null
          medicamento_id?: string | null
          no_identificacion?: string | null
          objeto_imp?: string | null
          oc_cantidad_pedida?: number | null
          oc_precio_unit_centavos?: number | null
          recepcion_cantidad_recibida?: number | null
          tasa_iva?: number | null
          tiene_alerta_critica?: boolean | null
          total_centavos?: number
          valor_unitario_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "fp_cfdi_lineas_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fp_cfdi_lineas_fp_cfdi_id_fkey"
            columns: ["fp_cfdi_id"]
            isOneToOne: false
            referencedRelation: "fp_cfdi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fp_cfdi_lineas_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      identidades_canal: {
        Row: {
          canal_id: string | null
          clinic_id: string | null
          created_at: string | null
          display_name: string | null
          external_id: string
          id: string
          metadata: Json | null
          patient_id: string | null
        }
        Insert: {
          canal_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          display_name?: string | null
          external_id: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
        }
        Update: {
          canal_id?: string | null
          clinic_id?: string | null
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
            foreignKeyName: "identidades_canal_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
        Relationships: [
          {
            foreignKeyName: "impresoras_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
      journey_instance_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          journey_instance_id: string
          journey_instance_step_id: string | null
          new_value_json: Json | null
          old_value_json: Json | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          journey_instance_id: string
          journey_instance_step_id?: string | null
          new_value_json?: Json | null
          old_value_json?: Json | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          journey_instance_id?: string
          journey_instance_step_id?: string | null
          new_value_json?: Json | null
          old_value_json?: Json | null
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_instance_audit_journey_instance_id_fkey"
            columns: ["journey_instance_id"]
            isOneToOne: false
            referencedRelation: "journey_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_instance_audit_journey_instance_step_id_fkey"
            columns: ["journey_instance_step_id"]
            isOneToOne: false
            referencedRelation: "journey_instance_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_instance_overrides: {
        Row: {
          authorized_at: string | null
          authorized_by: string | null
          created_at: string
          id: string
          journey_instance_id: string
          journey_instance_step_id: string
          reason: string
          requested_by: string | null
          risk_acknowledgement: string
          status: string
        }
        Insert: {
          authorized_at?: string | null
          authorized_by?: string | null
          created_at?: string
          id?: string
          journey_instance_id: string
          journey_instance_step_id: string
          reason: string
          requested_by?: string | null
          risk_acknowledgement?: string
          status?: string
        }
        Update: {
          authorized_at?: string | null
          authorized_by?: string | null
          created_at?: string
          id?: string
          journey_instance_id?: string
          journey_instance_step_id?: string
          reason?: string
          requested_by?: string | null
          risk_acknowledgement?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_instance_overrides_journey_instance_id_fkey"
            columns: ["journey_instance_id"]
            isOneToOne: false
            referencedRelation: "journey_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_instance_overrides_journey_instance_step_id_fkey"
            columns: ["journey_instance_step_id"]
            isOneToOne: false
            referencedRelation: "journey_instance_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_instance_step_data: {
        Row: {
          created_at: string
          created_by: string | null
          data_json: Json
          id: string
          journey_instance_step_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_json?: Json
          id?: string
          journey_instance_step_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_json?: Json
          id?: string
          journey_instance_step_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_instance_step_data_journey_instance_step_id_fkey"
            columns: ["journey_instance_step_id"]
            isOneToOne: true
            referencedRelation: "journey_instance_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_instance_steps: {
        Row: {
          assigned_to: string | null
          blocked_reason: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          journey_instance_id: string
          next_action: string | null
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          status: string
          step_key: string
          step_name: string
          step_order: number
        }
        Insert: {
          assigned_to?: string | null
          blocked_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          journey_instance_id: string
          next_action?: string | null
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          status?: string
          step_key: string
          step_name: string
          step_order?: number
        }
        Update: {
          assigned_to?: string | null
          blocked_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          journey_instance_id?: string
          next_action?: string | null
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          status?: string
          step_key?: string
          step_name?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "journey_instance_steps_journey_instance_id_fkey"
            columns: ["journey_instance_id"]
            isOneToOne: false
            referencedRelation: "journey_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_instances: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          patient_id: string | null
          snapshot_json: Json | null
          status: string
          template_id: string | null
          template_version_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          snapshot_json?: Json | null
          status?: string
          template_id?: string | null
          template_version_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          snapshot_json?: Json | null
          status?: string
          template_id?: string | null
          template_version_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_instances_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_instances_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "journey_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_instances_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_option_catalogs: {
        Row: {
          applies_to_step_type: string | null
          catalog_key: string
          catalog_name: string
          created_at: string
          id: string
        }
        Insert: {
          applies_to_step_type?: string | null
          catalog_key: string
          catalog_name: string
          created_at?: string
          id?: string
        }
        Update: {
          applies_to_step_type?: string | null
          catalog_key?: string
          catalog_name?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      journey_option_items: {
        Row: {
          catalog_id: string
          created_at: string
          id: string
          is_active: boolean
          option_label: string
          option_value: string
          sort_order: number
        }
        Insert: {
          catalog_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          option_label: string
          option_value: string
          sort_order?: number
        }
        Update: {
          catalog_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          option_label?: string
          option_value?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "journey_option_items_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "journey_option_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_step_definitions: {
        Row: {
          allow_not_applicable: boolean
          allowed_complete_roles: string[]
          allowed_edit_roles: string[]
          allowed_override_roles: string[]
          blocks_progress: boolean
          created_at: string
          id: string
          is_critical: boolean
          is_required: boolean
          max_recommended_minutes: number | null
          requires_document: boolean
          requires_responsible: boolean
          step_description: string | null
          step_key: string
          step_name: string
          step_order: number
          step_type: string
          template_version_id: string
        }
        Insert: {
          allow_not_applicable?: boolean
          allowed_complete_roles?: string[]
          allowed_edit_roles?: string[]
          allowed_override_roles?: string[]
          blocks_progress?: boolean
          created_at?: string
          id?: string
          is_critical?: boolean
          is_required?: boolean
          max_recommended_minutes?: number | null
          requires_document?: boolean
          requires_responsible?: boolean
          step_description?: string | null
          step_key: string
          step_name: string
          step_order?: number
          step_type?: string
          template_version_id: string
        }
        Update: {
          allow_not_applicable?: boolean
          allowed_complete_roles?: string[]
          allowed_edit_roles?: string[]
          allowed_override_roles?: string[]
          blocks_progress?: boolean
          created_at?: string
          id?: string
          is_critical?: boolean
          is_required?: boolean
          max_recommended_minutes?: number | null
          requires_document?: boolean
          requires_responsible?: boolean
          step_description?: string | null
          step_key?: string
          step_name?: string
          step_order?: number
          step_type?: string
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_step_definitions_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_step_fields: {
        Row: {
          created_at: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_required: boolean
          sort_order: number
          step_definition_id: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          is_required?: boolean
          sort_order?: number
          step_definition_id: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_required?: boolean
          sort_order?: number
          step_definition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_step_fields_step_definition_id_fkey"
            columns: ["step_definition_id"]
            isOneToOne: false
            referencedRelation: "journey_step_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_template_versions: {
        Row: {
          config_json: Json | null
          created_at: string
          id: string
          publish_reason: string | null
          published_at: string | null
          status: string
          template_id: string
          version_number: number
        }
        Insert: {
          config_json?: Json | null
          created_at?: string
          id?: string
          publish_reason?: string | null
          published_at?: string | null
          status?: string
          template_id: string
          version_number?: number
        }
        Update: {
          config_json?: Json | null
          created_at?: string
          id?: string
          publish_reason?: string | null
          published_at?: string | null
          status?: string
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "journey_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "journey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_templates: {
        Row: {
          active_version_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          type: string
        }
        Insert: {
          active_version_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          type?: string
        }
        Update: {
          active_version_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_active_version"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_validation_rules: {
        Row: {
          action_json: Json
          condition_json: Json
          created_at: string
          id: string
          is_active: boolean
          rule_name: string
          severity: string
          source_step_key: string
          template_version_id: string
        }
        Insert: {
          action_json?: Json
          condition_json?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          rule_name: string
          severity?: string
          source_step_key: string
          template_version_id: string
        }
        Update: {
          action_json?: Json
          condition_json?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          rule_name?: string
          severity?: string
          source_step_key?: string
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_validation_rules_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
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
      libro_control_controlados: {
        Row: {
          cerrado: boolean
          clinic_id: string
          created_at: string | null
          folio_cofepris: string | null
          id: string
          medicamento_id: string
          notas: string | null
          periodo_fin: string | null
          periodo_inicio: string
          responsable_sanitario: string | null
          updated_at: string | null
        }
        Insert: {
          cerrado?: boolean
          clinic_id: string
          created_at?: string | null
          folio_cofepris?: string | null
          id?: string
          medicamento_id: string
          notas?: string | null
          periodo_fin?: string | null
          periodo_inicio: string
          responsable_sanitario?: string | null
          updated_at?: string | null
        }
        Update: {
          cerrado?: boolean
          clinic_id?: string
          created_at?: string | null
          folio_cofepris?: string | null
          id?: string
          medicamento_id?: string
          notas?: string | null
          periodo_fin?: string | null
          periodo_inicio?: string
          responsable_sanitario?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "libro_control_controlados_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_control_controlados_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      libro_control_movimientos: {
        Row: {
          cantidad: number
          cedula_medico: string | null
          clinic_id: string
          created_at: string | null
          diagnostico: string | null
          fecha_caducidad: string | null
          fecha_movimiento: string
          firmado_at: string | null
          firmado_by: string | null
          id: string
          libro_id: string
          lote_id: string | null
          medicamento_id: string
          nombre_medico: string | null
          nombre_paciente: string | null
          notas: string | null
          numero_factura: string | null
          numero_lote: string | null
          numero_receta: string | null
          orden_id: string | null
          proveedor_id: string | null
          recepcion_id: string | null
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
        }
        Insert: {
          cantidad: number
          cedula_medico?: string | null
          clinic_id: string
          created_at?: string | null
          diagnostico?: string | null
          fecha_caducidad?: string | null
          fecha_movimiento?: string
          firmado_at?: string | null
          firmado_by?: string | null
          id?: string
          libro_id: string
          lote_id?: string | null
          medicamento_id: string
          nombre_medico?: string | null
          nombre_paciente?: string | null
          notas?: string | null
          numero_factura?: string | null
          numero_lote?: string | null
          numero_receta?: string | null
          orden_id?: string | null
          proveedor_id?: string | null
          recepcion_id?: string | null
          saldo_anterior?: number
          saldo_posterior?: number
          tipo: string
        }
        Update: {
          cantidad?: number
          cedula_medico?: string | null
          clinic_id?: string
          created_at?: string | null
          diagnostico?: string | null
          fecha_caducidad?: string | null
          fecha_movimiento?: string
          firmado_at?: string | null
          firmado_by?: string | null
          id?: string
          libro_id?: string
          lote_id?: string | null
          medicamento_id?: string
          nombre_medico?: string | null
          nombre_paciente?: string | null
          notas?: string | null
          numero_factura?: string | null
          numero_lote?: string | null
          numero_receta?: string | null
          orden_id?: string | null
          proveedor_id?: string | null
          recepcion_id?: string | null
          saldo_anterior?: number
          saldo_posterior?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "libro_control_movimientos_libro_id_fkey"
            columns: ["libro_id"]
            isOneToOne: false
            referencedRelation: "libro_control_controlados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_control_movimientos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_control_movimientos_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_control_movimientos_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_control_movimientos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_control_movimientos_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "recepciones_mercancia"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_medicamento: {
        Row: {
          clinic_id: string | null
          costo_unitario: number | null
          costo_unitario_centavos: number | null
          created_at: string
          existencia: number
          fecha_caducidad: string
          fecha_entrada: string
          id: string
          medicamento_id: string
          numero_lote: string
          orden_compra_id: string | null
          proveedor_id: string | null
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          costo_unitario?: number | null
          costo_unitario_centavos?: number | null
          created_at?: string
          existencia?: number
          fecha_caducidad: string
          fecha_entrada?: string
          id?: string
          medicamento_id: string
          numero_lote: string
          orden_compra_id?: string | null
          proveedor_id?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          costo_unitario?: number | null
          costo_unitario_centavos?: number | null
          created_at?: string
          existencia?: number
          fecha_caducidad?: string
          fecha_entrada?: string
          id?: string
          medicamento_id?: string
          numero_lote?: string
          orden_compra_id?: string | null
          proveedor_id?: string | null
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
          {
            foreignKeyName: "lotes_medicamento_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_consultas: {
        Row: {
          clinic_id: string | null
          created_at: string
          id: string
          manual_id: string
          user_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          manual_id: string
          user_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          manual_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_consultas_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_consultas_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "manual_paginas"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_paginas: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          modulo: string
          ruta: string
          slug: string
          titulo: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          modulo: string
          ruta: string
          slug: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          modulo?: string
          ruta?: string
          slug?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      medicamento_codigos_proveedor: {
        Row: {
          activo: boolean
          clave_prod_serv: string | null
          codigo_proveedor: string
          created_at: string | null
          descripcion_proveedor: string | null
          id: string
          medicamento_id: string
          proveedor_id: string
        }
        Insert: {
          activo?: boolean
          clave_prod_serv?: string | null
          codigo_proveedor: string
          created_at?: string | null
          descripcion_proveedor?: string | null
          id?: string
          medicamento_id: string
          proveedor_id: string
        }
        Update: {
          activo?: boolean
          clave_prod_serv?: string | null
          codigo_proveedor?: string
          created_at?: string | null
          descripcion_proveedor?: string | null
          id?: string
          medicamento_id?: string
          proveedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicamento_codigos_proveedor_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicamento_codigos_proveedor_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamento_proveedores: {
        Row: {
          activo: boolean
          codigo_proveedor: string | null
          created_at: string | null
          id: string
          iva_aplica: boolean
          maximo_pedido: number | null
          medicamento_id: string
          minimo_pedido: number
          multiplo_pedido: number
          notas: string | null
          plazo_entrega_dias: number
          precio_pactado_centavos: number
          precio_vigente_desde: string
          precio_vigente_hasta: string | null
          proveedor_id: string
          proveedor_orden: number
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          codigo_proveedor?: string | null
          created_at?: string | null
          id?: string
          iva_aplica?: boolean
          maximo_pedido?: number | null
          medicamento_id: string
          minimo_pedido?: number
          multiplo_pedido?: number
          notas?: string | null
          plazo_entrega_dias?: number
          precio_pactado_centavos: number
          precio_vigente_desde?: string
          precio_vigente_hasta?: string | null
          proveedor_id: string
          proveedor_orden?: number
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          codigo_proveedor?: string | null
          created_at?: string | null
          id?: string
          iva_aplica?: boolean
          maximo_pedido?: number | null
          medicamento_id?: string
          minimo_pedido?: number
          multiplo_pedido?: number
          notas?: string | null
          plazo_entrega_dias?: number
          precio_pactado_centavos?: number
          precio_vigente_desde?: string
          precio_vigente_hasta?: string | null
          proveedor_id?: string
          proveedor_orden?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicamento_proveedores_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicamento_proveedores_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamentos: {
        Row: {
          activo: boolean
          advertencias: string | null
          allow_direct_sale: boolean
          barcode: string | null
          categoria: string
          clave_cuadro_basico: string | null
          clinic_id: string | null
          codigo_interno: string | null
          concentracion: string | null
          contraindicaciones: string | null
          created_at: string
          descripcion: string | null
          equivalence_group_key: string | null
          forma_farmaceutica: string | null
          fuente_info: string | null
          grupo_terapeutico: string | null
          id: string
          indicaciones_uso: string | null
          interacciones_relevantes: string | null
          is_controlled: boolean
          laboratorio: string | null
          nombre: string
          precio_unitario: number
          presentacion: string | null
          principio_activo: string | null
          registro_cofepris: string | null
          registro_sanitario: string | null
          regulatory_notes: string | null
          requires_prescription: boolean
          requires_retained_prescription: boolean
          requires_special_prescription: boolean
          sale_type: string
          sku: string | null
          stock_maximo: number
          stock_minimo: number
          tasa_iva: number
          tipo_control: string
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          advertencias?: string | null
          allow_direct_sale?: boolean
          barcode?: string | null
          categoria: string
          clave_cuadro_basico?: string | null
          clinic_id?: string | null
          codigo_interno?: string | null
          concentracion?: string | null
          contraindicaciones?: string | null
          created_at?: string
          descripcion?: string | null
          equivalence_group_key?: string | null
          forma_farmaceutica?: string | null
          fuente_info?: string | null
          grupo_terapeutico?: string | null
          id?: string
          indicaciones_uso?: string | null
          interacciones_relevantes?: string | null
          is_controlled?: boolean
          laboratorio?: string | null
          nombre: string
          precio_unitario?: number
          presentacion?: string | null
          principio_activo?: string | null
          registro_cofepris?: string | null
          registro_sanitario?: string | null
          regulatory_notes?: string | null
          requires_prescription?: boolean
          requires_retained_prescription?: boolean
          requires_special_prescription?: boolean
          sale_type?: string
          sku?: string | null
          stock_maximo?: number
          stock_minimo?: number
          tasa_iva?: number
          tipo_control?: string
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          advertencias?: string | null
          allow_direct_sale?: boolean
          barcode?: string | null
          categoria?: string
          clave_cuadro_basico?: string | null
          clinic_id?: string | null
          codigo_interno?: string | null
          concentracion?: string | null
          contraindicaciones?: string | null
          created_at?: string
          descripcion?: string | null
          equivalence_group_key?: string | null
          forma_farmaceutica?: string | null
          fuente_info?: string | null
          grupo_terapeutico?: string | null
          id?: string
          indicaciones_uso?: string | null
          interacciones_relevantes?: string | null
          is_controlled?: boolean
          laboratorio?: string | null
          nombre?: string
          precio_unitario?: number
          presentacion?: string | null
          principio_activo?: string | null
          registro_cofepris?: string | null
          registro_sanitario?: string | null
          regulatory_notes?: string | null
          requires_prescription?: boolean
          requires_retained_prescription?: boolean
          requires_special_prescription?: boolean
          sale_type?: string
          sku?: string | null
          stock_maximo?: number
          stock_minimo?: number
          tasa_iva?: number
          tipo_control?: string
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicamentos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes: {
        Row: {
          clinic_id: string | null
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
          clinic_id?: string | null
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
          clinic_id?: string | null
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
            foreignKeyName: "mensajes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "metodos_pago_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_alerts: {
        Row: {
          alert_status: string | null
          alert_type: string | null
          analysis_notes: string | null
          analyzed: boolean | null
          created_at: string | null
          email_body_text: string | null
          email_message_id: string | null
          email_received_at: string | null
          email_subject: string | null
          error_message: string | null
          fix_applied: boolean | null
          fix_description: string | null
          http_status_code: number | null
          id: string
          incident_id: string | null
          monitor_name: string | null
          monitor_url: string | null
          raw_data: Json | null
          response_time_ms: number | null
          source: string
        }
        Insert: {
          alert_status?: string | null
          alert_type?: string | null
          analysis_notes?: string | null
          analyzed?: boolean | null
          created_at?: string | null
          email_body_text?: string | null
          email_message_id?: string | null
          email_received_at?: string | null
          email_subject?: string | null
          error_message?: string | null
          fix_applied?: boolean | null
          fix_description?: string | null
          http_status_code?: number | null
          id?: string
          incident_id?: string | null
          monitor_name?: string | null
          monitor_url?: string | null
          raw_data?: Json | null
          response_time_ms?: number | null
          source?: string
        }
        Update: {
          alert_status?: string | null
          alert_type?: string | null
          analysis_notes?: string | null
          analyzed?: boolean | null
          created_at?: string | null
          email_body_text?: string | null
          email_message_id?: string | null
          email_received_at?: string | null
          email_subject?: string | null
          error_message?: string | null
          fix_applied?: boolean | null
          fix_description?: string | null
          http_status_code?: number | null
          id?: string
          incident_id?: string | null
          monitor_name?: string | null
          monitor_url?: string | null
          raw_data?: Json | null
          response_time_ms?: number | null
          source?: string
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
            foreignKeyName: "movimientos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
          clinic_id: string | null
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
          clinic_id?: string | null
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
          clinic_id?: string | null
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
            foreignKeyName: "notas_consulta_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
      notification_rules: {
        Row: {
          channel: string
          clinic_id: string | null
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          channel?: string
          clinic_id?: string | null
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          role: string
          updated_at?: string
        }
        Update: {
          channel?: string
          clinic_id?: string | null
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      nurses: {
        Row: {
          activo: boolean
          apellidos: string
          categoria: Database["public"]["Enums"]["nurse_categoria"]
          cedula_profesional: string | null
          clinic_id: string | null
          created_at: string
          especialidad: string | null
          horario_fin: string
          horario_inicio: string
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          apellidos: string
          categoria?: Database["public"]["Enums"]["nurse_categoria"]
          cedula_profesional?: string | null
          clinic_id?: string | null
          created_at?: string
          especialidad?: string | null
          horario_fin?: string
          horario_inicio?: string
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          apellidos?: string
          categoria?: Database["public"]["Enums"]["nurse_categoria"]
          cedula_profesional?: string | null
          clinic_id?: string | null
          created_at?: string
          especialidad?: string | null
          horario_fin?: string
          horario_inicio?: string
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nurses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_compra: {
        Row: {
          aprobada_at: string | null
          aprobada_by: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          estatus: string
          fecha_emision: string
          fecha_entrega_est: string | null
          folio: string
          id: string
          iva_centavos: number
          moneda: string
          notas: string | null
          proveedor_id: string
          rechazada_motivo: string | null
          solicitud_id: string | null
          subtotal_centavos: number
          terminos_pago: number
          total_centavos: number
          updated_at: string
        }
        Insert: {
          aprobada_at?: string | null
          aprobada_by?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          estatus?: string
          fecha_emision?: string
          fecha_entrega_est?: string | null
          folio: string
          id?: string
          iva_centavos?: number
          moneda?: string
          notas?: string | null
          proveedor_id: string
          rechazada_motivo?: string | null
          solicitud_id?: string | null
          subtotal_centavos?: number
          terminos_pago?: number
          total_centavos?: number
          updated_at?: string
        }
        Update: {
          aprobada_at?: string | null
          aprobada_by?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          estatus?: string
          fecha_emision?: string
          fecha_entrega_est?: string | null
          folio?: string
          id?: string
          iva_centavos?: number
          moneda?: string
          notas?: string | null
          proveedor_id?: string
          rechazada_motivo?: string | null
          solicitud_id?: string | null
          subtotal_centavos?: number
          terminos_pago?: number
          total_centavos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_compra_items: {
        Row: {
          cantidad_pedida: number
          cantidad_recibida: number
          created_at: string
          id: string
          medicamento_id: string
          orden_id: string
          precio_unitario_centavos: number
          subtotal_centavos: number
          tasa_iva: number
        }
        Insert: {
          cantidad_pedida: number
          cantidad_recibida?: number
          created_at?: string
          id?: string
          medicamento_id: string
          orden_id: string
          precio_unitario_centavos: number
          subtotal_centavos?: number
          tasa_iva?: number
        }
        Update: {
          cantidad_pedida?: number
          cantidad_recibida?: number
          created_at?: string
          id?: string
          medicamento_id?: string
          orden_id?: string
          precio_unitario_centavos?: number
          subtotal_centavos?: number
          tasa_iva?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_items_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_items_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_proveedor: {
        Row: {
          banco_origen: string | null
          clinic_id: string
          created_at: string
          factura_id: string
          fecha_pago: string
          id: string
          metodo_pago: string
          monto_centavos: number
          notas: string | null
          proveedor_id: string
          referencia_bancaria: string | null
          registrado_por: string | null
        }
        Insert: {
          banco_origen?: string | null
          clinic_id: string
          created_at?: string
          factura_id: string
          fecha_pago?: string
          id?: string
          metodo_pago?: string
          monto_centavos: number
          notas?: string | null
          proveedor_id: string
          referencia_bancaria?: string | null
          registrado_por?: string | null
        }
        Update: {
          banco_origen?: string | null
          clinic_id?: string
          created_at?: string
          factura_id?: string
          fecha_pago?: string
          id?: string
          metodo_pago?: string
          monto_centavos?: number
          notas?: string | null
          proveedor_id?: string
          referencia_bancaria?: string | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_proveedor_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas_proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
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
      patient_checkout_events: {
        Row: {
          appointment_id: string | null
          checked_out_by: string | null
          checkout_status: string
          checkout_type: string
          clinic_id: string | null
          created_at: string
          discharge_summary: string
          followup_date: string | null
          followup_required: boolean
          id: string
          journey_instance_id: string
          notes: string | null
          patient_id: string
        }
        Insert: {
          appointment_id?: string | null
          checked_out_by?: string | null
          checkout_status?: string
          checkout_type: string
          clinic_id?: string | null
          created_at?: string
          discharge_summary: string
          followup_date?: string | null
          followup_required?: boolean
          id?: string
          journey_instance_id: string
          notes?: string | null
          patient_id: string
        }
        Update: {
          appointment_id?: string | null
          checked_out_by?: string | null
          checkout_status?: string
          checkout_type?: string
          clinic_id?: string | null
          created_at?: string
          discharge_summary?: string
          followup_date?: string | null
          followup_required?: boolean
          id?: string
          journey_instance_id?: string
          notes?: string | null
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_checkout_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_checkout_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_checkout_events_journey_instance_id_fkey"
            columns: ["journey_instance_id"]
            isOneToOne: false
            referencedRelation: "journey_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_checkout_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_studies: {
        Row: {
          appointment_id: string | null
          archivo_url: string | null
          area_laboratorio: string | null
          clinic_id: string
          consultation_note_id: string | null
          created_at: string
          doctor_id: string
          expediente_id: string | null
          id: string
          indicaciones_paciente: string | null
          interpretacion_medica: string | null
          journey_instance_id: string | null
          justificacion_repeticion: string | null
          laboratorio_origen: string | null
          motivo: string | null
          nombre: string
          observaciones: string | null
          patient_id: string
          prioridad: string
          recibido_at: string | null
          recibido_por: string | null
          replaces_study_id: string | null
          requiere_ayuno: boolean
          resultado_resumen: string | null
          revisado_at: string | null
          revisado_por: string | null
          solicitado_at: string
          solicitado_por: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          archivo_url?: string | null
          area_laboratorio?: string | null
          clinic_id: string
          consultation_note_id?: string | null
          created_at?: string
          doctor_id: string
          expediente_id?: string | null
          id?: string
          indicaciones_paciente?: string | null
          interpretacion_medica?: string | null
          journey_instance_id?: string | null
          justificacion_repeticion?: string | null
          laboratorio_origen?: string | null
          motivo?: string | null
          nombre: string
          observaciones?: string | null
          patient_id: string
          prioridad?: string
          recibido_at?: string | null
          recibido_por?: string | null
          replaces_study_id?: string | null
          requiere_ayuno?: boolean
          resultado_resumen?: string | null
          revisado_at?: string | null
          revisado_por?: string | null
          solicitado_at?: string
          solicitado_por?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          archivo_url?: string | null
          area_laboratorio?: string | null
          clinic_id?: string
          consultation_note_id?: string | null
          created_at?: string
          doctor_id?: string
          expediente_id?: string | null
          id?: string
          indicaciones_paciente?: string | null
          interpretacion_medica?: string | null
          journey_instance_id?: string | null
          justificacion_repeticion?: string | null
          laboratorio_origen?: string | null
          motivo?: string | null
          nombre?: string
          observaciones?: string | null
          patient_id?: string
          prioridad?: string
          recibido_at?: string | null
          recibido_por?: string | null
          replaces_study_id?: string | null
          requiere_ayuno?: boolean
          resultado_resumen?: string | null
          revisado_at?: string | null
          revisado_por?: string | null
          solicitado_at?: string
          solicitado_por?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_studies_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_studies_replaces_study_id_fkey"
            columns: ["replaces_study_id"]
            isOneToOne: false
            referencedRelation: "patient_studies"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          activo: boolean
          alergias: string | null
          apellidos: string
          clinic_id: string | null
          codigo_postal: string | null
          colonia: string | null
          consentimiento_privacidad_at: string | null
          consentimiento_privacidad_version: string | null
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
          clinic_id?: string | null
          codigo_postal?: string | null
          colonia?: string | null
          consentimiento_privacidad_at?: string | null
          consentimiento_privacidad_version?: string | null
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
          clinic_id?: string | null
          codigo_postal?: string | null
          colonia?: string | null
          consentimiento_privacidad_at?: string | null
          consentimiento_privacidad_version?: string | null
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
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_config: {
        Row: {
          activo: boolean | null
          ambiente: string
          clinic_id: string
          created_at: string | null
          id: string
          metodos_habilitados: string[] | null
          proveedor: string
          stripe_publishable_key: string | null
          stripe_terminal_habilitado: boolean | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          ambiente?: string
          clinic_id: string
          created_at?: string | null
          id?: string
          metodos_habilitados?: string[] | null
          proveedor?: string
          stripe_publishable_key?: string | null
          stripe_terminal_habilitado?: boolean | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          ambiente?: string
          clinic_id?: string
          created_at?: string | null
          id?: string
          metodos_habilitados?: string[] | null
          proveedor?: string
          stripe_publishable_key?: string | null
          stripe_terminal_habilitado?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateway_config_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          cfdi_id: string | null
          clinic_id: string
          created_at: string | null
          currency: string
          id: string
          metadata: Json | null
          metodo: string | null
          payment_intent_id: string | null
          proveedor: string
          sale_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          cfdi_id?: string | null
          clinic_id: string
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          metodo?: string | null
          payment_intent_id?: string | null
          proveedor: string
          sale_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          cfdi_id?: string | null
          clinic_id?: string
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          metodo?: string | null
          payment_intent_id?: string | null
          proveedor?: string
          sale_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_cfdi_id_fkey"
            columns: ["cfdi_id"]
            isOneToOne: false
            referencedRelation: "cfdi_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "pharmacy_cash_shifts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "pharmacy_returns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "pharmacy_sale_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "pharmacy_sales_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
      post_consultation_followups: {
        Row: {
          adverse_effects: string | null
          channel: string
          clinic_id: string | null
          created_at: string
          followup_date: string
          id: string
          journey_instance_id: string
          medication_adherence: string | null
          notes: string | null
          patient_id: string
          prescription_id: string | null
          requires_new_appointment: boolean
          responsible_user_id: string | null
          status: string
          symptoms_reported: string | null
          updated_at: string
        }
        Insert: {
          adverse_effects?: string | null
          channel: string
          clinic_id?: string | null
          created_at?: string
          followup_date: string
          id?: string
          journey_instance_id: string
          medication_adherence?: string | null
          notes?: string | null
          patient_id: string
          prescription_id?: string | null
          requires_new_appointment?: boolean
          responsible_user_id?: string | null
          status?: string
          symptoms_reported?: string | null
          updated_at?: string
        }
        Update: {
          adverse_effects?: string | null
          channel?: string
          clinic_id?: string | null
          created_at?: string
          followup_date?: string
          id?: string
          journey_instance_id?: string
          medication_adherence?: string | null
          notes?: string | null
          patient_id?: string
          prescription_id?: string | null
          requires_new_appointment?: boolean
          responsible_user_id?: string | null
          status?: string
          symptoms_reported?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_consultation_followups_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_items: {
        Row: {
          brand_name: string | null
          clinic_id: string | null
          concentration: string | null
          controlled_group: string | null
          created_at: string
          dose: string
          duration: string
          frequency: string
          generic_name: string
          id: string
          instructions: string
          is_controlled: boolean
          medication_id: string | null
          pharmaceutical_form: string | null
          prescription_id: string
          presentation: string | null
          quantity: number | null
          route: string
        }
        Insert: {
          brand_name?: string | null
          clinic_id?: string | null
          concentration?: string | null
          controlled_group?: string | null
          created_at?: string
          dose: string
          duration: string
          frequency: string
          generic_name: string
          id?: string
          instructions: string
          is_controlled?: boolean
          medication_id?: string | null
          pharmaceutical_form?: string | null
          prescription_id: string
          presentation?: string | null
          quantity?: number | null
          route: string
        }
        Update: {
          brand_name?: string | null
          clinic_id?: string | null
          concentration?: string | null
          controlled_group?: string | null
          created_at?: string
          dose?: string
          duration?: string
          frequency?: string
          generic_name?: string
          id?: string
          instructions?: string
          is_controlled?: boolean
          medication_id?: string | null
          pharmaceutical_form?: string | null
          prescription_id?: string
          presentation?: string | null
          quantity?: number | null
          route?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          clinic_id: string | null
          consultation_note_id: string | null
          created_at: string
          diagnosis: string | null
          digital_signature_status: string | null
          doctor_id: string
          expediente_id: string | null
          id: string
          issue_date: string | null
          journey_instance_id: string | null
          notes: string | null
          patient_id: string
          prescription_number: string | null
          qr_code_value: string | null
          status: string
          template_id: string | null
          template_snapshot_json: Json | null
          template_version_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id?: string | null
          consultation_note_id?: string | null
          created_at?: string
          diagnosis?: string | null
          digital_signature_status?: string | null
          doctor_id: string
          expediente_id?: string | null
          id?: string
          issue_date?: string | null
          journey_instance_id?: string | null
          notes?: string | null
          patient_id: string
          prescription_number?: string | null
          qr_code_value?: string | null
          status?: string
          template_id?: string | null
          template_snapshot_json?: Json | null
          template_version_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string | null
          consultation_note_id?: string | null
          created_at?: string
          diagnosis?: string | null
          digital_signature_status?: string | null
          doctor_id?: string
          expediente_id?: string | null
          id?: string
          issue_date?: string | null
          journey_instance_id?: string | null
          notes?: string | null
          patient_id?: string
          prescription_number?: string | null
          qr_code_value?: string | null
          status?: string
          template_id?: string | null
          template_snapshot_json?: Json | null
          template_version_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_consultation_note_id_fkey"
            columns: ["consultation_note_id"]
            isOneToOne: false
            referencedRelation: "notas_consulta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_journey_instance_id_fkey"
            columns: ["journey_instance_id"]
            isOneToOne: false
            referencedRelation: "journey_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "doctor_prescription_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "doctor_prescription_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuesto_categorias: {
        Row: {
          alerta_pct: number
          categoria: string
          clinic_id: string
          created_at: string | null
          created_by: string | null
          id: string
          monto_presupuestado_centavos: number
          periodo_anio: number
          periodo_mes: number
          updated_at: string | null
        }
        Insert: {
          alerta_pct?: number
          categoria: string
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          monto_presupuestado_centavos?: number
          periodo_anio: number
          periodo_mes: number
          updated_at?: string | null
        }
        Update: {
          alerta_pct?: number
          categoria?: string
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          monto_presupuestado_centavos?: number
          periodo_anio?: number
          periodo_mes?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_categorias_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_notice_versions: {
        Row: {
          content_hash: string
          id: string
          published_at: string
          summary: string
          version: string
        }
        Insert: {
          content_hash: string
          id?: string
          published_at?: string
          summary?: string
          version: string
        }
        Update: {
          content_hash?: string
          id?: string
          published_at?: string
          summary?: string
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          supervisor_pin_hash: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          supervisor_pin_hash?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          supervisor_pin_hash?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          activo: boolean
          banco: string | null
          clabe: string | null
          clasificacion: string | null
          clinic_id: string
          contacto: string | null
          created_at: string
          domicilio_fiscal: string | null
          email: string | null
          estatus_efos: string | null
          id: string
          nombre: string
          notas: string | null
          plazo_entrega: number | null
          regimen_fiscal: string | null
          requiere_cofepris: boolean | null
          rfc: string | null
          telefono: string | null
          terminos_pago: number | null
          ultima_verificacion_efos: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          banco?: string | null
          clabe?: string | null
          clasificacion?: string | null
          clinic_id: string
          contacto?: string | null
          created_at?: string
          domicilio_fiscal?: string | null
          email?: string | null
          estatus_efos?: string | null
          id?: string
          nombre: string
          notas?: string | null
          plazo_entrega?: number | null
          regimen_fiscal?: string | null
          requiere_cofepris?: boolean | null
          rfc?: string | null
          telefono?: string | null
          terminos_pago?: number | null
          ultima_verificacion_efos?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          banco?: string | null
          clabe?: string | null
          clasificacion?: string | null
          clinic_id?: string
          contacto?: string | null
          created_at?: string
          domicilio_fiscal?: string | null
          email?: string | null
          estatus_efos?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          plazo_entrega?: number | null
          regimen_fiscal?: string | null
          requiere_cofepris?: boolean | null
          rfc?: string | null
          telefono?: string | null
          terminos_pago?: number | null
          ultima_verificacion_efos?: string | null
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
      recepciones_items: {
        Row: {
          cantidad_recibida: number
          created_at: string
          diferencia_nota: string | null
          fecha_caducidad: string | null
          id: string
          lote_id: string | null
          medicamento_id: string
          numero_lote: string | null
          orden_item_id: string | null
          precio_unitario_centavos: number
          recepcion_id: string
        }
        Insert: {
          cantidad_recibida: number
          created_at?: string
          diferencia_nota?: string | null
          fecha_caducidad?: string | null
          id?: string
          lote_id?: string | null
          medicamento_id: string
          numero_lote?: string | null
          orden_item_id?: string | null
          precio_unitario_centavos?: number
          recepcion_id: string
        }
        Update: {
          cantidad_recibida?: number
          created_at?: string
          diferencia_nota?: string | null
          fecha_caducidad?: string | null
          id?: string
          lote_id?: string | null
          medicamento_id?: string
          numero_lote?: string | null
          orden_item_id?: string | null
          precio_unitario_centavos?: number
          recepcion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recepciones_items_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recepciones_items_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recepciones_items_orden_item_id_fkey"
            columns: ["orden_item_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recepciones_items_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "recepciones_mercancia"
            referencedColumns: ["id"]
          },
        ]
      }
      recepciones_mercancia: {
        Row: {
          clinic_id: string
          created_at: string
          estatus: string
          fecha_recepcion: string
          folio_recepcion: string
          id: string
          notas: string | null
          numero_remision: string | null
          orden_id: string | null
          proveedor_id: string
          recibido_por: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          estatus?: string
          fecha_recepcion?: string
          folio_recepcion: string
          id?: string
          notas?: string | null
          numero_remision?: string | null
          orden_id?: string | null
          proveedor_id: string
          recibido_por?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          estatus?: string
          fecha_recepcion?: string
          folio_recepcion?: string
          id?: string
          notas?: string | null
          numero_remision?: string | null
          orden_id?: string | null
          proveedor_id?: string
          recibido_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recepciones_mercancia_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recepciones_mercancia_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recepciones_mercancia_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
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
      recetas_folio_contadores: {
        Row: {
          clinic_id: string
          ultimo_folio: number
        }
        Insert: {
          clinic_id: string
          ultimo_folio?: number
        }
        Update: {
          clinic_id?: string
          ultimo_folio?: number
        }
        Relationships: [
          {
            foreignKeyName: "recetas_folio_contadores_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      recordatorios_cita: {
        Row: {
          appointment_id: string | null
          clinic_id: string | null
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
          clinic_id?: string | null
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
          clinic_id?: string | null
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
            foreignKeyName: "recordatorios_cita_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
          clinic_id: string | null
          created_at: string
          equipamiento: string | null
          id: string
          nombre: string
          piso: string | null
        }
        Insert: {
          activo?: boolean
          capacidad?: number
          clinic_id?: string | null
          created_at?: string
          equipamiento?: string | null
          id?: string
          nombre: string
          piso?: string | null
        }
        Update: {
          activo?: boolean
          capacidad?: number
          clinic_id?: string | null
          created_at?: string
          equipamiento?: string | null
          id?: string
          nombre?: string
          piso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          activo: boolean | null
          clinic_id: string | null
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
          clinic_id?: string | null
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
          clinic_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          duracion_minutos?: number
          especialidad?: string
          id?: string
          nombre?: string
          precio_centavos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicios_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_compra: {
        Row: {
          aprobado_at: string | null
          aprobador_id: string | null
          aprobador_nombre: string | null
          area_solicitante: string | null
          clinic_id: string
          created_at: string | null
          estatus: string
          fecha_requerida: string | null
          fecha_solicitud: string
          folio: string
          id: string
          motivo: string
          notas: string | null
          orden_compra_id: string | null
          rechazo_motivo: string | null
          solicitante_id: string | null
          solicitante_nombre: string | null
          updated_at: string | null
        }
        Insert: {
          aprobado_at?: string | null
          aprobador_id?: string | null
          aprobador_nombre?: string | null
          area_solicitante?: string | null
          clinic_id: string
          created_at?: string | null
          estatus?: string
          fecha_requerida?: string | null
          fecha_solicitud?: string
          folio: string
          id?: string
          motivo: string
          notas?: string | null
          orden_compra_id?: string | null
          rechazo_motivo?: string | null
          solicitante_id?: string | null
          solicitante_nombre?: string | null
          updated_at?: string | null
        }
        Update: {
          aprobado_at?: string | null
          aprobador_id?: string | null
          aprobador_nombre?: string | null
          area_solicitante?: string | null
          clinic_id?: string
          created_at?: string | null
          estatus?: string
          fecha_requerida?: string | null
          fecha_solicitud?: string
          folio?: string
          id?: string
          motivo?: string
          notas?: string | null
          orden_compra_id?: string | null
          rechazo_motivo?: string | null
          solicitante_id?: string | null
          solicitante_nombre?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_compra_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_compra_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_compra_items: {
        Row: {
          cantidad: number
          created_at: string | null
          descripcion: string
          id: string
          justificacion: string | null
          medicamento_id: string | null
          precio_estimado: number | null
          solicitud_id: string
          unidad: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          descripcion: string
          id?: string
          justificacion?: string | null
          medicamento_id?: string | null
          precio_estimado?: number | null
          solicitud_id: string
          unidad?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          descripcion?: string
          id?: string
          justificacion?: string | null
          medicamento_id?: string | null
          precio_estimado?: number | null
          solicitud_id?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_compra_items_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_compra_items_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_insumos: {
        Row: {
          aprobado_por: string | null
          cantidad: number
          clinic_id: string
          created_at: string
          id: string
          medicamento_id: string
          motivo: string | null
          movimiento_id: string | null
          resolved_at: string | null
          solicitado_por: string | null
          status: string
        }
        Insert: {
          aprobado_por?: string | null
          cantidad: number
          clinic_id: string
          created_at?: string
          id?: string
          medicamento_id: string
          motivo?: string | null
          movimiento_id?: string | null
          resolved_at?: string | null
          solicitado_por?: string | null
          status?: string
        }
        Update: {
          aprobado_por?: string | null
          cantidad?: number
          clinic_id?: string
          created_at?: string
          id?: string
          medicamento_id?: string
          motivo?: string | null
          movimiento_id?: string | null
          resolved_at?: string | null
          solicitado_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_insumos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_insumos_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_insumos_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos_inventario"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_identidades_canal: {
        Row: {
          canal_id: string
          clinic_id: string | null
          created_at: string
          external_id: string
          id: string
          user_id: string
        }
        Insert: {
          canal_id?: string
          clinic_id?: string | null
          created_at?: string
          external_id: string
          id?: string
          user_id: string
        }
        Update: {
          canal_id?: string
          clinic_id?: string | null
          created_at?: string
          external_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_identidades_canal_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_link_codes: {
        Row: {
          clinic_id: string | null
          code: string
          created_at: string
          expires_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          code: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_link_codes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos: {
        Row: {
          abierto_at: string
          caja_id: string
          cajero_user_id: string
          cerrado_at: string | null
          clinic_id: string
          conteo_apertura: number | null
          created_at: string
          denominaciones_apertura: Json | null
          diferencia_apertura: number | null
          estado: string
          fondo_esperado: number | null
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
          conteo_apertura?: number | null
          created_at?: string
          denominaciones_apertura?: Json | null
          diferencia_apertura?: number | null
          estado?: string
          fondo_esperado?: number | null
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
          conteo_apertura?: number | null
          created_at?: string
          denominaciones_apertura?: Json | null
          diferencia_apertura?: number | null
          estado?: string
          fondo_esperado?: number | null
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
            foreignKeyName: "turnos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
      v_presupuesto_ejecucion: {
        Row: {
          alerta_pct: number | null
          categoria: string | null
          clinic_id: string | null
          ejecutado_centavos: number | null
          id: string | null
          monto_presupuestado_centavos: number | null
          pct_ejecutado: number | null
          periodo_anio: number | null
          periodo_mes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_categorias_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_list_auth_users: {
        Args: never
        Returns: {
          banned_until: string
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
        }[]
      }
      aprobar_solicitud_insumo: {
        Args: { p_solicitud_id: string }
        Returns: string
      }
      ayuda_chat_resolver_usuarios: {
        Args: { p_user_ids: string[] }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      can_configure_caja: { Args: { _user_id: string }; Returns: boolean }
      cancelar_citas_prueba: { Args: { dias?: number }; Returns: number }
      cfdi_get_secret: { Args: { p_id: string }; Returns: string }
      cfdi_upsert_secret: {
        Args: {
          p_description?: string
          p_existing_id: string
          p_name: string
          p_secret: string
        }
        Returns: string
      }
      chat_registrar_pendiente: {
        Args: {
          p_clinic_id: string
          p_pregunta: string
          p_respuesta?: string
          p_ruta?: string
        }
        Returns: undefined
      }
      cleanup_abandoned_bot_sesiones: { Args: never; Returns: number }
      corte_set_fondo: {
        Args: { p_corte_id: string; p_fondo_siguiente: number }
        Returns: undefined
      }
      corte_set_pago_declarado: {
        Args: { p_corte_id: string; p_declarado: number; p_metodo: string }
        Returns: number
      }
      corte_set_tarjeta_tpv: {
        Args: { p_corte_id: string; p_tpv_declarado: number }
        Returns: number
      }
      doctor_calendar_get_token: {
        Args: { p_clinic_id: string; p_doctor_id: string; p_token_type: string }
        Returns: string
      }
      doctor_calendar_upsert_token: {
        Args: {
          p_clinic_id: string
          p_doctor_id: string
          p_token_type: string
          p_token_value: string
        }
        Returns: string
      }
      faq_buscar:
        | {
            Args: { p_clinic_id?: string; p_pregunta: string; p_ruta?: string }
            Returns: {
              id: string
              respuesta: string
              uso_count: number
            }[]
          }
        | {
            Args: {
              p_clinic_id?: string
              p_pregunta: string
              p_rol?: string
              p_ruta?: string
            }
            Returns: {
              id: string
              respuesta: string
              uso_count: number
            }[]
          }
      faq_incrementar_uso: { Args: { p_id: string }; Returns: undefined }
      firmar_acta_merma: {
        Args: { p_acta_id: string; p_pin: string; p_supervisor_id: string }
        Returns: undefined
      }
      generate_prescription_number_for_doctor: {
        Args: { _doctor_id: string }
        Returns: string
      }
      get_clinic_supervisors: {
        Args: { p_clinic_id: string }
        Returns: {
          email: string
          full_name: string
          has_pin: boolean
          user_id: string
        }[]
      }
      get_corte_pago_total: {
        Args: { p_corte_id: string; p_metodo: string }
        Returns: number
      }
      get_corte_tarjeta_total: { Args: { p_corte_id: string }; Returns: number }
      get_doctor_calendars: {
        Args: { p_clinic_id: string }
        Returns: {
          doctor_id: string
          google_email: string
        }[]
      }
      get_medicamentos_en_reorden: {
        Args: { p_clinic_id: string }
        Returns: {
          codigo_proveedor: string
          iva_aplica: boolean
          medicamento_id: string
          minimo_pedido: number
          multiplo_pedido: number
          nombre_medicamento: string
          plazo_entrega_dias: number
          precio_pactado_centavos: number
          presentacion: string
          proveedor_email: string
          proveedor_id: string
          proveedor_nombre: string
          proveedor_rfc: string
          stock_actual: number
          stock_maximo: number
          stock_minimo: number
          terminos_pago: number
          tipo_control: string
        }[]
      }
      get_prescription_audit: {
        Args: { _prescription_id: string }
        Returns: {
          accion: Database["public"]["Enums"]["audit_action"]
          created_at: string
          event: string
          id: string
          payload: Json
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_lote_existencia: {
        Args: { p_cantidad: number; p_lote_id: string }
        Returns: number
      }
      is_appointment_participant: {
        Args: { _appointment_id: string }
        Returns: boolean
      }
      is_caja_staff: { Args: { _user_id: string }; Returns: boolean }
      is_clinic_staff: { Args: { _user_id: string }; Returns: boolean }
      is_global_admin: { Args: { _user_id: string }; Returns: boolean }
      list_nurses: {
        Args: never
        Returns: {
          apellidos: string
          categoria: Database["public"]["Enums"]["nurse_categoria"]
          email: string
          horario_fin: string
          horario_inicio: string
          id: string
          nombre: string
        }[]
      }
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
      multiclinic_diagnostics: { Args: never; Returns: Json }
      next_receta_folio: { Args: { p_clinic_id: string }; Returns: number }
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
              p_supervisor_id?: string
              p_supervisor_override?: boolean
            }
            Returns: Json
          }
      pharmacy_close_shift_with_pin: {
        Args: {
          p_cash_count: number
          p_notes?: string
          p_pin: string
          p_shift_id: string
          p_supervisor_id: string
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
      pharmacy_recompute_prescription_status: {
        Args: { p_prescription_id: string }
        Returns: string
      }
      pharmacy_register_return: { Args: { p_payload: Json }; Returns: string }
      pharmacy_register_sale: { Args: { p_payload: Json }; Returns: string }
      recepcion_entrada_lote: {
        Args: {
          p_cantidad: number
          p_clinic_id: string
          p_costo_unitario_centavos?: number
          p_fecha_caducidad: string
          p_medicamento_id: string
          p_numero_lote: string
          p_proveedor_id?: string
        }
        Returns: string
      }
      rechazar_solicitud_insumo: {
        Args: { p_solicitud_id: string }
        Returns: undefined
      }
      set_supervisor_pin: {
        Args: { p_pin: string; p_user_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      turno_close: {
        Args: {
          p_cash_count: number
          p_notes?: string
          p_supervisor_id?: string
          p_supervisor_override?: boolean
          p_turno_id: string
        }
        Returns: Json
      }
      turno_close_with_pin: {
        Args: {
          p_cash_count: number
          p_notes?: string
          p_pin: string
          p_supervisor_id: string
          p_turno_id: string
        }
        Returns: Json
      }
      turno_corte_x: { Args: { p_turno_id: string }; Returns: Json }
      turno_fondo_movimiento: {
        Args: {
          p_monto: number
          p_motivo: string
          p_tipo: string
          p_turno_id: string
        }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      unaccent_immutable: { Args: { "": string }; Returns: string }
      update_journey_progress: {
        Args: { _journey_instance_id: string }
        Returns: undefined
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
      audit_action:
        | "crear"
        | "actualizar"
        | "cancelar"
        | "doctor_contact_attempt_created"
        | "doctor_confirmo_por_llamada"
        | "doctor_rechazo_por_llamada"
        | "doctor_no_contesto"
        | "doctor_status_changed"
        | "conv_cerrada"
        | "cita_desde_inbox"
        | "paciente_creado_inbox"
        | "paciente_vinculado_inbox"
        | "doctor_unavailable_override"
      ayuda_chat_estado: "abierta" | "escalada" | "cerrada"
      ayuda_chat_rol_mensaje: "usuario" | "asistente_ia" | "humano" | "sistema"
      doctor_contact_channel: "phone" | "whatsapp" | "email" | "internal"
      doctor_contact_result:
        | "answered"
        | "no_answer"
        | "busy"
        | "could_attend"
        | "could_not_attend"
        | "callback_requested"
      doctor_operational_status:
        | "active"
        | "unavailable"
        | "vacation"
        | "sick_leave"
        | "suspended"
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
        | "uso_interno"
        | "merma"
        | "devolucion_proveedor"
      nurse_categoria: "licenciada" | "tecnica" | "auxiliar"
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
      audit_action: [
        "crear",
        "actualizar",
        "cancelar",
        "doctor_contact_attempt_created",
        "doctor_confirmo_por_llamada",
        "doctor_rechazo_por_llamada",
        "doctor_no_contesto",
        "doctor_status_changed",
        "conv_cerrada",
        "cita_desde_inbox",
        "paciente_creado_inbox",
        "paciente_vinculado_inbox",
        "doctor_unavailable_override",
      ],
      ayuda_chat_estado: ["abierta", "escalada", "cerrada"],
      ayuda_chat_rol_mensaje: ["usuario", "asistente_ia", "humano", "sistema"],
      doctor_contact_channel: ["phone", "whatsapp", "email", "internal"],
      doctor_contact_result: [
        "answered",
        "no_answer",
        "busy",
        "could_attend",
        "could_not_attend",
        "callback_requested",
      ],
      doctor_operational_status: [
        "active",
        "unavailable",
        "vacation",
        "sick_leave",
        "suspended",
      ],
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
        "uso_interno",
        "merma",
        "devolucion_proveedor",
      ],
      nurse_categoria: ["licenciada", "tecnica", "auxiliar"],
    },
  },
} as const
