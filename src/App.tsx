import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Pacientes from "@/pages/Pacientes";
import Agenda from "@/pages/Agenda";
import Facturacion from "@/pages/Facturacion";
import Expedientes from "@/pages/Expedientes";
import Farmacia from "@/pages/Farmacia";
import Configuracion from "@/pages/Configuracion";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/*"
            element={
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/pacientes" element={<Pacientes />} />
                  <Route path="/agenda" element={<Agenda />} />
                  <Route path="/facturacion" element={<Facturacion />} />
                  <Route path="/expedientes" element={<Expedientes />} />
                  <Route path="/farmacia" element={<Farmacia />} />
                  <Route path="/configuracion" element={<Configuracion />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
