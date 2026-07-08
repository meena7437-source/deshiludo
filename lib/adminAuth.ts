import { cookies } from "next/headers";

export async function isAdminLoggedIn() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("deshiludo_admin");

  return adminCookie?.value === "yes";
}