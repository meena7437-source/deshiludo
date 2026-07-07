"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AdminLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function loginAdmin() {
    if (!username || !password) {
      toast.error("Username aur password enter karo");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const result = await res.json();
    setLoading(false);

    if (!res.ok || !result.success) {
      toast.error(result.message || "Login failed");
      return;
    }

    toast.success("Admin login successful");
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">
          DeshiLudo Admin
        </h1>

        <p className="text-zinc-400 mb-6">
          Admin panel access ke liye login karo.
        </p>

        <input
          className="w-full mb-4 p-3 rounded-xl bg-zinc-800 border border-zinc-700 outline-none"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="w-full mb-5 p-3 rounded-xl bg-zinc-800 border border-zinc-700 outline-none"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loginAdmin();
          }}
        />

        <button
          onClick={loginAdmin}
          disabled={loading}
          className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? "Checking..." : "Login"}
        </button>
      </div>
    </main>
  );
}