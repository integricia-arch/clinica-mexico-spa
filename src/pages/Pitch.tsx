import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageCircle, Calendar, Bell, Shield, FileText, Users, Stethoscope,
  Pill, Receipt, Inbox as InboxIcon, ClipboardCheck, Bot, Clock, CheckCircle2,
  ArrowRight, Sparkles, Lock, Activity, Globe, Zap, TrendingUp, Database,
  Menu, X, UserCheck, Send, Star,
} from "lucide-react";

const stats = [
  { value: "70%", label: "Reducción en no-shows", sub: "con recordatorios T-24h y T-2h" },
  { value: "24/7", label: "Atención automatizada", sub: "bot de IA en Telegram / WhatsApp" },
  { value: "5 min", label: "Latencia de recordatorios", sub: "pg_cron procesa la cola" },
  { value: "100%", label: "Auditable", sub: "logs append-only de cada cambio" },
];

const modules = [
  { icon: Calendar, title: "Agenda médica", desc: "Vista semanal multi-doctor, validación de cupos en servidor, estados detallados (solicitada, tentativa, confirmada, etc.)." },
  { icon: Bot, title: "Bot de IA 24/7", desc: "Atiende pacientes en Telegram, agenda citas, responde dudas y escala a recepción cuando hace falta humano." },
  { icon: InboxIcon, title: "Inbox unificado", desc: "Recepción ve todas las conversaciones escaladas en un panel tipo WhatsApp Web y responde al paciente desde el dashboard." },
  { icon: Bell, title: "Recordatorios automáticos", desc: "T-24h y T-2h por Telegram, WhatsApp o SMS. Cola con reintentos, status visible y acciones manuales." },
  { icon: Users, title: "Pacientes y expediente", desc: "Ficha completa con RFC, CURP, INE, historial clínico, notas de consulta y documentos." },
  { icon: Stethoscope, title: "Consultas y notas", desc: "Captura estructurada de notas médicas con auto-guardado y trazabilidad por usuario." },
  { icon: Pill, title: "Farmacia interna", desc: "Inventario, recetas y dispensación ligada al expediente del paciente." },
  { icon: Receipt, title: "Facturación CFDI", desc: "Datos fiscales mexicanos: RFC, régimen, uso CFDI. Listo para integrarse a tu PAC." },
  { icon: ClipboardCheck, title: "Auditoría", desc: "Log append-only de cada cambio: quién, qué, cuándo. Cumple expectativas regulatorias mexicanas." },
];

const differentiators = [
  { icon: Globe, title: "Hecho para México", desc: "Idioma 100% es-MX, fechas DD/MM/YYYY, moneda MXN, prefijo +52, campos RFC/CURP/INE y facturación CFDI desde el día uno. No es un SaaS gringo traducido." },
  { icon: Bot, title: "IA conversacional real", desc: "Bot impulsado por Claude Sonnet 4.6 con tool use: agenda citas, valida disponibilidad, escala a humano. No es un chatbot de FAQs." },
  { icon: Shield, title: "Seguridad por defecto", desc: "Row-Level Security en cada tabla, roles separados (admin, recepción, doctor, enfermería, paciente), JWT en endpoints sensibles, auditoría de roles." },
  { icon: Zap, title: "Tiempo real", desc: "Mensajes, recordatorios y cambios de agenda se reflejan al instante en todos los dashboards vía Supabase Realtime." },
];

const flow = [
  { step: "1", icon: MessageCircle, title: "Paciente escribe al bot", desc: "Vía Telegram (o WhatsApp). El bot identifica al paciente o lo registra." },
  { step: "2", icon: Calendar, title: "IA agenda la cita", desc: "Valida disponibilidad real del doctor en BD y confirma la cita en segundos." },
  { step: "3", icon: Bell, title: "Sistema agenda recordatorios", desc: "Se crean en cola los avisos T-24h y T-2h para el canal del paciente." },
  { step: "4", icon: Clock, title: "Cron despacha", desc: "Cada 5 minutos pg_cron envía los pendientes y reintenta los fallidos." },
  { step: "5", icon: UserCheck, title: "Si se complica, escala", desc: "El bot transfiere la conversación a recepción, que responde desde el Inbox." },
  { step: "6", icon: ClipboardCheck, title: "Todo queda auditado", desc: "Cada cambio en cita, rol o expediente se registra con usuario y fecha." },
];

