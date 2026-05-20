import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import API from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function getDashboardPath(role) {
  switch (role) {
    case "ADMIN":
      return "/admin";

    case "WORKER":
      return "/worker";

    case "SUPERVISOR":
      return "/supervisor";

    case "OFFICER":
      return "/admin";

    case "CITIZEN":
    default:
      return "/";
  }
}

function clearAuthStorage() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");

  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      alert("Please enter email and password");
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
      alert("Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <Card className="w-[350px]">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-center text-xl font-bold">Login</h2>

          <div>
            <Label>Email</Label>
            <Input
              placeholder="Enter email"
              value={email}
              disabled={isLoggingIn}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              disabled={isLoggingIn}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleLogin();
                }
              }}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? "Logging in..." : "Login"}
          </Button>

          <p className="text-center text-sm">
            Don't have an account?{" "}
            <span
              className="cursor-pointer text-blue-600"
              onClick={() => navigate("/register")}
            >
              Register
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}