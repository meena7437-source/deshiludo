import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("deshiludo_admin")?.value;

  if (isAdmin !== "yes") {
    redirect("/admin-login");
  }

  return <>{children}</>;
}