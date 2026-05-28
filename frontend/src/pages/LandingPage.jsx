import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Layers,
  LogIn,
  MapPin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import CivicSenseBackdrop from "@/components/brand/CivicSenseBackdrop";
import { Button } from "@/components/ui/button";

const workflowSteps = [
  {
    step: "01",
    title: "Citizen reports",
    description: "Location, category, severity, and evidence are attached to the report.",
    icon: MapPin,
  },
  {
    step: "02",
    title: "AI verifies and routes",
    description: "Category fit, duplicate risk, and department routing are checked.",
    icon: ShieldCheck,
  },
  {
    step: "03",
    title: "Operations resolve",
    description: "Teams act on assigned issues and submit closure evidence.",
    icon: UsersRound,
  },
  {
    step: "04",
    title: "Public progress stays visible",
    description: "Safe status updates and audit exports support accountability.",
    icon: FileText,
  },
];

const roles = [
  ["Citizen", "Report issues with location, category, severity, and evidence."],
  ["Admin", "Triage reports, verify issues, assign teams, and manage staff access."],
  ["Worker", "Resolve assigned field work and submit closure evidence."],
  ["Supervisor", "Monitor department queues, review evidence, and handle escalations."],
];

function PlatformPreview() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-950/[0.78] p-3 shadow-[0_2px_10px_rgba(0,0,0,0.22)]">
      <div className="mb-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Civic operations console</p>
          <p className="text-xs text-zinc-500">Map, SLA queue, evidence, and timeline</p>
        </div>
        <span className="w-fit rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-xs text-zinc-400">
          Public-safe view
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.18fr_0.95fr]">
        <div className="rounded-lg border border-zinc-800 bg-[#11161a] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Public issue map</p>
              <p className="text-xs text-zinc-500">Ward grid with active report locations</p>
            </div>
            <span className="shrink-0 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-200">
              Registry
            </span>
          </div>

          <div className="relative h-52 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 sm:h-56">
            <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:36px_36px]" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 260" fill="none">
              <path d="M20 78 H128 V134 H228 V198 H392" stroke="rgba(34,211,238,0.2)" strokeWidth="2" />
              <path d="M88 18 V86 H190 V154 H320 V238" stroke="rgba(16,185,129,0.2)" strokeWidth="2" />
              <path d="M16 190 C92 132 156 220 240 154 S350 120 410 145" stroke="rgba(251,191,36,0.2)" strokeWidth="2" strokeDasharray="7 9" />
            </svg>

            {[
              ["left-[18%] top-[30%]", "bg-amber-300", "Pothole"],
              ["left-[52%] top-[52%]", "bg-rose-300", "Drainage"],
              ["left-[76%] top-[37%]", "bg-cyan-300", "Streetlight"],
              ["left-[34%] top-[70%]", "bg-emerald-300", "Resolved"],
            ].map(([position, color, label]) => (
              <div key={label} className={`absolute ${position}`}>
                <span className={`block h-3 w-3 rounded-full ${color} ring-4 ring-zinc-950/50`} />
                <span className="mt-1 block rounded-md border border-zinc-700 bg-zinc-950/95 px-2 py-1 text-[11px] font-medium text-zinc-200">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/[0.68] p-3">
            <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Layers className="h-4 w-4 text-cyan-200" />
              SLA queue
            </div>
            {[
              ["Escalated", "Drainage overflow", "2h left", "text-amber-200"],
              ["Pending closure", "Streetlight repair", "Review", "text-cyan-200"],
              ["Assigned", "Road surface", "Ward 12", "text-emerald-200"],
            ].map(([status, label, meta, tone]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-t border-zinc-800/90 py-2 first:border-t-0 first:pt-0">
                <div>
                  <p className="text-xs font-medium text-zinc-200">{label}</p>
                  <p className={`text-[11px] ${tone}`}>{status}</p>
                </div>
                <p className="shrink-0 text-[11px] text-zinc-500">{meta}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/[0.68] p-3">
            <p className="mb-2.5 text-sm font-semibold text-zinc-100">Closure review</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Registry", "Open"],
                ["Export", "XLSX"],
                ["Evidence", "Ready"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-2">
                  <p className="text-xs font-semibold text-zinc-100">{value}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/[0.68] p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-200" />
              Operations timeline
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-3">
              {["Reported", "Verified", "Assigned", "Closure review"].map((step) => (
                <div key={step} className="flex items-center gap-2 py-1.5 text-xs text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <CivicSenseBackdrop>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10">
            <MapPin className="h-4 w-4 text-emerald-200" />
          </span>
          <span className="truncate">CivicSense</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Button asChild variant="outline" className="h-9 border-zinc-700 bg-zinc-950/75 px-3 text-zinc-100 hover:bg-zinc-900 focus-visible:ring-emerald-300/40">
            <Link to="/transparency">Transparency</Link>
          </Button>
          <Button asChild className="h-9 bg-emerald-300 px-3 text-zinc-950 hover:bg-emerald-200 focus-visible:ring-emerald-300/40">
            <Link to="/login">
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100vh-5.25rem)] w-full max-w-7xl items-center gap-7 px-4 pb-9 pt-4 sm:px-6 lg:grid-cols-[0.82fr_1fr] lg:px-8">
          <div className="max-w-xl">
            <div className="rounded-xl border border-white/[0.06] bg-zinc-950/[0.18] p-4 backdrop-blur-[1px] sm:p-5 lg:bg-transparent lg:p-0 lg:backdrop-blur-0">
              <h1 className="text-4xl font-semibold tracking-normal text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.02]">
                CivicSense
              </h1>
              <p className="mt-4 max-w-lg text-lg font-medium leading-7 text-zinc-200 sm:text-xl sm:leading-8">
                Public infrastructure reporting and operations governance.
              </p>
              <p className="mt-4 max-w-lg text-base leading-7 text-zinc-400">
                Citizens report civic issues, operations teams resolve them, and the public gets a transparent view of progress.
              </p>

              <div className="mt-7">
                <Button asChild className="h-11 bg-emerald-300 px-5 text-zinc-950 hover:bg-emerald-200 focus-visible:ring-emerald-300/40">
                  <Link to="/register">
                    Report an Issue
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-7 max-w-lg rounded-lg border border-white/[0.06] bg-zinc-950/45 px-3.5 py-3 text-sm leading-6 text-zinc-400">
              Spring Boot, PostgreSQL, React, WebSockets, XLSX exports, and AI-assisted verification.
            </div>
          </div>

          <PlatformPreview />
        </section>

        <section className="border-y border-white/10 bg-zinc-950/[0.72]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="mb-8 max-w-2xl">
              <h2 className="text-2xl font-semibold text-white">How CivicSense works</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                A civic workflow from first report to public-safe progress, built around routing, evidence, and accountability.
              </p>
            </div>

            <div className="relative grid gap-4 md:grid-cols-4">
              <div className="absolute left-8 right-8 top-[2.1rem] hidden h-px bg-zinc-800/80 md:block" />
              {workflowSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="relative flex min-h-[216px] flex-col rounded-lg border border-zinc-800 bg-zinc-950/[0.84] p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
                        <Icon className="h-5 w-5 text-emerald-200" />
                      </span>
                      <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs font-semibold text-zinc-500">{step.step}</span>
                    </div>
                    <h3 className="text-base font-semibold text-zinc-100">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{step.description}</p>
                  </article>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              {roles.map(([role, description]) => (
                <article key={role} className="rounded-lg border border-zinc-800/90 bg-zinc-900/[0.42] p-4">
                  <h3 className="text-sm font-semibold text-zinc-100">{role}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-zinc-950/[0.78] px-4 py-8 text-center text-sm text-zinc-400">
        CivicSense MVP - Public infrastructure accountability layer
      </footer>
    </CivicSenseBackdrop>
  );
}
