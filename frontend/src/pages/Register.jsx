import { ArrowLeft, Eye, FileCheck, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import CivicSenseBackdrop from "@/components/brand/CivicSenseBackdrop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import API from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

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
    <CivicSenseBackdrop>
      <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_0.82fr] lg:px-8">
        <section className="max-w-2xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-100">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="mt-10 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10">
              <FileCheck className="h-5 w-5 text-emerald-200" />
            </span>
            <div>
              <p className="text-lg font-semibold text-white">CivicSense</p>
              <p className="text-sm text-zinc-500">Citizen reporting access</p>
            </div>
          </div>

          <h1 className="mt-8 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
            Create a citizen account for public issue reporting
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
            Submit civic reports with location and evidence, then track verification, assignment, and closure progress.
          </p>

          <div className="mt-10 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-sm font-semibold text-zinc-100">Registration scope</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Public registration creates a citizen account. Staff accounts are created by admins.
            </p>
            <div className="mt-4 grid gap-2 text-sm text-zinc-300">
              {["Report Evidence", "Public Registry", "Audit Timeline"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">Citizen registration</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Use your contact details for report ownership and follow-up.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="space-y-2">
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
                  className="h-10 border-zinc-700 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-300 focus-visible:ring-emerald-300/20"
                />
              </div>
            </div>

            <div className="space-y-2">
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
                  className="h-10 border-zinc-700 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-300 focus-visible:ring-emerald-300/20"
                />
              </div>
            </div>

            <div className="space-y-2">
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
                  name="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={form.password}
                  disabled={isRegistering}
                  onChange={handleChange}
                  className="h-10 border-zinc-700 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-300 focus-visible:ring-emerald-300/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-10 w-full bg-emerald-300 text-zinc-950 hover:bg-emerald-200"
              disabled={isRegistering}
            >
              {isRegistering ? "Creating account..." : "Create citizen account"}
            </Button>
          </form>

          <div className="mt-6 grid gap-3 border-t border-zinc-800 pt-5 text-sm">
            <Link className="inline-flex items-center justify-between text-zinc-300 transition hover:text-white" to="/login">
              Already have an account?
              <UserRound className="h-4 w-4" />
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
