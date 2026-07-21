import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ActiveClinicProvider } from "@/hooks/useActiveClinic";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import TurnoGuard from "@/components/TurnoGuard";

const ResetPassword = React.lazy(() => import("@/pages/ResetPassword"));
const AdminDashboard = React.lazy(() => import("@/pages/AdminDashboard"));
const PacientesLista = React.lazy(() => import("@/pages/PacientesLista"));
const AgendaMedico = React.lazy(() => import("@/pages/AgendaMedico"));
const NuevaCita = React.lazy(() => import("@/pages/NuevaCita"));
const DetalleCita = React.lazy(() => import("@/pages/DetalleCita"));
const RecepcionDashboard = React.lazy(() => import("@/pages/RecepcionDashboard"));
const Facturacion = React.lazy(() => import("@/pages/Facturacion"));
const Expedientes = React.lazy(() => import("@/pages/Expedientes"));
const Farmacia = React.lazy(() => import("@/pages/Farmacia"));
const Compras = React.lazy(() => import("@/pages/Compras"));
const Almacen = React.lazy(() => import("@/pages/Almacen"));
const Enfermeria = React.lazy(() => import("@/pages/Enfermeria"));
const VincularTelegram = React.lazy(() => import("@/pages/VincularTelegram"));
const Configuracion = React.lazy(() => import("@/pages/Configuracion"));
const CaminoPacienteConfig = React.lazy(() => import("@/pages/configuracion/CaminoPaciente"));
const MachoteReceta = React.lazy(() => import("@/pages/configuracion/MachoteReceta"));
const ConfiguracionCFDI = React.lazy(() => import("@/pages/configuracion/ConfiguracionCFDI"));
const ConfiguracionPagos = React.lazy(() => import("@/pages/configuracion/ConfiguracionPagos"));
const ConfiguracionEmail = React.lazy(() => import("@/pages/configuracion/ConfiguracionEmail"));
const ConfiguracionNotificaciones = React.lazy(() => import("@/pages/configuracion/ConfiguracionNotificaciones"));
const RecetaImprimir = React.lazy(() => import("@/pages/RecetaImprimir"));
const RecetaBitacora = React.lazy(() => import("@/pages/RecetaBitacora"));
const MisRecetas = React.lazy(() => import("@/pages/MisRecetas"));
const Recetas = React.lazy(() => import("@/pages/Recetas"));
const VerificarReceta = React.lazy(() => import("@/pages/VerificarReceta"));
const Auditoria = React.lazy(() => import("@/pages/Auditoria"));
const Inbox = React.lazy(() => import("@/pages/Inbox"));
const Citas = React.lazy(() => import("@/pages/Citas"));
const Recordatorios = React.lazy(() => import("@/pages/Recordatorios"));
const AdminUsuarios = React.lazy(() => import("@/pages/AdminUsuarios"));
const AdminDiagnosticoMulticlinica = React.lazy(() => import("@/pages/AdminDiagnosticoMulticlinica"));
const Pitch = React.lazy(() => import("@/pages/Pitch"));
const CaminoPaciente = React.lazy(() => import("@/pages/CaminoPaciente"));
const PanelDoctor = React.lazy(() => import("@/pages/PanelDoctor"));
const CajaConfiguracion = React.lazy(() => import("@/pages/CajaConfiguracion"));
const CajaTurno = React.lazy(() => import("@/pages/CajaTurno"));
const Caja = React.lazy(() => import("@/pages/Caja"));
const AjustesPlataforma = React.lazy(() => import("@/pages/ajustes/AjustesPlataforma"));
const BI = React.lazy(() => import("@/pages/BI"));
const Contabilidad = React.lazy(() => import("@/pages/Contabilidad"));
const AyudaInterna = React.lazy(() => import("@/pages/AyudaInterna"));
const SinAcceso = React.lazy(() => import("./pages/SinAcceso"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const AvisoPrivacidad = React.lazy(() => import("@/pages/AvisoPrivacidad"));
const TerminosServicio = React.lazy(() => import("@/pages/TerminosServicio"));
const SolicitudARCO = React.lazy(() => import("@/pages/SolicitudARCO"));
const ARCOAdmin = React.lazy(() => import("@/pages/ARCOAdmin"));
const ExpedienteElectronico = React.lazy(() => import("@/pages/ExpedienteElectronico"));
const Lealtad = React.lazy(() => import("@/pages/Lealtad"));
const AdminTenants = React.lazy(() => import("@/pages/AdminTenants"));
const AdminTenantDetail = React.lazy(() => import("@/pages/AdminTenantDetail"));
const WhatsappAlertas = React.lazy(() => import("@/pages/WhatsappAlertas"));

const LoyaltyApp = React.lazy(() =>
  import('@/pwa/LoyaltyApp').then(m => ({ default: m.LoyaltyApp }))
)

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="min-h-screen grid place-items-center">
    <span className="animate-pulse text-sm text-muted-foreground">Cargando...</span>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ActiveClinicProvider>
            <React.Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/sin-acceso" element={<SinAcceso />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/pitch" element={<Pitch />} />
                <Route path="/verificar-receta/:id" element={<VerificarReceta />} />
                <Route path="/aviso-privacidad" element={<AvisoPrivacidad />} />
                <Route path="/terminos" element={<TerminosServicio />} />
                <Route path="/solicitud-arco" element={<SolicitudARCO />} />
                <Route path="/loyalty/:slug/*" element={<LoyaltyApp />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Routes>
                          <Route path="/" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
                          <Route path="/pacientes" element={<ProtectedRoute allowedRoles={["admin","receptionist","doctor","nurse"]}><PacientesLista /></ProtectedRoute>} />
                          <Route path="/agenda" element={<ProtectedRoute allowedRoles={["admin","doctor","receptionist","nurse"]}><AgendaMedico /></ProtectedRoute>} />
                          <Route path="/nueva-cita" element={<ProtectedRoute allowedRoles={["admin","receptionist","patient"]}><NuevaCita /></ProtectedRoute>} />
                          <Route path="/cita/:id" element={<ProtectedRoute allowedRoles={["admin","receptionist","doctor","nurse"]}><DetalleCita /></ProtectedRoute>} />
                          <Route path="/recepcion" element={<ProtectedRoute allowedRoles={["admin","receptionist"]}><RecepcionDashboard /></ProtectedRoute>} />
                          <Route path="/facturacion" element={<ProtectedRoute allowedRoles={["admin","receptionist"]} requiredModulo="facturacion_cfdi"><Facturacion /></ProtectedRoute>} />
                          <Route path="/expedientes" element={<ProtectedRoute allowedRoles={["admin","doctor","nurse"]}><Expedientes /></ProtectedRoute>} />
                          <Route path="/expediente/:patientId" element={<ProtectedRoute allowedRoles={["admin","doctor","nurse"]}><ExpedienteElectronico /></ProtectedRoute>} />
                          <Route path="/farmacia" element={<ProtectedRoute allowedRoles={["admin","nurse","receptionist","cajero"]} requiredModulo="pos_farmacia"><TurnoGuard cajaFilter="farmacia"><Farmacia /></TurnoGuard></ProtectedRoute>} />
                          <Route path="/compras" element={<ProtectedRoute allowedRoles={["admin","nurse","receptionist","cajero"]} requiredModulo="compras"><Compras /></ProtectedRoute>} />
                          <Route path="/almacen" element={<ProtectedRoute allowedRoles={["admin","nurse","receptionist","cajero"]} requiredModulo="almacen"><Almacen /></ProtectedRoute>} />
                          <Route path="/enfermeria" element={<ProtectedRoute allowedRoles={["admin", "manager", "nurse"]}><Enfermeria /></ProtectedRoute>} />
                          <Route path="/perfil/vincular-telegram" element={<ProtectedRoute allowedRoles={["admin","doctor","nurse","receptionist","cajero","manager"]}><VincularTelegram /></ProtectedRoute>} />
                          <Route path="/configuracion" element={<ProtectedRoute allowedRoles={["admin","doctor"]}><Configuracion /></ProtectedRoute>} />
                          <Route path="/ajustes" element={<ProtectedRoute allowedRoles={["admin","doctor"]}><AjustesPlataforma /></ProtectedRoute>} />
                          <Route path="/configuracion/camino-paciente" element={<ProtectedRoute allowedRoles={["admin"]}><CaminoPacienteConfig /></ProtectedRoute>} />
                          <Route path="/configuracion/recetas" element={<ProtectedRoute allowedRoles={["admin","doctor"]}><MachoteReceta /></ProtectedRoute>} />
                          <Route path="/receta/:id" element={<ProtectedRoute allowedRoles={["admin","doctor","nurse","receptionist","patient"]}><RecetaImprimir /></ProtectedRoute>} />
                          <Route path="/receta/:id/bitacora" element={<ProtectedRoute allowedRoles={["admin","doctor","nurse","receptionist","patient"]}><RecetaBitacora /></ProtectedRoute>} />
                          <Route path="/mis-recetas" element={<ProtectedRoute allowedRoles={["patient","admin"]}><MisRecetas /></ProtectedRoute>} />
                          <Route path="/recetas" element={<ProtectedRoute allowedRoles={["admin","doctor","nurse"]}><Recetas /></ProtectedRoute>} />

                          <Route path="/camino-paciente/:id" element={<ProtectedRoute allowedRoles={["admin","doctor","receptionist","nurse"]}><CaminoPaciente /></ProtectedRoute>} />
                          <Route path="/doctor" element={<ProtectedRoute allowedRoles={["admin","doctor"]}><PanelDoctor /></ProtectedRoute>} />
                          <Route path="/auditoria" element={<ProtectedRoute allowedRoles={["admin","receptionist"]}><Auditoria /></ProtectedRoute>} />
                          <Route path="/inbox" element={<ProtectedRoute allowedRoles={["admin","receptionist","doctor","nurse"]}><Inbox /></ProtectedRoute>} />
                          <Route path="/conversaciones" element={<ProtectedRoute allowedRoles={["admin","receptionist","doctor","nurse"]}><Inbox /></ProtectedRoute>} />
                          <Route path="/citas" element={<ProtectedRoute allowedRoles={["admin","receptionist","doctor","nurse"]}><Citas /></ProtectedRoute>} />
                          <Route path="/recordatorios" element={<ProtectedRoute allowedRoles={["admin","receptionist","doctor"]}><Recordatorios /></ProtectedRoute>} />
                          <Route path="/configuracion/caja" element={<ProtectedRoute allowedRoles={["admin","manager","cajero"]}><CajaConfiguracion /></ProtectedRoute>} />
                          <Route path="/configuracion/facturacion" element={<ProtectedRoute allowedRoles={["admin"]}><ConfiguracionCFDI /></ProtectedRoute>} />
                          <Route path="/configuracion/pagos" element={<ProtectedRoute allowedRoles={["admin"]}><ConfiguracionPagos /></ProtectedRoute>} />
                          <Route path="/configuracion/email" element={<ProtectedRoute allowedRoles={["admin"]}><ConfiguracionEmail /></ProtectedRoute>} />
                          <Route path="/configuracion/notificaciones" element={<ProtectedRoute allowedRoles={["admin"]}><ConfiguracionNotificaciones /></ProtectedRoute>} />
                          <Route path="/caja/turno" element={<ProtectedRoute allowedRoles={["admin","manager","cajero"]}><CajaTurno /></ProtectedRoute>} />
                          <Route path="/caja" element={<ProtectedRoute allowedRoles={["admin","manager","cajero","receptionist"]}><TurnoGuard cajaFilter="general"><Caja /></TurnoGuard></ProtectedRoute>} />
                          <Route path="/admin/usuarios" element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsuarios /></ProtectedRoute>} />
                          <Route path="/admin/diagnostico-multiclinica" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDiagnosticoMulticlinica /></ProtectedRoute>} />
                          <Route path="/admin/arco" element={<ProtectedRoute allowedRoles={["admin"]}><ARCOAdmin /></ProtectedRoute>} />
                          <Route path="/admin/tenants" element={<ProtectedRoute><AdminTenants /></ProtectedRoute>} />
                          <Route path="/admin/tenants/:id" element={<ProtectedRoute><AdminTenantDetail /></ProtectedRoute>} />
                          <Route path="/admin/whatsapp-alertas" element={<ProtectedRoute allowedRoles={["admin"]}><WhatsappAlertas /></ProtectedRoute>} />
                          <Route path="/inteligencia" element={<ProtectedRoute allowedRoles={["admin","manager"]}><BI /></ProtectedRoute>} />
                          <Route path="/contabilidad" element={<ProtectedRoute allowedRoles={["admin","manager"]}><Contabilidad /></ProtectedRoute>} />
                          <Route path="/ayuda-interna" element={<ProtectedRoute allowedRoles={["admin","manager","receptionist"]}><AyudaInterna /></ProtectedRoute>} />
                          <Route path="/lealtad" element={<ProtectedRoute allowedRoles={["admin","manager"]}><Lealtad /></ProtectedRoute>} />

                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </React.Suspense>
          </ActiveClinicProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
