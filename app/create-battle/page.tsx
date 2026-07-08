"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function CreateBattlePage() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [depositBalance, setDepositBalance] = useState(0);
  const [winningBalance, setWinningBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(true);

  const quickAmounts = [100, 150, 200, 500, 1000, 2000, 5000];

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    const user = auth.currentUser;

    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("wallets")
      .select("deposit_balance, winning_balance")
      .eq("uid", user.uid)
      .single();

    setWalletLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setDepositBalance(Number(data?.deposit_balance || 0));
    setWinningBalance(Number(data?.winning_balance || 0));
  }

  async function createBattle() {
    const user = auth.currentUser;

    if (!user) {
      toast.error("Please login first");
      router.push("/login");
      return;
    }

    const battleAmount = Number(amount);

    if (!amount || battleAmount <= 0) {
      toast.error("Valid amount enter karo");
      return;
    }

    if (battleAmount < 100) {
      toast.error("Minimum battle amount ₹100 hai");
      return;
    }

    if (battleAmount % 50 !== 0) {
      toast.error("Battle amount ₹50 ke multiple me hona chahiye");
      return;
    }

    if (battleAmount > depositBalance) {
      toast.error("Insufficient deposit balance");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("create_battle_safe", {
        user_id_input: user.uid,
        phone_input: user.phoneNumber || "",
        amount_input: battleAmount,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Battle created ✅");
      router.push(`/battle/${data}`);
    } catch (err: any) {
      toast.error(err?.message || "Battle create failed");
    } finally {
      setLoading(false);
    }
  }

  const battleAmount = Number(amount || 0);
  const afterCreate = depositBalance - battleAmount;

  return (
    <main className="min-h-screen bg-black text-white px-4 py-5">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-4 text-sm text-zinc-400 hover:text-white"
        >
          ← Back to Dashboard
        </button>

        <div className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-5 border border-yellow-400/20 shadow-xl">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h1 className="text-2xl font-black text-yellow-400">
                Create Battle
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Deposit balance se battle create hoga.
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-3 py-2 text-right">
              <p className="text-[11px] text-zinc-500">Deposit</p>
              <p className="text-lg font-black text-green-400">
                {walletLoading ? "..." : `₹${depositBalance}`}
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

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-5">
            <label className="block text-sm font-bold mb-2">
              Battle Amount
            </label>

            <input
              type="number"
              placeholder="₹100, ₹150, ₹200..."
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 rounded-xl bg-black border border-zinc-800 text-white outline-none focus:border-yellow-400 mb-4"
            />

            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  onClick={() => setAmount(String(value))}
                  disabled={value > depositBalance}
                  className={`py-2 rounded-xl text-sm font-black border disabled:opacity-40 ${
                    Number(amount) === value
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "bg-zinc-900 text-white border-zinc-800"
                  }`}
                >
                  ₹{value}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Battle Amount</span>
              <span className="font-bold">₹{battleAmount}</span>
            </div>

            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Deposit Balance</span>
              <span className="font-bold text-green-400">
                ₹{depositBalance}
              </span>
            </div>

            <div className="border-t border-zinc-800 pt-3 mt-3 flex justify-between">
              <span className="text-zinc-400">After Create</span>
              <span
                className={`font-black ${
                  afterCreate < 0 ? "text-red-400" : "text-yellow-400"
                }`}
              >
                ₹{afterCreate}
              </span>
            </div>
          </div>

          <button
            onClick={createBattle}
            disabled={loading || walletLoading}
            className="w-full bg-yellow-400 text-black font-black py-3 rounded-2xl disabled:bg-zinc-700 disabled:text-zinc-400 active:scale-[0.99]"
          >
            {loading ? "Creating Battle..." : "Create Battle"}
          </button>

          <p className="text-xs text-zinc-500 text-center mt-4">
            Minimum ₹100. Amount ₹50 ke multiple me hona chahiye. Battle amount
            deposit balance se deduct hoga.
          </p>
        </div>
      </div>
    </main>
  );
}