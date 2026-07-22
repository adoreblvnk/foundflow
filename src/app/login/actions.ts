"use server";

import { login, logout } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function handleLogin(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "Username and password are required" };
  }

  const success = await login(password, username);
  if (!success) {
    return { error: "Invalid username or password" };
  }

  redirect("/cases");
}

export async function handleLogout() {
  await logout();
  redirect("/login");
}
