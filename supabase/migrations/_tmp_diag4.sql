SELECT t.id, t.estado, t.abierto_at, t.cerrado_at, t.pharmacy_shift_id,
       pcs.id as pcs_id, pcs.status as pcs_status, pcs.opened_at, pcs.closed_at as pcs_closed
FROM public.turnos t
LEFT JOIN public.pharmacy_cash_shifts pcs ON pcs.id = t.pharmacy_shift_id
ORDER BY t.abierto_at DESC LIMIT 10;
