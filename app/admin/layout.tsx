"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const isAdmin = localStorage.getItem("deshiludo_admin");

    if (isAdmin !== "yes") {
      router.push("/admin-login");
      return;
    }

    setChecking(false);
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-yellow-400 font-bold">Checking admin access...</p>
      </main>
    );
  }

  return <>{children}</>;
}