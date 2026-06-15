-- Diagnóstico: ¿por qué cobros efectivo = $0?

-- 1. Últimas pharmacy_sales con shift_id
SELECT ps.id, ps.shift_id, ps.status, ps.total, ps.payment_method, ps.created_at
FROM public.pharmacy_sales ps
ORDER BY ps.created_at DESC LIMIT 10;

-- 2. pharmacy_sale_payments recientes
SELECT psp.id, psp.sale_id, psp.payment_method, psp.amount, psp.created_at
FROM public.pharmacy_sale_payments psp
ORDER BY psp.created_at DESC LIMIT 10;

-- 3. pharmacy_cash_shifts + turnos.pharmacy_shift_id
SELECT pcs.id, pcs.status, pcs.opened_at, pcs.closed_at,
       t.id as turno_id, t.estado, t.abierto_at
FROM public.pharmacy_cash_shifts pcs
LEFT JOIN public.turnos t ON t.pharmacy_shift_id = pcs.id
ORDER BY pcs.opened_at DESC LIMIT 10;

-- 4. ¿Los payments se unen con las sales por shift?
SELECT ps.shift_id, COUNT(*) as ventas, SUM(psp.amount) as total_efectivo
FROM public.pharmacy_sales ps
JOIN public.pharmacy_sale_payments psp ON psp.sale_id = ps.id
WHERE psp.payment_method = 'efectivo' AND ps.status = 'completed'
GROUP BY ps.shift_id;
