-- Eliminar la política que permitía a pacientes autenticados leer todos los campos de doctores
DROP POLICY IF EXISTS "Authenticated view non-sensitive doctor fields" ON public.doctors;
-- La política "Staff view all doctor fields" se conserva: solo personal verá la tabla doctors.