import {
  ArrowRight,
  CheckCircle2,
  Clock3,
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

const features = [
  {
    title: "AI-assisted issue verification",
    description: "Review location, category, and evidence before reports move into operations.",
    icon: ShieldCheck,
  },
  {
    title: "SLA tracking and escalation",
    description: "Track deadlines, escalated issues, and pending closure evidence in one queue.",
    icon: Clock3,
  },
  {
    title: "Worker and supervisor operations",
    description: "Assign field work, submit resolution proof, and review closure evidence.",
    icon: UsersRound,
  },
  {
    title: "Public transparency and audit exports",
    description: "Publish public-safe progress and export records for accountability reviews.",
    icon: FileText,
  },
];

const roles = [
  ["Citizen", "Report civic issues with location, category, severity, and evidence."],
  ["Admin", "Triage reports, assign teams, verify issues, and manage staff access."],
  ["Worker", "Work assigned reports and submit resolution evidence for review."],
  ["Supervisor", "Monitor department queues, review closure evidence, and handle escalations."],
];

function PlatformPreview() {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/80 p-3 shadow-[0_2px_8px_rgba(0,0,0,0.22)]">
      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="min-h-[300px] rounded-lg border border-zinc-800 bg-[#11161a] p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-100">City service map</p>
              <p className="text-xs text-zinc-500">Ward grid and open report locations</p>
            </div>
            <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
              Live queue
            </span>
          </div>

          <div className="relative h-64 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:36px_36px]" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 260" fill="none">
              <path d="M20 78 H128 V134 H228 V198 H392" stroke="rgba(34,211,238,0.32)" strokeWidth="2" />
              <path d="M88 18 V86 H190 V154 H320 V238" stroke="rgba(16,185,129,0.28)" strokeWidth="2" />
              <path d="M16 190 C92 132 156 220 240 154 S350 120 410 145" stroke="rgba(251,191,36,0.3)" strokeWidth="2" strokeDasharray="7 9" />
            </svg>

            {[
              ["left-[18%] top-[30%]", "bg-amber-300", "Pothole"],
              ["left-[52%] top-[52%]", "bg-rose-300", "Drainage"],
              ["left-[76%] top-[37%]", "bg-cyan-300", "Streetlight"],
              ["left-[34%] top-[70%]", "bg-emerald-300", "Resolved"],
            ].map(([position, color, label]) => (
              <div key={label} className={`absolute ${position}`}>
                <span className={`block h-3 w-3 rounded-full ${color} ring-4 ring-white/10`} />
                <span className="mt-1 block rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-1 text-[11px] text-zinc-300">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Layers className="h-4 w-4 text-cyan-200" />
              SLA queue
            </div>
            {[
              ["Escalated", "Drainage overflow", "2h left", "text-amber-200"],
              ["Pending closure", "Streetlight repair", "Review", "text-cyan-200"],
              ["Assigned", "Road surface", "Ward 12", "text-emerald-200"],
            ].map(([status, label, meta, tone]) => (
              <div key={label} className="flex items-center justify-between border-t border-zinc-800 py-2 first:border-t-0 first:pt-0">
                <div>
                  <p className="text-xs font-medium text-zinc-200">{label}</p>
                  <p className={`text-[11px] ${tone}`}>{status}</p>
                </div>
                <p className="text-[11px] text-zinc-500">{meta}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Public registry", "Open"],
                ["Exports", "XLSX"],
                ["Evidence", "Reviewed"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2">
                  <p className="text-xs font-semibold text-zinc-100">{value}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-200" />
              Operations timeline
            </div>
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
  );
}

export default function LandingPage() {
  return (
    <CivicSenseBackdrop>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10">
            <MapPin className="h-4 w-4 text-emerald-200" />
          </span>
          CivicSense
        </Link>

        <nav className="flex items-center gap-2">
          <Button asChild variant="outline" className="border-zinc-700 bg-zinc-950/80 text-zinc-100 hover:bg-zinc-900">
            <Link to="/transparency">Transparency</Link>
          </Button>
          <Button asChild className="bg-emerald-300 text-zinc-950 hover:bg-emerald-200">
            <Link to="/login">
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-7xl items-center gap-10 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-semibold tracking-normal text-white sm:text-6xl">
              CivicSense
            </h1>
            <p className="mt-4 text-xl font-medium text-zinc-200">
              AI-powered public infrastructure reporting and governance
            </p>
            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400">
              Citizens report civic issues, operations teams resolve them, and the public gets a transparent view of progress.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-10 bg-emerald-300 px-4 text-zinc-950 hover:bg-emerald-200">
                <Link to="/register">
                  Report an Issue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-10 border-zinc-700 bg-zinc-950/80 px-4 text-zinc-100 hover:bg-zinc-900">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild variant="ghost" className="h-10 px-4 text-zinc-300 hover:bg-zinc-900/80 hover:text-white">
                <Link to="/transparency">View Public Transparency</Link>
              </Button>
            </div>

            <div className="mt-10 border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400">
              Built with Spring Boot, PostgreSQL, React, WebSockets, XLSX exports, and AI verification.
            </div>
          </div>

          <PlatformPreview />
        </section>

        <section className="border-y border-white/10 bg-zinc-950/60">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
                  <Icon className="h-5 w-5 text-emerald-200" />
                  <h2 className="mt-4 text-base font-semibold text-zinc-100">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-3 md:grid-cols-4">
            {roles.map(([role, description]) => (
              <div key={role} className="border-l border-zinc-700 pl-4">
                <h2 className="text-sm font-semibold text-zinc-100">{role}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
        CivicSense MVP · Public infrastructure accountability layer
      </footer>
    </CivicSenseBackdrop>
  );
}
