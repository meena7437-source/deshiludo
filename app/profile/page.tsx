"use client";

import { useEffect, useState } from "react";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

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
        () => {
          loadWallet();
        }
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
      .single();

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setWallet(Number(data?.balance || 0));
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 text-sm text-zinc-400 hover:text-white"
        >
          ← Back to Dashboard
        </button>

        <div className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-5 border border-zinc-800 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-24 h-24 rounded-full bg-yellow-400 text-black text-4xl font-extrabold flex items-center justify-center mx-auto">
              📱
            </div>

            <h1 className="text-3xl font-extrabold text-yellow-400 mt-4">
              My Profile
            </h1>

            <p className="text-zinc-400 text-sm mt-1">
              DeshiLudo Player Account
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500">Mobile Number</p>
              <p className="text-xl font-bold mt-2">
                {user?.phoneNumber || "User"}
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500">Wallet Balance</p>
              <p className="text-3xl font-extrabold text-green-400 mt-2">
                {loading ? "..." : `₹${wallet}`}
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500">Account Status</p>
              <p className="text-green-400 font-bold mt-2">
                ✅ Active
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500">Login Method</p>
              <p className="font-bold mt-2">
                Firebase OTP
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full mt-6 bg-yellow-400 text-black font-extrabold py-4 rounded-2xl active:scale-[0.99]"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}