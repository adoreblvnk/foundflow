import { redirect } from "next/navigation";
import { isAuthDisabled } from "@/lib/auth-tokens";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (isAuthDisabled()) {
    redirect("/cases");
  }

  return <LoginForm />;
}
