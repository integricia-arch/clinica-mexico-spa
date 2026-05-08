-- ===========================================
-- CATÁLOGO BASE DE MEDICAMENTOS SSA/IMSS
-- 50 medicamentos más usados en hospitales privados México
-- Campos requeridos: clave IMSS, principio activo, forma farmacéutica,
-- concentración, unidad de medida, registro COFEPRIS, grupo terapéutico
-- ===========================================

-- Agregar columnas adicionales requeridas por SSA
ALTER TABLE public.medicamentos
  ADD COLUMN IF NOT EXISTS principio_activo text,
  ADD COLUMN IF NOT EXISTS forma_farmaceutica text,
  ADD COLUMN IF NOT EXISTS concentracion text,
  ADD COLUMN IF NOT EXISTS clave_cuadro_basico text,
  ADD COLUMN IF NOT EXISTS registro_cofepris text,
  ADD COLUMN IF NOT EXISTS grupo_terapeutico text,
  ADD COLUMN IF NOT EXISTS requiere_receta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS controlado boolean NOT NULL DEFAULT false;

-- Insertar medicamentos del cuadro básico
INSERT INTO public.medicamentos (nombre, principio_activo, forma_farmaceutica, concentracion, categoria, grupo_terapeutico, unidad, precio_unitario, stock_minimo, requiere_receta, controlado, clave_cuadro_basico) VALUES
-- ANALGÉSICOS / ANTIPIRÉTICOS
('Paracetamol 500mg Tab','Paracetamol','Tableta','500 mg','Analgésico','Analgésicos y antipiréticos','tableta',2.50,200,false,false,'010.000.4185.00'),
('Paracetamol 100mg/ml Sol','Paracetamol','Solución oral','100 mg/ml','Analgésico','Analgésicos y antipiréticos','frasco',45.00,50,false,false,'010.000.4186.00'),
('Metamizol 500mg Tab','Metamizol sódico','Tableta','500 mg','Analgésico','Analgésicos y antipiréticos','tableta',3.50,150,false,false,'010.000.4190.00'),
('Metamizol 1g/2ml Amp','Metamizol sódico','Solución inyectable','1 g/2 ml','Analgésico','Analgésicos y antipiréticos','ampolleta',18.00,100,true,false,'010.000.4191.00'),
('Ketorolaco 30mg/ml Amp','Ketorolaco trometamina','Solución inyectable','30 mg/ml','Antiinflamatorio','Analgésicos AINEs','ampolleta',22.00,80,true,false,'010.000.4194.00'),
('Ibuprofeno 400mg Tab','Ibuprofeno','Tableta','400 mg','Antiinflamatorio','Analgésicos AINEs','tableta',4.00,100,false,false,'010.000.4204.00'),
('Diclofenaco 75mg/3ml Amp','Diclofenaco sódico','Solución inyectable','75 mg/3 ml','Antiinflamatorio','Analgésicos AINEs','ampolleta',15.00,80,true,false,'010.000.4205.00'),
('Tramadol 100mg/2ml Amp','Tramadol clorhidrato','Solución inyectable','100 mg/2 ml','Analgésico','Analgésicos opioides','ampolleta',35.00,50,true,true,'010.000.4208.00'),
('Morfina 10mg/ml Amp','Morfina sulfato','Solución inyectable','10 mg/ml','Analgésico','Analgésicos opioides','ampolleta',85.00,20,true,true,'010.000.4195.00'),

