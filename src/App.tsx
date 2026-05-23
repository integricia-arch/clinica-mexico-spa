import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import AdminDashboard from "@/pages/AdminDashboard";
import PacientesLista from "@/pages/PacientesLista";
import AgendaMedico from "@/pages/AgendaMedico";
import NuevaCita from "@/pages/NuevaCita";
import DetalleCita from "@/pages/DetalleCita";
import RecepcionDashboard from "@/pages/RecepcionDashboard";
import Facturacion from "@/pages/Facturacion";
import Expedientes from "@/pages/Expedientes";
import Farmacia from "@/pages/Farmacia";
import Configuracion from "@/pages/Configuracion";
import CaminoPacienteConfig from "@/pages/configuracion/CaminoPaciente";
import Auditoria from "@/pages/Auditoria";
import Inbox from "@/pages/Inbox";
import Citas from "@/pages/Citas";
import Recordatorios from "@/pages/Recordatorios";
import AdminUsuarios from "@/pages/AdminUsuarios";
import Pitch from "@/pages/Pitch";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/pitch" element={<Pitch />} />
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
                      <Route path="/cita/:id" element={<DetalleCita />} />
                      <Route path="/recepcion" element={<ProtectedRoute allowedRoles={["admin","receptionist"]}><RecepcionDashboard /></ProtectedRoute>} />
                      <Route path="/facturacion" element={<ProtectedRoute allowedRoles={["admin","receptionist"]}><Facturacion /></ProtectedRoute>} />
                      <Route path="/expedientes" element={<ProtectedRoute allowedRoles={["admin","doctor","nurse"]}><Expedientes /></ProtectedRoute>} />
                      <Route path="/farmacia" element={<ProtectedRoute allowedRoles={["admin","doctor","nurse"]}><Farmacia /></ProtectedRoute>} />
                      <Route path="/configuracion" element={<ProtectedRoute allowedRoles={["admin"]}><Configuracion /></ProtectedRoute>} />
                      <Route path="/configuracion/camino-paciente" element={<ProtectedRoute allowedRoles={["admin"]}><CaminoPacienteConfig /></ProtectedRoute>} />
                      <Route path="/auditoria" element={<ProtectedRoute allowedRoles={["admin","receptionist"]}><Auditoria /></ProtectedRoute>} />
                      <Route path="/inbox" element={<ProtectedRoute allowedRoles={["admin","receptionist","doctor","nurse"]}><Inbox /></ProtectedRoute>} />
                      <Route path="/conversaciones" element={<ProtectedRoute allowedRoles={["admin","receptionist","doctor","nurse"]}><Inbox /></ProtectedRoute>} />
                      <Route path="/citas" element={<ProtectedRoute allowedRoles={["admin","receptionist","doctor","nurse"]}><Citas /></ProtectedRoute>} />
                      <Route path="/recordatorios" element={<ProtectedRoute allowedRoles={["admin","receptionist","doctor"]}><Recordatorios /></ProtectedRoute>} />
                      <Route path="/admin/usuarios" element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsuarios /></ProtectedRoute>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