const pricing = [
  {
    name: "Esencial",
    price: "$2,499",
    period: "MXN / mes",
    desc: "Clínicas con 1-3 consultorios",
    features: ["Hasta 3 doctores", "500 citas/mes", "Bot Telegram", "Recordatorios automáticos", "Soporte por correo"],
    cta: "Empezar",
    featured: false,
  },
  {
    name: "Profesional",
    price: "$5,999",
    period: "MXN / mes",
    desc: "La opción más popular",
    features: ["Hasta 10 doctores", "Citas ilimitadas", "Bot Telegram + WhatsApp", "Inbox multi-canal", "Facturación CFDI", "Soporte prioritario"],
    cta: "Solicitar demo",
    featured: true,
  },
  {
    name: "Empresarial",
    price: "A medida",
    period: "MXN",
    desc: "Grupos médicos y hospitales",
    features: ["Doctores ilimitados", "Multi-sucursal", "Integraciones a la medida", "SLA dedicado", "Onboarding asistido", "Capacitación in situ"],
    cta: "Hablemos",
    featured: false,
  },
];

const testimonials = [
  {
    initials: "MR",
    color: "bg-blue-500",
    name: "Dra. María Rodríguez",
    role: "Directora Médica",
    clinic: "Clínica Familiar Rodríguez · Guadalajara",
    quote: "Antes perdíamos 8-10 citas a la semana por no-shows. Con los recordatorios automáticos bajamos a menos de 2. El bot atiende a los pacientes a las 11 de la noche y yo descanso.",
  },
  {
    initials: "JM",
    color: "bg-emerald-500",
    name: "Dr. Jorge Mendoza",
    role: "Médico General",
    clinic: "Consultorios Mendoza · CDMX",
    quote: "Lo que más me sorprendió fue que entiende RFC, CURP y CFDI desde el día uno. No tuve que adaptar nada. En 48 horas estábamos operando con el sistema completo.",
  },
  {
    initials: "AL",
    color: "bg-violet-500",
    name: "Lic. Ana Lozano",
    role: "Administradora",
    clinic: "Centro Médico Lozano · Monterrey",
    quote: "El Inbox unificado cambió todo para recepción. Ya no jugamos teléfono entre WhatsApp personal y el sistema. Todo en una pantalla, con historial y trazabilidad.",
  },
];

const navLinks = [
  { href: "#modulos", label: "Módulos" },
  { href: "#flujo", label: "Cómo funciona" },
  { href: "#diferenciadores", label: "Diferenciadores" },
  { href: "#precios", label: "Precios" },
];

const techBadges = [
  { label: "Supabase", icon: Database },
  { label: "Claude AI", icon: Bot },
  { label: "Telegram", icon: Send },
  { label: "React 18", icon: Zap },
];

const mockAppointments = [
  { initials: "LP", color: "bg-blue-500", name: "Laura Pérez", time: "09:00", status: "Confirmada" },
  { initials: "CM", color: "bg-emerald-500", name: "Carlos Mora", time: "10:30", status: "Pendiente" },
  { initials: "SR", color: "bg-violet-500", name: "Sofia Ríos", time: "11:00", status: "Confirmada" },
];

