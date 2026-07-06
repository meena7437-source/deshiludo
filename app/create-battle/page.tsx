"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function CreateBattlePage() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(true);

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

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
      .select("balance")
      .eq("uid", user.uid)
      .single();

    setWalletLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setWallet(Number(data?.balance || 0));
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

    if (battleAmount > wallet) {
      toast.error("Insufficient wallet balance");
      return;
    }

    setLoading(true);

    try {
      const { error: deductError } = await supabase.rpc("add_wallet_balance", {
        user_id_input: user.uid,
        amount_input: -battleAmount,
      });

      if (deductError) {
        toast.error(deductError.message);
        return;
      }

      const { data, error } = await supabase
        .from("battles")
        .insert({
          creator_uid: user.uid,
          creator_phone: user.phoneNumber,
          amount: battleAmount,
          status: "open",
          room_code: null,
        })
        .select("*")
        .single();

      if (error) {
        await supabase.rpc("add_wallet_balance", {
          user_id_input: user.uid,
          amount_input: battleAmount,
        });

        toast.error(error.message);
        return;
      }

      toast.success("Battle created ✅");
      router.push(`/battle/${data.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Battle create failed");
    } finally {
      setLoading(false);
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
              <h1 className="text-3xl font-extrabold text-yellow-400">
                Create Battle
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Amount select karo aur battle create karo.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-right">
              <p className="text-xs text-zinc-500">Wallet</p>
              <p className="text-xl font-bold text-green-400">
                {walletLoading ? "..." : `₹${wallet}`}
              </p>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-5">
            <label className="block text-sm font-semibold mb-2">
              Battle Amount
            </label>

            <input
              type="number"
              placeholder="Enter amount ₹"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white outline-none focus:border-yellow-400 mb-4"
            />

            <div className="grid grid-cols-3 gap-3">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  onClick={() => setAmount(String(value))}
                  className={`py-3 rounded-xl font-bold border ${
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
              <span className="font-bold">₹{Number(amount || 0)}</span>
            </div>

            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Wallet Balance</span>
              <span className="font-bold text-green-400">₹{wallet}</span>
            </div>

            <div className="border-t border-zinc-800 pt-3 mt-3 flex justify-between">
              <span className="text-zinc-400">After Create</span>
              <span
                className={`font-bold ${
                  wallet - Number(amount || 0) < 0
                    ? "text-red-400"
                    : "text-yellow-400"
                }`}
              >
                ₹{wallet - Number(amount || 0)}
              </span>
            </div>
          </div>

          <button
            onClick={createBattle}
            disabled={loading || walletLoading}
            className="w-full bg-yellow-400 text-black font-extrabold py-4 rounded-2xl disabled:bg-zinc-700 disabled:text-zinc-400 active:scale-[0.99]"
          >
            {loading ? "Creating Battle..." : "Create Battle"}
          </button>

          <p className="text-xs text-zinc-500 text-center mt-4">
            Minimum battle amount ₹100 hai. Battle create hote hi amount wallet
            se deduct ho jayega.
          </p>
        </div>
      </div>
    </main>
  );
}