import { ArrowLeft, ArrowRight, Eye, FileCheck, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import CivicSenseBackdrop from "@/components/brand/CivicSenseBackdrop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import API from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

function getDashboardPath(role) {
  switch (role) {
    case "ADMIN":
      return "/admin";

    case "SUPERVISOR":
      return "/supervisor";

    case "WORKER":
    case "OFFICER":
      return "/worker";

    case "CITIZEN":
    default:
      return "/dashboard";
  }
}

function clearAuthStorage() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");

  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

const operationPoints = [
  "AI-assisted verification",
  "SLA escalation and assignment",
  "Transparent public progress",
];

const roleAccess = ["Citizen", "Admin", "Worker", "Supervisor"];

const workspaceSteps = [
  ["Triage", "Verify category, severity, duplicate risk, and routing."],
  ["Assignment", "Move accepted reports into the right department queue."],
  ["Review", "Check closure evidence before public status is finalized."],
];

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (event) => {
    event?.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Missing credentials", {
        description: "Please enter email and password.",
      });
      return;
    }

    setIsLoggingIn(true);

    try {
      queryClient.clear();
      logout();
      clearAuthStorage();

      const response = await API.post("/api/auth/login", {
        email: email.trim(),
        password,
      });

      const authData = response.data;

      setAuth(authData);

      queryClient.clear();

      navigate(getDashboardPath(authData?.role), {
        replace: true,
      });
    } catch (error) {
      console.error(error);

      const message =
        error?.response?.data?.message ||
        error?.response?.data ||
        "Login failed. Please check your credentials.";

      toast.error("Login failed", {
        description: message,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <CivicSenseBackdrop className="bg-[#0b0f12]">
      <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[0.92fr_0.72fr] lg:px-8 lg:py-4">
        <section className="max-w-2xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="mt-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10">
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
            </span>
            <div>
              <p className="text-base font-semibold text-white">CivicSense</p>
              <p className="text-sm text-zinc-500">Civic operations access</p>
            </div>
          </div>

          <h1 className="mt-5 max-w-xl text-3xl font-semibold tracking-normal text-white sm:text-[2.1rem] sm:leading-tight lg:text-[2.15rem]">
            Sign in to the civic operations workspace
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
            Review reports, assignments, SLA status, and public-safe progress from the right role dashboard.
          </p>

          <div className="mt-4 grid gap-2">
            {operationPoints.map((point) => (
              <div key={point} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                {point}
              </div>
            ))}
          </div>

          <div className="mt-5 max-w-xl rounded-xl border border-zinc-800 bg-zinc-950/[0.7] p-3.5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">Role-based workspace</p>
                <p className="mt-0.5 text-xs text-zinc-500">Shared reports move through controlled staff actions.</p>
              </div>
              <span className="w-fit rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-500">
                Access controlled
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              {workspaceSteps.map(([title, description], index) => (
                <div key={title} className="flex gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/45 p-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 text-xs font-semibold text-emerald-200">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-950/[0.88] p-4 shadow-[0_2px_10px_rgba(0,0,0,0.24)] sm:p-5">
          <div className="mb-3.5">
            <h2 className="text-[1.35rem] font-semibold text-white">Login</h2>
            <p className="mt-1.5 text-sm leading-6 text-zinc-400">
              Use the account assigned to your CivicSense role.
            </p>
          </div>

          <div className="mb-4">
            <p className="mb-1.5 text-xs font-medium text-zinc-500">Role access</p>
            <div className="flex flex-wrap gap-1.5">
              {roleAccess.map((role) => (
                <span key={role} className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-[11px] text-zinc-400">
                  {role}
                </span>
              ))}
            </div>
          </div>

          <form className="space-y-3" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-zinc-200">
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@city.gov"
                  value={email}
                  disabled={isLoggingIn}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 border-zinc-700 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-zinc-200">
                Password
              </Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={password}
                  disabled={isLoggingIn}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-10 border-zinc-700 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-10 w-full bg-emerald-300 text-zinc-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="mt-4 border-t border-zinc-800 pt-4">
            <p className="mb-1.5 text-xs font-medium text-zinc-500">Other access</p>
            <div className="grid gap-1 text-sm">
              <Link className="inline-flex items-center justify-between rounded-lg px-2 py-1.5 text-zinc-300 transition hover:bg-zinc-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50" to="/register">
                Create citizen account
                <FileCheck className="h-4 w-4" />
              </Link>
              <Link className="inline-flex items-center justify-between rounded-lg px-2 py-1.5 text-zinc-300 transition hover:bg-zinc-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50" to="/transparency">
                View public transparency
                <Eye className="h-4 w-4" />
              </Link>
              <Link className="inline-flex items-center justify-between rounded-lg px-2 py-1.5 text-zinc-300 transition hover:bg-zinc-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50" to="/">
                Back to home
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </CivicSenseBackdrop>
  );
}