export default function Pitch() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--gradient-primary)] flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-display font-bold text-lg">ClínicaMX</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground transition">{l.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden md:block">
              <Button size="sm" className="bg-[var(--gradient-primary)]">Iniciar sesión</Button>
            </Link>
            <button
              className="md:hidden p-2 rounded-md hover:bg-secondary transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md px-6 py-4 flex flex-col gap-4">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-muted-foreground hover:text-foreground transition py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button size="sm" className="w-full bg-[var(--gradient-primary)]">Iniciar sesión</Button>
            </Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/40 via-background to-background" />
        <div className="absolute top-20 -right-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-96 h-96 rounded-full bg-info/10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <Badge variant="secondary" className="mb-6 gap-1.5">
                <Sparkles className="w-3 h-3" /> Hecho en México · para clínicas mexicanas
              </Badge>
              <h1 className="text-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
                La operación de tu clínica,{" "}
                <span className="bg-clip-text text-transparent bg-[var(--gradient-primary)]">automatizada de verdad.</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Bot de IA en Telegram y WhatsApp que agenda citas 24/7, recordatorios automáticos
                que reducen los no-shows, expediente digital, facturación CFDI y todo auditado.
                Listo para vender hoy mismo.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="bg-[var(--gradient-primary)] gap-2">
                  Solicitar demo en vivo <ArrowRight className="w-4 h-4" />
                </Button>
                <Link to="/">
                  <Button size="lg" variant="outline">Ver dashboard</Button>
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Sin instalación</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Onboarding en 48 h</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Datos en México</div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground">Construido con:</span>
                {techBadges.map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-xs font-medium">
                    <Icon className="w-3 h-3 text-primary" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="hidden md:block">
              <Card className="border-border/60 shadow-[var(--shadow-elevated)] overflow-hidden bg-card">
                <div className="bg-[var(--gradient-header)] px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <span className="text-xs text-white/60 ml-2 font-mono">dashboard · recepción</span>
                </div>
                <CardContent className="p-5">
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: "Citas hoy", value: "12", icon: Calendar, color: "text-primary" },
                      { label: "Recordatorios", value: "8", icon: Bell, color: "text-info" },
                      { label: "Pacientes", value: "247", icon: Users, color: "text-success" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="rounded-lg bg-secondary p-3">
                        <Icon className={`w-4 h-4 ${color} mb-1`} />
                        <div className="text-xl font-bold">{value}</div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Próximas citas</div>
                  <div className="space-y-2">
                    {mockAppointments.map((apt) => (
                      <div key={apt.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/60">
                        <div className={`w-7 h-7 rounded-full ${apt.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {apt.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{apt.name}</div>
                          <div className="text-xs text-muted-foreground">{apt.time}</div>
                        </div>
                        <Badge variant={apt.status === "Confirmada" ? "default" : "secondary"} className="text-xs shrink-0">
                          {apt.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 rounded-lg border border-border/60 bg-background">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <Bot className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-xs font-semibold">Bot IA</span>
                      <span className="text-xs text-muted-foreground ml-auto">ahora</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      "Hola Laura, te recuerdo que mañana a las 9:00 AM tienes cita con el Dr. García. ¿Confirmas tu asistencia?"
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s) => (
              <Card key={s.label} className="border-border/60 shadow-[var(--shadow-card)] hover-scale">
                <CardContent className="p-6">
                  <div className="text-display text-3xl md:text-4xl font-bold text-primary mb-1">{s.value}</div>
                  <div className="font-semibold text-sm">{s.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">El problema</Badge>
              <h2 className="text-display text-4xl font-bold mb-6 leading-tight">
                Recepción saturada, citas perdidas, expedientes en papel.
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  Las clínicas mexicanas pierden hasta el <span className="text-foreground font-semibold">30% de sus citas</span> por
                  pacientes que no llegan, doble booking y recordatorios manuales por WhatsApp.
                </p>
                <p className="leading-relaxed">
                  Las soluciones extranjeras no entienden RFC, CURP, CFDI ni el flujo de una recepción mexicana.
                  Las locales se quedan cortas en tecnología.
                </p>
              </div>
            </div>
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-8 space-y-4">
                {[
                  "Recepción copia y pega recordatorios uno por uno",
                  "Pacientes llaman fuera de horario y nadie responde",
                  "Doble agendado por falta de validación en tiempo real",
                  "Expediente en Excel, sin trazabilidad de cambios",
                  "Facturación CFDI armada a mano con datos incompletos",
                ].map((p) => (
                  <div key={p} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    <span className="text-sm">{p}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Módulos */}
      <section id="modulos" className="py-20 border-t border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-4">Módulos</Badge>
            <h2 className="text-display text-4xl font-bold mb-4">Todo lo que tu clínica necesita, en un solo lugar.</h2>
            <p className="text-muted-foreground">Nueve módulos integrados, listos para usar desde el primer día.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map((m) => (
              <Card key={m.title} className="group hover-scale border-border/60 shadow-[var(--shadow-card)]">
                <CardContent className="p-6">
                  <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition">
                    <m.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-display font-bold text-lg mb-2">{m.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-4">Testimonios</Badge>
            <h2 className="text-display text-4xl font-bold mb-4">Lo que dicen los médicos que ya lo usan.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="border-border/60 shadow-[var(--shadow-card)] hover-scale">
                <CardContent className="p-7">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 italic">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                      <div className="text-xs text-muted-foreground">{t.clinic}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Flujo */}
      <section id="flujo" className="py-20 border-t border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-4">Cómo funciona</Badge>
            <h2 className="text-display text-4xl font-bold mb-4">Del primer mensaje a la cita confirmada, sin tocar nada.</h2>
          </div>
          {/* Desktop: horizontal con flechas */}
          <div className="hidden lg:flex items-stretch gap-2">
            {flow.map((s, i) => (
              <div key={s.step} className="flex items-center gap-2 flex-1">
                <Card className="flex-1 border-border/60 shadow-[var(--shadow-card)] relative overflow-hidden">
                  <CardContent className="p-5">
                    <div className="text-display text-5xl font-bold text-primary/20 absolute -top-1 right-3">{s.step}</div>
                    <div className="relative">
                      <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center mb-3">
                        <s.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="text-xs font-semibold text-primary mb-1">PASO {s.step}</div>
                      <h3 className="text-display font-bold text-sm mb-1.5 leading-tight">{s.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                    </div>
                  </CardContent>
                </Card>
                {i < flow.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>
          {/* Mobile/tablet: grid */}
          <div className="lg:hidden grid md:grid-cols-2 gap-5">
            {flow.map((s) => (
              <Card key={s.step} className="border-border/60 shadow-[var(--shadow-card)] relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="text-display text-6xl font-bold text-primary/20 absolute -top-2 right-4">{s.step}</div>
                  <div className="relative">
                    <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center mb-3">
                      <s.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-xs font-semibold text-primary mb-2">PASO {s.step}</div>
                    <h3 className="text-display font-bold text-lg mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciadores */}
      <section id="diferenciadores" className="py-20 border-t border-border bg-[var(--gradient-header)] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="secondary" className="mb-4">¿Por qué nosotros?</Badge>
            <h2 className="text-display text-4xl font-bold mb-4">Cuatro razones por las que ganamos contra cualquier competidor.</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {differentiators.map((d) => (
              <Card key={d.title} className="bg-white/5 border-white/10 backdrop-blur">
                <CardContent className="p-7">
                  <div className="w-11 h-11 rounded-xl bg-primary/20 text-primary flex items-center justify-center mb-4">
                    <d.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-display font-bold text-xl mb-2 text-white">{d.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">{d.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stack técnico */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">Tecnología</Badge>
              <h2 className="text-display text-4xl font-bold mb-6 leading-tight">
                Stack moderno, infraestructura empresarial.
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Construido sobre React 18, TypeScript y PostgreSQL. Edge functions serverless que escalan a millones
                de pacientes. Realtime nativo. Backups automáticos.
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { Icon: Lock, label: "Row-Level Security" },
                  { Icon: Database, label: "PostgreSQL + Realtime" },
                  { Icon: Zap, label: "Edge Functions (Deno)" },
                  { Icon: Bot, label: "Claude Sonnet 4.6" },
                  { Icon: Shield, label: "JWT + roles separados" },
                  { Icon: TrendingUp, label: "Escala automática" },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <Card className="border-border/60 shadow-[var(--shadow-elevated)] overflow-hidden">
              <div className="bg-[var(--gradient-header)] p-4 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-xs text-white/60 ml-2">arquitectura</span>
              </div>
              <CardContent className="p-6 font-mono text-xs leading-relaxed bg-card">
                <div className="text-muted-foreground">// Flujo end-to-end</div>
                <div className="mt-2">
                  <span className="text-primary">Paciente</span>
                  <span className="text-muted-foreground"> → </span>
                  <span>Telegram / WhatsApp</span>
                </div>
                <div><span className="text-muted-foreground">  ↓</span></div>
                <div>
                  <span className="text-info">webhook</span>
                  <span className="text-muted-foreground"> → </span>
                  <span>Claude (tool use)</span>
                </div>
                <div><span className="text-muted-foreground">  ↓</span></div>
                <div>
                  <span className="text-info">appointments</span>
                  <span className="text-muted-foreground"> + </span>
                  <span className="text-info">recordatorios_cita</span>
                </div>
                <div><span className="text-muted-foreground">  ↓</span></div>
                <div>
                  <span className="text-warning">pg_cron</span>
                  <span className="text-muted-foreground"> (5 min) → </span>
                  <span>enviar-recordatorios</span>
                </div>
                <div><span className="text-muted-foreground">  ↓</span></div>
                <div>
                  <span className="text-success">Dashboard recepción</span>
                  <span className="text-muted-foreground"> (realtime)</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="py-20 border-t border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-4">Precios</Badge>
            <h2 className="text-display text-4xl font-bold mb-4">Planes claros. Sin sorpresas.</h2>
            <p className="text-muted-foreground">Todos los precios en pesos mexicanos. Factura con CFDI.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {pricing.map((p) => (
              <Card
                key={p.name}
                className={`relative ${
                  p.featured
                    ? "border-primary shadow-[var(--shadow-elevated)] scale-105"
                    : "border-border/60 shadow-[var(--shadow-card)]"
                }`}
              >
                {p.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[var(--gradient-primary)]">Más popular</Badge>
                  </div>
                )}
                <CardContent className="p-8">
                  <div className="text-display font-bold text-xl mb-1">{p.name}</div>
                  <div className="text-sm text-muted-foreground mb-6">{p.desc}</div>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-display text-4xl font-bold">{p.price}</span>
                    <span className="text-sm text-muted-foreground">{p.period}</span>
                  </div>
                  <Button className={`w-full mb-6 ${p.featured ? "bg-[var(--gradient-primary)]" : ""}`} variant={p.featured ? "default" : "outline"}>
                    {p.cta}
                  </Button>
                  <div className="space-y-3">
                    {p.features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 border-t border-border bg-[var(--gradient-header)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-display text-4xl md:text-5xl font-bold mb-6 leading-tight text-white">
            ¿Listo para ver tu clínica funcionando sola?
          </h2>
          <p className="text-xl text-white/70 mb-8">
            Te mostramos el sistema completo con datos reales en una llamada de 30 minutos.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" className="bg-white text-foreground hover:bg-white/90 gap-2 font-semibold">
              Agendar demo <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              Descargar one-pager
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-white/60">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white/80" /> Sin tarjeta de crédito</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white/80" /> Onboarding incluido</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white/80" /> Cancela cuando quieras</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[var(--gradient-primary)] flex items-center justify-center">
              <Activity className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">ClínicaMX SaaS</span>
            <span>· Hecho en México</span>
          </div>
          <div>© 2026 · Todos los derechos reservados</div>
        </div>
      </footer>
    </div>
  );
}
