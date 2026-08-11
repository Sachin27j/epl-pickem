import { useEffect, useState, type ReactNode } from "react";

import apiClient from "../api/client";
import { AuthContext, type AuthContextValue, type User } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      queueMicrotask(() => {
        setIsLoading(false);
      });
      return;
    }

    apiClient
      .get<User>("/auth/profile")
      .then((response) => {
        setUser(response.data);
      })
      .catch(() => {
        localStorage.removeItem("accessToken");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  async function login(email: string, password: string) {
    const response = await apiClient.post<{
      accessToken: string;
    }>("/auth/login", {
      email,
      password,
    });

    localStorage.setItem("accessToken", response.data.accessToken);

    const profile = await apiClient.get<User>("/auth/profile");

    setUser(profile.data);
  }

  async function register(name: string, email: string, password: string) {
    await apiClient.post("/auth/register", {
      name,
      email,
      password,
    });

    await login(email, password);
  }

  function logout() {
    localStorage.removeItem("accessToken");
    setUser(null);
  }

  const value: AuthContextValue = {
    user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
