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
  const [depositBalance, setDepositBalance] = useState(0);
  const [winningBalance, setWinningBalance] = useState(0);
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
        .select("deposit_balance, winning_balance")
        .eq("uid", user.uid)
        .maybeSingle();

      if (walletError) {
        toast.error(walletError.message);
        return;
      }

      setDepositBalance(Number(walletData?.deposit_balance || 0));
      setWinningBalance(Number(walletData?.winning_balance || 0));

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

    const totalBalance = depositBalance + winningBalance;

    if (Number(battle.amount) > totalBalance) {
      toast.error("Insufficient balance");
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

      if (data === "battle_not_open") {
        toast.error("Battle open nahi hai");
        await loadPageData();
        return;
      }

      if (data === "already_joined") {
        toast.error("Ye battle already kisi ne join kar li");
        await loadPageData();
        return;
      }

      if (data === "cannot_join_own_battle") {
        toast.error("Apni battle khud join nahi kar sakte");
        return;
      }

      if (data === "insufficient_balance") {
        toast.error("Insufficient balance");
        await loadPageData();
        return;
      }

      if (data !== "joined") {
        toast.error("Battle join nahi hui");
        return;
      }

      toast.success("Battle joined ✅");
      router.push(`/battle/${battle.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Battle join failed");
    } finally {
      setJoiningId(null);
    }
  }

  const totalBalance = depositBalance + winningBalance;

  return (
    <main className="min-h-screen bg-black text-white px-4 py-5">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-4 text-sm text-zinc-400 hover:text-white"
        >
          ← Back to Dashboard
        </button>

        <div className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-5 border border-green-400/20 shadow-xl">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h1 className="text-2xl font-black text-green-400">
                Join Battle
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Pehle deposit se, baaki winning se deduct hoga.
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-3 py-2 text-right">
              <p className="text-[11px] text-zinc-500">Total</p>
              <p className="text-lg font-black text-yellow-400">
                ₹{totalBalance}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3">
              <p className="text-xs text-green-300">Deposit Balance</p>
              <p className="text-xl font-black text-green-400">
                ₹{depositBalance}
              </p>
            </div>

            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3">
              <p className="text-xs text-yellow-300">Winning Balance</p>
              <p className="text-xl font-black text-yellow-400">
                ₹{winningBalance}
              </p>
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
            </div>
          ) : battles.length === 0 ? (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-xl font-bold">No battles available</p>
              <p className="text-zinc-400 text-sm mt-2">
                Abhi koi open battle nahi hai.
              </p>

              <button
                onClick={() => router.push("/create-battle")}
                className="mt-5 w-full bg-yellow-400 text-black font-black py-3 rounded-2xl"
              >
                Create New Battle
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {battles.map((battle) => {
                const amount = Number(battle.amount || 0);
                const canJoin = totalBalance >= amount;

                const depositUsed = Math.min(depositBalance, amount);
                const winningUsed = Math.max(amount - depositBalance, 0);

                const afterDeposit = depositBalance - depositUsed;
                const afterWinning = winningBalance - winningUsed;

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
                        <p className="text-2xl font-black text-green-400 mt-1">
                          ₹{battle.amount}
                        </p>
                      </div>

                      <span className="bg-green-500/10 text-green-400 text-xs font-bold px-3 py-1 rounded-full border border-green-500/30">
                        OPEN
                      </span>
                    </div>

                    <div className="mt-3 bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                      <p className="text-xs text-zinc-500">Created by</p>
                      <p className="font-semibold text-sm">
                        {battle.creator_phone || "User"}
                      </p>
                    </div>

                    <div className="mt-3 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Deposit se katega</span>
                        <span className="font-bold text-green-400">
                          ₹{depositUsed}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-zinc-400">Winning se katega</span>
                        <span className="font-bold text-yellow-400">
                          ₹{winningUsed}
                        </span>
                      </div>

                      <div className="border-t border-zinc-800 pt-2 flex justify-between">
                        <span className="text-zinc-400">After Join</span>
                        <span
                          className={`font-bold ${
                            canJoin ? "text-yellow-400" : "text-red-400"
                          }`}
                        >
                          D ₹{afterDeposit} / W ₹{afterWinning}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => joinBattle(battle)}
                      disabled={joiningId === battle.id || !canJoin}
                      className="mt-4 w-full bg-green-500 text-white font-black py-3 rounded-2xl disabled:bg-zinc-700 disabled:text-zinc-400 active:scale-[0.99]"
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
            Join karte hi pehle deposit balance se, baaki winning balance se
            deduct hoga.
          </p>
        </div>
      </div>
    </main>
  );
}