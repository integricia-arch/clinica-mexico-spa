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
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<AdminDashboard />} />
                      <Route path="/pacientes" element={<PacientesLista />} />
                      <Route path="/agenda" element={<AgendaMedico />} />
                      <Route path="/nueva-cita" element={<NuevaCita />} />
                      <Route path="/cita/:id" element={<DetalleCita />} />
                      <Route path="/recepcion" element={<RecepcionDashboard />} />
                      <Route path="/facturacion" element={<Facturacion />} />
                      <Route path="/expedientes" element={<Expedientes />} />
                      <Route path="/farmacia" element={<Farmacia />} />
                      <Route path="/configuracion" element={<Configuracion />} />
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
