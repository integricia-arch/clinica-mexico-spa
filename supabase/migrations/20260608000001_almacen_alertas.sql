set search_path = public;

-- almacen_alertas: tracks medication shortages detected at prescription issuance
-- FK constraints omitted: referenced tables in different schema visibility context
create table if not exists almacen_alertas (
  id                   uuid primary key default gen_random_uuid(),
  clinic_id            uuid,
  tipo                 text not null check (tipo in ('faltante_receta', 'stock_minimo')),
  medicamento_id       uuid,
  generic_name         text,
  quantity_needed      int not null,
  quantity_available   int not null default 0,
  prescription_id      uuid,
  prescription_item_id uuid,
  status               text not null default 'pending' check (status in ('pending', 'resolved', 'external')),
  resolved_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists almacen_alertas_clinic_status_idx on almacen_alertas (clinic_id, status, created_at desc);
create index if not exists almacen_alertas_medicamento_status_idx on almacen_alertas (medicamento_id, status);

alter table almacen_alertas enable row level security;

create policy "almacen_alertas_clinic_member_select"
  on almacen_alertas for select
  using (
    clinic_id in (
      select clinic_id from clinic_members where user_id = auth.uid()
    )
  );

create policy "almacen_alertas_admin_nurse_insert"
  on almacen_alertas for insert
  with check (
    clinic_id in (
      select clinic_id from clinic_members
      where user_id = auth.uid()
        and role in ('admin', 'nurse', 'doctor')
    )
  );

create policy "almacen_alertas_admin_nurse_update"
  on almacen_alertas for update
  using (
    clinic_id in (
      select clinic_id from clinic_members
      where user_id = auth.uid()
        and role in ('admin', 'nurse', 'receptionist')
    )
  );
