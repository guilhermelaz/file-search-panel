import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

const COOKIE_NAME = "rag_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "change-me-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function createToken(username: string): string {
  const exp = Date.now() + SESSION_DURATION_MS;
  const payload = `${username}.${exp}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { username: string; valid: boolean } {
  const parts = token.split(".");
  if (parts.length !== 3) return { username: "", valid: false };

  const [username, expStr, sig] = parts;
  const payload = `${username}.${expStr}`;
  const expectedSig = sign(payload);

  if (sig !== expectedSig) return { username: "", valid: false };

  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Date.now() > exp) return { username: "", valid: false };

  return { username, valid: true };
}

export async function login(username: string, password: string): Promise<boolean> {
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "admin123";

  if (username !== expectedUser || password !== expectedPass) {
    return false;
  }

  const token = createToken(username);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return true;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token).valid;
}

export async function requireAuth(): Promise<void> {
  const ok = await isAuthenticated();
  if (!ok) redirect("/login");
}
