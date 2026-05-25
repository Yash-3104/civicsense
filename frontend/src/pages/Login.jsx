import { Activity, ArrowLeft, Eye, FileCheck, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
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
    <CivicSenseBackdrop>
      <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.95fr_0.8fr] lg:px-8">
        <section className="max-w-2xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-100">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="mt-10 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10">
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
            </span>
            <div>
              <p className="text-lg font-semibold text-white">CivicSense</p>
              <p className="text-sm text-zinc-500">Civic operations access</p>
            </div>
          </div>

          <h1 className="mt-8 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
            Sign in to the civic operations workspace
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
            Review reports, assignments, SLA status, and public-safe progress from the right role dashboard.
          </p>

          <div className="mt-8 grid gap-3">
            {operationPoints.map((point) => (
              <div key={point} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                {point}
              </div>
            ))}
          </div>

          <div className="mt-10 max-w-xl rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">Live operations view</p>
                <p className="text-xs text-zinc-500">Queue health at sign-in</p>
              </div>
              <Activity className="h-4 w-4 text-cyan-200" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Open reports", "Triage"],
                ["SLA queue", "Monitored"],
                ["Resolved today", "Review"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-3">
                  <p className="text-sm font-semibold text-zinc-100">{value}</p>
                  <p className="mt-1 text-xs text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">Login</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Use the account issued for your CivicSense role.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
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
                  className="h-10 border-zinc-700 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-300 focus-visible:ring-emerald-300/20"
                />
              </div>
            </div>

            <div className="space-y-2">
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
                  className="h-10 border-zinc-700 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-300 focus-visible:ring-emerald-300/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-10 w-full bg-emerald-300 text-zinc-950 hover:bg-emerald-200"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="mt-6 grid gap-3 border-t border-zinc-800 pt-5 text-sm">
            <Link className="inline-flex items-center justify-between text-zinc-300 transition hover:text-white" to="/register">
              Create account
              <FileCheck className="h-4 w-4" />
            </Link>
            <Link className="inline-flex items-center justify-between text-zinc-300 transition hover:text-white" to="/transparency">
              View public transparency
              <Eye className="h-4 w-4" />
            </Link>
            <Link className="inline-flex items-center justify-between text-zinc-500 transition hover:text-zinc-200" to="/">
              Back to home
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </CivicSenseBackdrop>
  );
}
