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
          creada_por_bot: boolean
          created_at: string
          created_by: string | null
          doctor_id: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          motivo_consulta: string | null
          notas: string | null
          origen: string
          patient_id: string
          room_id: string | null
          servicio_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          creada_por_bot?: boolean
          created_at?: string
          created_by?: string | null
          doctor_id: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          motivo_consulta?: string | null
          notas?: string | null
          origen?: string
          patient_id: string
          room_id?: string | null
          servicio_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          creada_por_bot?: boolean
          created_at?: string
          created_by?: string | null
          doctor_id?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          motivo_consulta?: string | null
          notas?: string | null
          origen?: string
          patient_id?: string
          room_id?: string | null
          servicio_id?: string | null
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
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors_public"
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
      bot_sesiones: {
        Row: {
          borrador_paciente: Json
          consentimiento_dado: boolean
          consentimiento_fecha: string | null
          conversacion_id: string
          created_at: string
          doctor_id: string | null
          flow_data: Json
          flow_step: string | null
          id: string
          servicio_id: string | null
          slot_propuesto: string | null
          updated_at: string
        }
        Insert: {
          borrador_paciente?: Json
          consentimiento_dado?: boolean
          consentimiento_fecha?: string | null
          conversacion_id: string
          created_at?: string
          doctor_id?: string | null
          flow_data?: Json
          flow_step?: string | null
          id?: string
          servicio_id?: string | null
          slot_propuesto?: string | null
          updated_at?: string
        }
        Update: {
          borrador_paciente?: Json
          consentimiento_dado?: boolean
          consentimiento_fecha?: string | null
          conversacion_id?: string
          created_at?: string
          doctor_id?: string | null
          flow_data?: Json
          flow_step?: string | null
          id?: string
          servicio_id?: string | null
          slot_propuesto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_sesiones_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: true
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_sesiones_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_sesiones_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_sesiones_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
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
          timezone: string
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
          timezone?: string
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
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      consentimientos: {
        Row: {
          created_at: string
          id: string
          identidad_canal_id: string | null
          otorgado: boolean
          otorgado_at: string
          patient_id: string
          tipo: string
          version_texto: string
        }
        Insert: {
          created_at?: string
          id?: string
          identidad_canal_id?: string | null
          otorgado: boolean
          otorgado_at?: string
          patient_id: string
          tipo: string
          version_texto: string
        }
        Update: {
          created_at?: string
          id?: string
          identidad_canal_id?: string | null
          otorgado?: boolean
          otorgado_at?: string
          patient_id?: string
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
          created_at: string
          id: string
          identidad_canal_id: string
          intencion_actual: string | null
          last_message_at: string
          status: Database["public"]["Enums"]["conversacion_status"]
          updated_at: string
        }
        Insert: {
          asignada_humano_id?: string | null
          created_at?: string
          id?: string
          identidad_canal_id: string
          intencion_actual?: string | null
          last_message_at?: string
          status?: Database["public"]["Enums"]["conversacion_status"]
          updated_at?: string
        }
        Update: {
          asignada_humano_id?: string | null
          created_at?: string
          id?: string
          identidad_canal_id?: string
          intencion_actual?: string | null
          last_message_at?: string
          status?: Database["public"]["Enums"]["conversacion_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_identidad_canal_id_fkey"
            columns: ["identidad_canal_id"]
            isOneToOne: false
            referencedRelation: "identidades_canal"
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
          snapshot_json: Json
          template_id: string
          version_number: number
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
        Relationships: []
      }
      doctor_servicios: {
        Row: {
          created_at: string
          doctor_id: string
          servicio_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          servicio_id: string
        }
        Update: {
          created_at?: string
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
            foreignKeyName: "doctor_servicios_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors_public"
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
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
            foreignKeyName: "expedientes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedientes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      identidades_canal: {
        Row: {
          canal_id: Database["public"]["Enums"]["canal_tipo"]
          created_at: string
          display_name: string | null
          external_id: string
          id: string
          metadata: Json | null
          patient_id: string | null
          updated_at: string
        }
        Insert: {
          canal_id: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
          display_name?: string | null
          external_id: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          updated_at?: string
        }
        Update: {
          canal_id?: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
          display_name?: string | null
          external_id?: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "identidades_canal_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_configuration_audit: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          new_value_json: Json | null
          old_value_json: Json | null
          reason: string | null
          template_id: string | null
          user_id: string | null
          version_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          new_value_json?: Json | null
          old_value_json?: Json | null
          reason?: string | null
          template_id?: string | null
          user_id?: string | null
          version_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          new_value_json?: Json | null
          old_value_json?: Json | null
          reason?: string | null
          template_id?: string | null
          user_id?: string | null
          version_id?: string | null
        }
        Relationships: []
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
          role: string | null
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
          role?: string | null
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
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      journey_instance_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_url: string
          id: string
          journey_instance_id: string
          journey_instance_step_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_url: string
          id?: string
          journey_instance_id: string
          journey_instance_step_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          journey_instance_id?: string
          journey_instance_step_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
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
          risk_acknowledgement: string | null
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
          risk_acknowledgement?: string | null
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
          risk_acknowledgement?: string | null
          status?: string
        }
        Relationships: []
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
        Relationships: []
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
        }
        Relationships: []
      }
      journey_instances: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          patient_id: string | null
          snapshot_json: Json
          status: string
          template_id: string
          template_version_id: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          snapshot_json: Json
          status?: string
          template_id: string
          template_version_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          snapshot_json?: Json
          status?: string
          template_id?: string
          template_version_id?: string
          updated_at?: string
        }
        Relationships: [
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
          applies_to_step_key: string | null
          applies_to_step_type:
            | Database["public"]["Enums"]["journey_step_type"]
            | null
          catalog_key: string
          catalog_name: string
          created_at: string
          id: string
          is_active: boolean
        }
        Insert: {
          applies_to_step_key?: string | null
          applies_to_step_type?:
            | Database["public"]["Enums"]["journey_step_type"]
            | null
          catalog_key: string
          catalog_name: string
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Update: {
          applies_to_step_key?: string | null
          applies_to_step_type?:
            | Database["public"]["Enums"]["journey_step_type"]
            | null
          catalog_key?: string
          catalog_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      journey_option_items: {
        Row: {
          catalog_id: string
          created_at: string
          id: string
          is_active: boolean
          is_critical: boolean
          metadata: Json
          option_key: string
          option_label: string
          requires_special_role: boolean
          sort_order: number
        }
        Insert: {
          catalog_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_critical?: boolean
          metadata?: Json
          option_key: string
          option_label: string
          requires_special_role?: boolean
          sort_order?: number
        }
        Update: {
          catalog_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_critical?: boolean
          metadata?: Json
          option_key?: string
          option_label?: string
          requires_special_role?: boolean
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
          allowed_complete_roles: Json
          allowed_edit_roles: Json
          allowed_override_roles: Json
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
          step_type: Database["public"]["Enums"]["journey_step_type"]
          template_version_id: string
          updated_at: string
        }
        Insert: {
          allow_not_applicable?: boolean
          allowed_complete_roles?: Json
          allowed_edit_roles?: Json
          allowed_override_roles?: Json
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
          step_order: number
          step_type: Database["public"]["Enums"]["journey_step_type"]
          template_version_id: string
          updated_at?: string
        }
        Update: {
          allow_not_applicable?: boolean
          allowed_complete_roles?: Json
          allowed_edit_roles?: Json
          allowed_override_roles?: Json
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
          step_type?: Database["public"]["Enums"]["journey_step_type"]
          template_version_id?: string
          updated_at?: string
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
          default_value: Json | null
          editable_roles: Json
          field_key: string
          field_label: string
          field_type: Database["public"]["Enums"]["journey_field_type"]
          help_text: string | null
          id: string
          is_required: boolean
          options_source: string | null
          sort_order: number
          step_definition_id: string
          validation_json: Json
          visible_roles: Json
        }
        Insert: {
          created_at?: string
          default_value?: Json | null
          editable_roles?: Json
          field_key: string
          field_label: string
          field_type: Database["public"]["Enums"]["journey_field_type"]
          help_text?: string | null
          id?: string
          is_required?: boolean
          options_source?: string | null
          sort_order?: number
          step_definition_id: string
          validation_json?: Json
          visible_roles?: Json
        }
        Update: {
          created_at?: string
          default_value?: Json | null
          editable_roles?: Json
          field_key?: string
          field_label?: string
          field_type?: Database["public"]["Enums"]["journey_field_type"]
          help_text?: string | null
          id?: string
          is_required?: boolean
          options_source?: string | null
          sort_order?: number
          step_definition_id?: string
          validation_json?: Json
          visible_roles?: Json
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
          config_json: Json
          created_at: string
          created_by: string | null
          id: string
          publish_reason: string | null
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["journey_version_status"]
          template_id: string
          version_number: number
        }
        Insert: {
          config_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          publish_reason?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["journey_version_status"]
          template_id: string
          version_number: number
        }
        Update: {
          config_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          publish_reason?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["journey_version_status"]
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
          type: Database["public"]["Enums"]["journey_template_type"]
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          type: Database["public"]["Enums"]["journey_template_type"]
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          type?: Database["public"]["Enums"]["journey_template_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_templates_active_version_fk"
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
          severity: Database["public"]["Enums"]["journey_rule_severity"]
          source_step_key: string
          template_version_id: string
        }
        Insert: {
          action_json: Json
          condition_json: Json
          created_at?: string
          id?: string
          is_active?: boolean
          rule_name: string
          severity?: Database["public"]["Enums"]["journey_rule_severity"]
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
          severity?: Database["public"]["Enums"]["journey_rule_severity"]
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
      lotes_medicamento: {
        Row: {
          created_at: string
          existencia: number
          fecha_caducidad: string
          id: string
          medicamento_id: string
          numero_lote: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          existencia?: number
          fecha_caducidad: string
          id?: string
          medicamento_id: string
          numero_lote: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          existencia?: number
          fecha_caducidad?: string
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
          categoria: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          precio_unitario: number
          stock_minimo: number
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          precio_unitario?: number
          stock_minimo?: number
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          precio_unitario?: number
          stock_minimo?: number
          unidad?: string
          updated_at?: string
        }
        Relationships: []
      }
      mensajes: {
        Row: {
          contenido: string
          conversacion_id: string
          created_at: string
          id: string
          raw_payload: Json | null
          rol: Database["public"]["Enums"]["mensaje_rol"]
        }
        Insert: {
          contenido: string
          conversacion_id: string
          created_at?: string
          id?: string
          raw_payload?: Json | null
          rol: Database["public"]["Enums"]["mensaje_rol"]
        }
        Update: {
          contenido?: string
          conversacion_id?: string
          created_at?: string
          id?: string
          raw_payload?: Json | null
          rol?: Database["public"]["Enums"]["mensaje_rol"]
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
      movimientos_inventario: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          lote_id: string | null
          medicamento_id: string
          motivo: string | null
          tipo: Database["public"]["Enums"]["movimiento_tipo"]
          user_id: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          lote_id?: string | null
          medicamento_id: string
          motivo?: string | null
          tipo: Database["public"]["Enums"]["movimiento_tipo"]
          user_id?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          lote_id?: string | null
          medicamento_id?: string
          motivo?: string | null
          tipo?: Database["public"]["Enums"]["movimiento_tipo"]
          user_id?: string | null
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
            foreignKeyName: "notas_consulta_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors_public"
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
      patient_checkout_events: {
        Row: {
          appointment_id: string | null
          checked_out_at: string
          checked_out_by: string | null
          checkout_status: string
          checkout_type: string
          created_at: string
          discharge_summary: string | null
          followup_date: string | null
          followup_required: boolean
          id: string
          journey_instance_id: string
          notes: string | null
          patient_id: string
        }
        Insert: {
          appointment_id?: string | null
          checked_out_at?: string
          checked_out_by?: string | null
          checkout_status?: string
          checkout_type: string
          created_at?: string
          discharge_summary?: string | null
          followup_date?: string | null
          followup_required?: boolean
          id?: string
          journey_instance_id: string
          notes?: string | null
          patient_id: string
        }
        Update: {
          appointment_id?: string | null
          checked_out_at?: string
          checked_out_by?: string | null
          checkout_status?: string
          checkout_type?: string
          created_at?: string
          discharge_summary?: string | null
          followup_date?: string | null
          followup_required?: boolean
          id?: string
          journey_instance_id?: string
          notes?: string | null
          patient_id?: string
        }
        Relationships: []
      }
      patient_studies: {
        Row: {
          appointment_id: string | null
          archivo_url: string | null
          area_laboratorio: string | null
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
          codigo_postal: string | null
          colonia: string | null
          contacto_emergencia_nombre: string | null
          contacto_emergencia_telefono: string | null
          created_at: string
          curp: string | null
          direccion: string | null
          domicilio_ciudad: string | null
          domicilio_estado: string | null
          email: string | null
          estado: string | null
          fecha_nacimiento: string | null
          id: string
          municipio: string | null
          nacionalidad: string | null
          nombre: string
          notas: string | null
          ocupacion: string | null
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
          domicilio_ciudad?: string | null
          domicilio_estado?: string | null
          email?: string | null
          estado?: string | null
          fecha_nacimiento?: string | null
          id?: string
          municipio?: string | null
          nacionalidad?: string | null
          nombre: string
          notas?: string | null
          ocupacion?: string | null
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
          domicilio_ciudad?: string | null
          domicilio_estado?: string | null
          email?: string | null
          estado?: string | null
          fecha_nacimiento?: string | null
          id?: string
          municipio?: string | null
          nacionalidad?: string | null
          nombre?: string
          notas?: string | null
          ocupacion?: string | null
          rfc?: string | null
          sexo?: string | null
          telefono?: string | null
          tipo_sangre?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      permanent_admins: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      post_consultation_followups: {
        Row: {
          adverse_effects: string | null
          channel: string
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
        Relationships: []
      }
      prescription_items: {
        Row: {
          brand_name: string | null
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
        Relationships: []
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          consultation_note_id: string | null
          created_at: string
          diagnosis: string | null
          digital_signature_status: string
          doctor_id: string
          expediente_id: string | null
          id: string
          issue_date: string | null
          journey_instance_id: string | null
          notes: string | null
          patient_id: string
          pdf_url: string | null
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
          consultation_note_id?: string | null
          created_at?: string
          diagnosis?: string | null
          digital_signature_status?: string
          doctor_id: string
          expediente_id?: string | null
          id?: string
          issue_date?: string | null
          journey_instance_id?: string | null
          notes?: string | null
          patient_id: string
          pdf_url?: string | null
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
          consultation_note_id?: string | null
          created_at?: string
          diagnosis?: string | null
          digital_signature_status?: string
          doctor_id?: string
          expediente_id?: string | null
          id?: string
          issue_date?: string | null
          journey_instance_id?: string | null
          notes?: string | null
          patient_id?: string
          pdf_url?: string | null
          prescription_number?: string | null
          qr_code_value?: string | null
          status?: string
          template_id?: string | null
          template_snapshot_json?: Json | null
          template_version_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recordatorios_cita: {
        Row: {
          appointment_id: string
          created_at: string
          enviado_at: string | null
          id: string
          identidad_canal_id: string | null
          intentos: number
          mensaje: string | null
          programado_para: string
          status: Database["public"]["Enums"]["recordatorio_status"]
          tipo: Database["public"]["Enums"]["recordatorio_tipo"]
          ultimo_error: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          enviado_at?: string | null
          id?: string
          identidad_canal_id?: string | null
          intentos?: number
          mensaje?: string | null
          programado_para: string
          status?: Database["public"]["Enums"]["recordatorio_status"]
          tipo?: Database["public"]["Enums"]["recordatorio_tipo"]
          ultimo_error?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          enviado_at?: string | null
          id?: string
          identidad_canal_id?: string | null
          intentos?: number
          mensaje?: string | null
          programado_para?: string
          status?: Database["public"]["Enums"]["recordatorio_status"]
          tipo?: Database["public"]["Enums"]["recordatorio_tipo"]
          ultimo_error?: string | null
          updated_at?: string
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
          activo: boolean
          created_at: string
          descripcion: string | null
          duracion_minutos: number
          especialidad: string | null
          id: string
          nombre: string
          precio_centavos: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          duracion_minutos?: number
          especialidad?: string | null
          id?: string
          nombre: string
          precio_centavos?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          duracion_minutos?: number
          especialidad?: string | null
          id?: string
          nombre?: string
          precio_centavos?: number
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
      doctors_public: {
        Row: {
          activo: boolean | null
          apellidos: string | null
          duracion_cita_min: number | null
          especialidad: string | null
          horario_fin: string | null
          horario_inicio: string | null
          id: string | null
          nombre: string | null
        }
        Insert: {
          activo?: boolean | null
          apellidos?: string | null
          duracion_cita_min?: number | null
          especialidad?: string | null
          horario_fin?: string | null
          horario_inicio?: string | null
          id?: string | null
          nombre?: string | null
        }
        Update: {
          activo?: boolean | null
          apellidos?: string | null
          duracion_cita_min?: number | null
          especialidad?: string | null
          horario_fin?: string | null
          horario_inicio?: string | null
          id?: string | null
          nombre?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_user_clinic_ids: { Args: never; Returns: string[] }
      ensure_permanent_admins: { Args: never; Returns: undefined }
      generate_prescription_number: { Args: never; Returns: string }
      generate_prescription_number_for_doctor: {
        Args: { _doctor_id: string }
        Returns: string
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
      is_clinic_staff: { Args: { _user_id: string }; Returns: boolean }
      is_global_admin: { Args: { _user_id: string }; Returns: boolean }
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
      update_journey_progress: {
        Args: { _journey_instance_id: string }
        Returns: undefined
      }
      user_has_clinic_access: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_clinic_role: {
        Args: {
          _clinic_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      audit_action: "crear" | "actualizar" | "cancelar" | "eliminar"
      canal_tipo: "telegram" | "whatsapp" | "instagram" | "facebook"
      conversacion_status: "activa" | "escalada" | "cerrada"
      expediente_tipo:
        | "primera_vez"
        | "seguimiento"
        | "urgencia"
        | "cirugia"
        | "cronico"
      journey_field_type:
        | "texto_corto"
        | "texto_largo"
        | "numero"
        | "fecha"
        | "fecha_hora"
        | "seleccion_unica"
        | "seleccion_multiple"
        | "si_no"
        | "archivo"
        | "firma"
        | "usuario_responsable"
        | "medicamento"
        | "diagnostico"
        | "servicio"
        | "metodo_pago"
        | "resultado_laboratorio"
        | "signos_vitales"
        | "checklist"
      journey_rule_severity: "info" | "warning" | "blocking"
      journey_step_type:
        | "administrativa"
        | "clinica"
        | "legal"
        | "farmacia"
        | "facturacion"
        | "seguimiento"
        | "auditoria"
      journey_template_type:
        | "consulta_general"
        | "consulta_seguimiento"
        | "urgencia"
        | "procedimiento_menor"
        | "laboratorio"
        | "farmacia"
        | "teleconsulta"
        | "alta_administrativa"
      journey_version_status: "draft" | "active" | "archived"
      mensaje_rol: "user" | "assistant" | "tool" | "system"
      movimiento_tipo: "entrada" | "salida" | "ajuste"
      recordatorio_status: "pendiente" | "enviado" | "fallido" | "cancelado"
      recordatorio_tipo: "t24h" | "t2h" | "manual"
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
      app_role: ["admin", "receptionist", "doctor", "nurse", "patient"],
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
      audit_action: ["crear", "actualizar", "cancelar", "eliminar"],
      canal_tipo: ["telegram", "whatsapp", "instagram", "facebook"],
      conversacion_status: ["activa", "escalada", "cerrada"],
      expediente_tipo: [
        "primera_vez",
        "seguimiento",
        "urgencia",
        "cirugia",
        "cronico",
      ],
      journey_field_type: [
        "texto_corto",
        "texto_largo",
        "numero",
        "fecha",
        "fecha_hora",
        "seleccion_unica",
        "seleccion_multiple",
        "si_no",
        "archivo",
        "firma",
        "usuario_responsable",
        "medicamento",
        "diagnostico",
        "servicio",
        "metodo_pago",
        "resultado_laboratorio",
        "signos_vitales",
        "checklist",
      ],
      journey_rule_severity: ["info", "warning", "blocking"],
      journey_step_type: [
        "administrativa",
        "clinica",
        "legal",
        "farmacia",
        "facturacion",
        "seguimiento",
        "auditoria",
      ],
      journey_template_type: [
        "consulta_general",
        "consulta_seguimiento",
        "urgencia",
        "procedimiento_menor",
        "laboratorio",
        "farmacia",
        "teleconsulta",
        "alta_administrativa",
      ],
      journey_version_status: ["draft", "active", "archived"],
      mensaje_rol: ["user", "assistant", "tool", "system"],
      movimiento_tipo: ["entrada", "salida", "ajuste"],
      recordatorio_status: ["pendiente", "enviado", "fallido", "cancelado"],
      recordatorio_tipo: ["t24h", "t2h", "manual"],
    },
  },
} as const