-- ANTIBIÓTICOS
('Amoxicilina 500mg Cap','Amoxicilina','Cápsula','500 mg','Antibiótico','Antibacterianos penicilinas','cápsula',8.00,100,true,false,'010.000.4220.00'),
('Amoxicilina+Clavulanato 875mg Tab','Amoxicilina/ácido clavulánico','Tableta','875/125 mg','Antibiótico','Antibacterianos penicilinas','tableta',25.00,60,true,false,'010.000.4221.00'),
('Azitromicina 500mg Tab','Azitromicina dihidrato','Tableta','500 mg','Antibiótico','Antibacterianos macrólidos','tableta',18.00,60,true,false,'010.000.4230.00'),
('Ciprofloxacino 500mg Tab','Ciprofloxacino','Tableta','500 mg','Antibiótico','Antibacterianos quinolonas','tableta',12.00,80,true,false,'010.000.4240.00'),
('Ciprofloxacino 200mg/100ml IV','Ciprofloxacino','Solución inyectable','200 mg/100 ml','Antibiótico','Antibacterianos quinolonas','frasco',95.00,30,true,false,'010.000.4241.00'),
('Ceftriaxona 1g IV','Ceftriaxona sódica','Polvo liofilizado inyectable','1 g','Antibiótico','Antibacterianos cefalosporinas','frasco',85.00,40,true,false,'010.000.4250.00'),
('Metronidazol 500mg Tab','Metronidazol','Tableta','500 mg','Antibiótico','Antibacterianos nitroimidazoles','tableta',5.00,80,true,false,'010.000.4260.00'),
('Metronidazol 500mg/100ml IV','Metronidazol','Solución inyectable','500 mg/100 ml','Antibiótico','Antibacterianos nitroimidazoles','frasco',65.00,30,true,false,'010.000.4261.00'),
('Clindamicina 600mg/4ml Amp','Clindamicina fosfato','Solución inyectable','600 mg/4 ml','Antibiótico','Antibacterianos lincosamidas','ampolleta',55.00,30,true,false,'010.000.4265.00'),

-- ANTIHIPERTENSIVOS / CARDIOLÓGICOS
('Losartán 50mg Tab','Losartán potásico','Tableta','50 mg','Antihipertensivo','Antagonistas angiotensina II','tableta',6.50,120,true,false,'010.000.4320.00'),
('Enalapril 10mg Tab','Enalapril maleato','Tableta','10 mg','Antihipertensivo','IECA','tableta',4.00,120,true,false,'010.000.4315.00'),
('Amlodipino 5mg Tab','Amlodipino besilato','Tableta','5 mg','Antihipertensivo','Bloqueadores canales calcio','tableta',5.50,100,true,false,'010.000.4330.00'),
('Metoprolol 100mg Tab','Metoprolol tartrato','Tableta','100 mg','Antihipertensivo','Betabloqueadores','tableta',7.00,80,true,false,'010.000.4340.00'),
('Furosemida 40mg Tab','Furosemida','Tableta','40 mg','Antihipertensivo','Diuréticos de asa','tableta',3.50,80,true,false,'010.000.4350.00'),
('Furosemida 20mg/2ml Amp','Furosemida','Solución inyectable','20 mg/2 ml','Antihipertensivo','Diuréticos de asa','ampolleta',12.00,50,true,false,'010.000.4351.00'),

-- ANTIDIABÉTICOS
('Metformina 850mg Tab','Metformina clorhidrato','Tableta','850 mg','Antidiabético','Biguanidas','tableta',4.50,150,true,false,'010.000.4360.00'),
('Glibenclamida 5mg Tab','Glibenclamida','Tableta','5 mg','Antidiabético','Sulfonilureas','tableta',3.00,100,true,false,'010.000.4365.00'),
('Insulina Regular 100UI/ml','Insulina humana regular','Solución inyectable','100 UI/ml','Antidiabético','Insulinas','frasco',185.00,20,true,false,'010.000.4370.00'),
('Insulina NPH 100UI/ml','Insulina isofánica humana','Suspensión inyectable','100 UI/ml','Antidiabético','Insulinas','frasco',175.00,20,true,false,'010.000.4371.00'),

-- GASTROINTESTINALES
('Omeprazol 20mg Cap','Omeprazol','Cápsula','20 mg','Gastrointestinal','Inhibidores bomba protones','cápsula',6.50,120,false,false,'010.000.4400.00'),
('Omeprazol 40mg IV','Omeprazol sódico','Polvo liofilizado inyectable','40 mg','Gastrointestinal','Inhibidores bomba protones','frasco',95.00,30,true,false,'010.000.4401.00'),
('Ranitidina 300mg Tab','Ranitidina clorhidrato','Tableta','300 mg','Gastrointestinal','Antagonistas H2','tableta',5.00,80,false,false,'010.000.4410.00'),
('Metoclopramida 10mg Tab','Metoclopramida clorhidrato','Tableta','10 mg','Gastrointestinal','Procinéticos','tableta',3.50,80,false,false,'010.000.4420.00'),
('Metoclopramida 10mg/2ml Amp','Metoclopramida clorhidrato','Solución inyectable','10 mg/2 ml','Gastrointestinal','Procinéticos','ampolleta',8.00,60,true,false,'010.000.4421.00'),
('Ondansetrón 4mg/2ml Amp','Ondansetrón clorhidrato','Solución inyectable','4 mg/2 ml','Gastrointestinal','Antieméticos','ampolleta',45.00,60,true,false,'010.000.4425.00'),
('Loperamida 2mg Cap','Loperamida clorhidrato','Cápsula','2 mg','Gastrointestinal','Antidiarreicos','cápsula',4.50,60,false,false,'010.000.4430.00'),

