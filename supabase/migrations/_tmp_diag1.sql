SELECT ps.id, ps.shift_id, ps.status, ps.total, ps.payment_method, ps.created_at
FROM public.pharmacy_sales ps
ORDER BY ps.created_at DESC LIMIT 10;
