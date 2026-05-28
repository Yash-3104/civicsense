import { ArrowLeft, ArrowRight, Eye, FileCheck, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import CivicSenseBackdrop from "@/components/brand/CivicSenseBackdrop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import API from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

const citizenScope = [
  ["Report Evidence", "Attach location, severity, category, and supporting details."],
  ["Public Registry", "Follow public-safe status as the report moves through review."],
  ["Audit Timeline", "Track verification, assignment, and closure decisions."],
];

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isRegistering, setIsRegistering] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      toast.error("Name is required", {
        description: "Please enter your full name.",
      });
      return false;
    }

    if (!form.email.trim()) {
      toast.error("Email is required", {
        description: "Please enter an email address.",
      });
      return false;
    }

    if (!form.password.trim()) {
      toast.error("Password is required", {
        description: "Please enter a password.",
      });
      return false;
    }

    if (form.password.length < 6) {
      toast.error("Password is too short", {
        description: "Use at least 6 characters.",
      });
      return false;
    }

    return true;
  };

  const handleRegister = async (event) => {
    event?.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsRegistering(true);

    try {
      const res = await API.post("/api/auth/register", {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role: "CITIZEN",
      });

      setAuth(res.data);
      toast.success("Citizen account created", {
        description: "You can now report and track civic issues.",
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error(err);

      const message =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Registration failed. Please check the details and try again.";

      toast.error("Registration failed", {
        description: message,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <CivicSenseBackdrop className="bg-[#0b0f12]">
      <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[0.88fr_0.74fr] lg:px-8 lg:py-4">
        <section className="max-w-2xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="mt-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10">
              <FileCheck className="h-5 w-5 text-emerald-200" />
            </span>
            <div>
              <p className="text-base font-semibold text-white">CivicSense</p>
              <p className="text-sm text-zinc-500">Citizen reporting access</p>
            </div>
          </div>

          <h1 className="mt-5 max-w-xl text-3xl font-semibold tracking-normal text-white sm:text-[2.1rem] sm:leading-tight lg:text-[2.15rem]">
            Create a citizen account for public issue reporting
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
            Submit civic reports with location and evidence, then track verification, assignment, and closure progress.
          </p>

          <div className="mt-5 max-w-xl rounded-xl border border-zinc-800 bg-zinc-950/[0.7] p-3.5">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
              <div>
                <p className="text-sm font-semibold text-zinc-100">Citizen account scope</p>
                <p className="mt-1 text-sm leading-5 text-zinc-400">
                  Public registration creates a citizen account. Staff access is created by admins.
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {citizenScope.map(([title, description]) => (
                <div key={title} className="rounded-lg border border-zinc-800 bg-zinc-900/45 px-3 py-2 sm:grid sm:grid-cols-[8.5rem_1fr] sm:items-start sm:gap-3">
                  <p className="text-sm font-semibold text-zinc-100">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-zinc-500 sm:mt-0">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full rounded-xl border border-zinc-800 bg-zinc-950/[0.88] p-4 shadow-[0_2px_10px_rgba(0,0,0,0.24)] sm:p-5 lg:justify-self-end">
          <div className="mb-3.5">
            <h2 className="text-[1.35rem] font-semibold text-white">Citizen registration</h2>
            <p className="mt-1.5 text-sm leading-6 text-zinc-400">
              This creates a citizen account and sends you to the reporting dashboard.
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleRegister}>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-zinc-200">
                Name
              </Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder="Full name"
                  value={form.name}
                  disabled={isRegistering}
                  onChange={handleChange}
                  className="h-10 border-zinc-700 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-zinc-200">
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  disabled={isRegistering}
                  onChange={handleChange}
                  className="h-10 border-zinc-700 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-zinc-200">
                Phone
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="phone"
                  name="phone"
                  autoComplete="tel"
                  placeholder="Phone number"
                  value={form.phone}
                  disabled={isRegistering}
                  onChange={handleChange}
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
                  name="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={form.password}
                  disabled={isRegistering}
                  onChange={handleChange}
                  className="h-10 border-zinc-700 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </div>

            <div className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-900/45 px-3 py-2 text-xs leading-5 text-zinc-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
              <p>Contact details are used for report ownership and follow-up.</p>
            </div>

            <Button
              type="submit"
              className="h-10 w-full bg-emerald-300 text-zinc-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              disabled={isRegistering}
            >
              {isRegistering ? "Creating account..." : "Create citizen account"}
            </Button>
          </form>

          <div className="mt-4 border-t border-zinc-800 pt-4">
            <p className="mb-1.5 text-xs font-medium text-zinc-500">Already registered?</p>
            <div className="grid gap-1 text-sm">
              <Link className="inline-flex items-center justify-between rounded-lg px-2 py-1.5 text-zinc-300 transition hover:bg-zinc-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50" to="/login">
                Login to CivicSense
                <UserRound className="h-4 w-4" />
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
