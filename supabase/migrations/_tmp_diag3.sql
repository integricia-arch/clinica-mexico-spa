SELECT ps.shift_id, COUNT(*) as ventas,
       SUM(psp.amount) as total_pago_efectivo,
       MIN(ps.created_at) as primera, MAX(ps.created_at) as ultima
FROM public.pharmacy_sales ps
JOIN public.pharmacy_sale_payments psp ON psp.sale_id = ps.id
WHERE psp.payment_method = 'efectivo' AND ps.status = 'completed'
GROUP BY ps.shift_id;
