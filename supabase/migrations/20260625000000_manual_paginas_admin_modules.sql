-- Activa el botón "?" (ManualButton) en módulos de administración/configuración
-- que ya tienen su .md redactado pero no tenían fila en manual_paginas.
INSERT INTO manual_paginas (ruta, slug, titulo, modulo, activo, version)
VALUES
  ('/auditoria',      'auditoria',      'Auditoría',        'Administración', true, 1),
  ('/configuracion',  'configuracion',  'Configuración',    'Administración', true, 1),
  ('/admin/usuarios', 'admin-usuarios', 'Usuarios y roles', 'Administración', true, 1)
ON CONFLICT (ruta) DO NOTHING;
