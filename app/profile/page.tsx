"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function ProfilePage() {
  const router = useRouter();
  const [wallet, setWallet] = useState(0);
  const [loading, setLoading] = useState(true);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    loadWallet();

    const channel = supabase
      .channel(`profile-wallet-${user.uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `uid=eq.${user.uid}`,
        },
        () => loadWallet()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadWallet() {
    if (!user) return;

    const { data, error } = await supabase
      .from("wallets")
      .select("balance")
      .eq("uid", user.uid)
      .maybeSingle();

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setWallet(Number(data?.balance || 0));
  }

  async function logout() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6">
      <div className="mx-auto max-w-xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 text-sm font-bold text-zinc-400"
        >
          ← Back to Dashboard
        </button>

        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-yellow-400 text-4xl font-black text-black">
              👤
            </div>

            <h1 className="mt-4 text-3xl font-black text-yellow-400">
              My Profile
            </h1>

            <p className="mt-1 text-sm text-zinc-400">
              DeshiLudo Player Account
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">Mobile Number</p>
              <p className="mt-2 text-xl font-bold">
                {user?.phoneNumber || "User"}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">Wallet Balance</p>
              <p className="mt-2 text-3xl font-black text-green-400">
                {loading ? "..." : `₹${wallet}`}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">Account Status</p>
              <p className="mt-2 font-bold text-green-400">✅ Active</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">Login Method</p>
              <p className="mt-2 font-bold">Firebase OTP</p>
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 w-full rounded-2xl bg-yellow-400 py-4 font-black text-black"
          >
            Back to Dashboard
          </button>

          <button
            onClick={logout}
            className="mt-3 w-full rounded-2xl border border-red-500/40 bg-red-500/10 py-4 font-black text-red-400"
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}