import { cookies } from "next/headers";
import { signSession, verifySession, timingSafeCompare, getLoginPassword, getLoginUsername } from "./auth-tokens";

const SESSION_COOKIE_NAME = "foundflow_session";

export { signSession, verifySession, timingSafeCompare };

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return token ? verifySession(token) !== null : false;
}

export async function getCurrentUser(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return token ? verifySession(token) : null;
}

export async function login(password: string, username: string): Promise<boolean> {
  // Input length validations
  if (!username || username.length < 1 || username.length > 100) {
    return false;
  }
  if (!password || password.length < 1 || password.length > 256) {
    return false;
  }

  const requiredUsername = getLoginUsername();
  const requiredPassword = getLoginPassword();

  const usernameMatched = timingSafeCompare(username, requiredUsername);
  const passwordMatched = timingSafeCompare(password, requiredPassword);

  if (!usernameMatched || !passwordMatched) {
    return false;
  }

  const token = signSession(username);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60, // 1 day
  });

  return true;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
