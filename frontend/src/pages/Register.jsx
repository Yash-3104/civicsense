import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    try {
      const res = await API.post("/api/auth/register", {
        ...form,
        role: "CITIZEN",
      });

      // auto-login after register
      setAuth(res.data);
      navigate("/");

    } catch (err) {
      console.error(err);
      alert("Registration failed");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-[380px]">
        <CardContent className="p-6 space-y-4">

          <h2 className="text-xl font-bold text-center">Create Account</h2>

          <div>
            <Label>Name</Label>
            <Input
              name="name"
              placeholder="Enter name"
              value={form.name}
              onChange={handleChange}
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              name="email"
              placeholder="Enter email"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div>
            <Label>Phone</Label>
            <Input
              name="phone"
              placeholder="Enter phone"
              value={form.phone}
              onChange={handleChange}
            />
          </div>

          <div>
            <Label>Password</Label>
            <Input
              type="password"
              name="password"
              placeholder="Enter password"
              value={form.password}
              onChange={handleChange}
            />
          </div>

          <Button className="w-full" onClick={handleRegister}>
            Register
          </Button>

          <p className="text-sm text-center">
            Already have an account?{" "}
            <span
              className="text-blue-600 cursor-pointer"
              onClick={() => navigate("/login")}
            >
              Login
            </span>
          </p>

        </CardContent>
      </Card>
    </div>
  );
}