-- ANTIHISTAMÍNICOS / ALERGIAS
('Cetirizina 10mg Tab','Cetirizina diclorhidrato','Tableta','10 mg','Antihistamínico','Antihistamínicos H1','tableta',5.50,80,false,false,'010.000.4450.00'),
('Loratadina 10mg Tab','Loratadina','Tableta','10 mg','Antihistamínico','Antihistamínicos H1','tableta',5.00,80,false,false,'010.000.4451.00'),
('Clorfeniramina 10mg/ml Amp','Clorfeniramina maleato','Solución inyectable','10 mg/ml','Antihistamínico','Antihistamínicos H1','ampolleta',12.00,40,true,false,'010.000.4455.00'),
('Dexametasona 8mg/2ml Amp','Dexametasona fosfato','Solución inyectable','8 mg/2 ml','Antiinflamatorio','Corticosteroides','ampolleta',18.00,60,true,false,'010.000.4460.00'),
('Prednisona 50mg Tab','Prednisona','Tableta','50 mg','Antiinflamatorio','Corticosteroides','tableta',8.00,60,true,false,'010.000.4461.00'),

-- RESPIRATORIO
('Salbutamol 100mcg Inh','Salbutamol sulfato','Aerosol inhalador','100 mcg/dosis','Broncodilatador','Beta2 agonistas','pieza',185.00,20,true,false,'010.000.4500.00'),
('Budesonida 200mcg Inh','Budesonida','Aerosol inhalador','200 mcg/dosis','Broncodilatador','Corticosteroides inhalados','pieza',320.00,15,true,false,'010.000.4505.00'),
('Ambroxol 30mg Tab','Ambroxol clorhidrato','Tableta','30 mg','Respiratorio','Mucolíticos','tableta',4.50,60,false,false,'010.000.4510.00'),

-- NEUROLÓGICOS / PSIQUIÁTRICOS
('Diazepam 10mg/2ml Amp','Diazepam','Solución inyectable','10 mg/2 ml','Neurológico','Benzodiacepinas','ampolleta',15.00,30,true,true,'010.000.4600.00'),
('Alprazolam 0.5mg Tab','Alprazolam','Tableta','0.5 mg','Neurológico','Benzodiacepinas','tableta',8.00,30,true,true,'010.000.4605.00'),
('Carbamazepina 200mg Tab','Carbamazepina','Tableta','200 mg','Neurológico','Antiepilépticos','tableta',6.00,60,true,false,'010.000.4610.00'),

-- SOLUCIONES / ELECTROLITOS
('Solución Salina 0.9% 1L','Cloruro de sodio','Solución inyectable','0.9% 1000 ml','Soluciones','Electrolitos IV','frasco',45.00,50,true,false,'010.000.5100.00'),
('Solución Hartmann 1L','Ringer lactato','Solución inyectable','1000 ml','Soluciones','Electrolitos IV','frasco',48.00,50,true,false,'010.000.5105.00'),
('Glucosa 5% 1L','Dextrosa','Solución inyectable','5% 1000 ml','Soluciones','Electrolitos IV','frasco',42.00,40,true,false,'010.000.5110.00'),

-- VITAMINAS / SUPLEMENTOS
('Ácido fólico 5mg Tab','Ácido fólico','Tableta','5 mg','Vitaminas','Vitaminas','tableta',1.50,100,false,false,'010.000.5200.00'),
('Vitamina B12 1000mcg/ml Amp','Cianocobalamina','Solución inyectable','1000 mcg/ml','Vitaminas','Vitaminas','ampolleta',15.00,40,false,false,'010.000.5205.00')

ON CONFLICT DO NOTHING;
