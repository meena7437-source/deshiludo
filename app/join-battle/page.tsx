"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

type Battle = {
  id: number;
  creator_uid: string;
  creator_phone: string;
  amount: number;
  status: string;
  created_at?: string;
};

export default function JoinBattlePage() {
  const router = useRouter();

  const [battles, setBattles] = useState<Battle[]>([]);
  const [wallet, setWallet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<number | null>(null);

  useEffect(() => {
    loadPageData();
  }, []);

  async function loadPageData() {
    const user = auth.currentUser;

    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(true);

    try {
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("balance")
        .eq("uid", user.uid)
        .maybeSingle();

      if (walletError) {
        toast.error(walletError.message);
        return;
      }

      setWallet(Number(walletData?.balance || 0));

      const { data: battleData, error: battleError } = await supabase
        .from("battles")
        .select("*")
        .eq("status", "open")
        .neq("creator_uid", user.uid)
        .order("created_at", { ascending: false });

      if (battleError) {
        toast.error(battleError.message);
        return;
      }

      setBattles(battleData || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Data load failed");
    } finally {
      setLoading(false);
    }
  }

  async function joinBattle(battle: Battle) {
    const user = auth.currentUser;

    if (!user) {
      toast.error("Please login first");
      router.push("/login");
      return;
    }

    setJoiningId(battle.id);

    try {
      const { data, error } = await supabase.rpc("join_battle_safe", {
        battle_id_input: battle.id,
        joiner_uid_input: user.uid,
        joiner_phone_input: user.phoneNumber || "User",
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data === "battle_not_found") {
        toast.error("Battle nahi mili");
        await loadPageData();
        return;
      }

      if (data === "already_joined") {
        toast.error("Ye battle already kisi ne join kar li");
        await loadPageData();
        return;
      }

      if (data === "own_battle") {
        toast.error("Apni battle khud join nahi kar sakte");
        return;
      }

      if (data === "wallet_not_found") {
        toast.error("Wallet nahi mila");
        return;
      }

      if (data === "low_balance") {
        toast.error("Insufficient wallet balance");
        await loadPageData();
        return;
      }

      toast.success("Battle joined ✅");
      router.push(`/battle/${battle.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Battle join failed");
    } finally {
      setJoiningId(null);
    }
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
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-3xl font-extrabold text-green-400">
                Join Battle
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Open battle choose karo aur join karo.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-right">
              <p className="text-xs text-zinc-500">Wallet</p>
              <p className="text-xl font-bold text-yellow-400">₹{wallet}</p>
            </div>
          </div>

          <button
            onClick={loadPageData}
            disabled={loading}
            className="w-full mb-5 bg-zinc-800 border border-zinc-700 text-white font-bold py-3 rounded-2xl disabled:text-zinc-500"
          >
            {loading ? "Refreshing..." : "Refresh Battles"}
          </button>

          {loading ? (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-center">
              <p className="font-bold">Loading battles...</p>
              <p className="text-zinc-500 text-sm mt-1">
                Open battles check ho rahi hain.
              </p>
            </div>
          ) : battles.length === 0 ? (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-xl font-bold">No battles available</p>
              <p className="text-zinc-400 text-sm mt-2">
                Abhi koi open battle nahi hai.
              </p>

              <button
                onClick={() => router.push("/create-battle")}
                className="mt-5 w-full bg-yellow-400 text-black font-extrabold py-3 rounded-2xl"
              >
                Create New Battle
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {battles.map((battle) => {
                const canJoin = wallet >= Number(battle.amount || 0);

                return (
                  <div
                    key={battle.id}
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-zinc-500">
                          Battle #{battle.id}
                        </p>
                        <p className="text-3xl font-extrabold text-green-400 mt-1">
                          ₹{battle.amount}
                        </p>
                      </div>

                      <span className="bg-green-500/10 text-green-400 text-xs font-bold px-3 py-1 rounded-full border border-green-500/30">
                        OPEN
                      </span>
                    </div>

                    <div className="mt-4 bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                      <p className="text-xs text-zinc-500">Created by</p>
                      <p className="font-semibold text-sm">
                        {battle.creator_phone || "User"}
                      </p>
                    </div>

                    <div className="mt-3 flex justify-between text-sm">
                      <span className="text-zinc-400">After Join Wallet</span>
                      <span
                        className={`font-bold ${
                          canJoin ? "text-yellow-400" : "text-red-400"
                        }`}
                      >
                        ₹{wallet - Number(battle.amount || 0)}
                      </span>
                    </div>

                    <button
                      onClick={() => joinBattle(battle)}
                      disabled={joiningId === battle.id || !canJoin}
                      className="mt-4 w-full bg-green-500 text-white font-extrabold py-3 rounded-2xl disabled:bg-zinc-700 disabled:text-zinc-400 active:scale-[0.99]"
                    >
                      {joiningId === battle.id
                        ? "Joining..."
                        : canJoin
                        ? "Join Battle"
                        : "Low Balance"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-zinc-500 text-center mt-5">
            Join karte hi battle amount wallet se deduct ho jayega.
          </p>
        </div>
      </div>
    </main>
  );
}