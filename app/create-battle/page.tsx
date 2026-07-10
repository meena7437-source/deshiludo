"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function CreateBattlePage() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(true);

  const quickAmounts = [100, 150, 200, 500, 1000, 2000, 5000];

  useEffect(() => {
    let walletChannel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      await loadWallet(user.uid);

      walletChannel = supabase
        .channel(`create-battle-wallet-${user.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallets",
            filter: `uid=eq.${user.uid}`,
          },
          (payload: any) => {
            setBalance(Number(payload.new?.balance || 0));
          }
        )
        .subscribe();

      setWalletLoading(false);
    });

    return () => {
      unsubscribe();

      if (walletChannel) {
        supabase.removeChannel(walletChannel);
      }
    };
  }, [router]);

  async function loadWallet(userId: string) {
    const { data, error } = await supabase
      .from("wallets")
      .select("balance")
      .eq("uid", userId)
      .maybeSingle();

    if (error) {
      toast.error("Wallet load nahi hua");
      setWalletLoading(false);
      return;
    }

    setBalance(Number(data?.balance || 0));
  }

  async function createBattle() {
    if (loading) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      toast.error("Please login first");
      router.replace("/login");
      return;
    }

    const battleAmount = Number(amount);

    if (!amount || !Number.isFinite(battleAmount) || battleAmount <= 0) {
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

    if (battleAmount > balance) {
      toast.error("Insufficient balance");
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
    } catch (error: any) {
      toast.error(error?.message || "Battle create failed");
    } finally {
      setLoading(false);
    }
  }

  const battleAmount = Number(amount || 0);
  const balanceAfter =
    battleAmount > 0 && battleAmount <= balance
      ? balance - battleAmount
      : balance;

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white">
      <div className="mx-auto max-w-xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-4 text-sm text-zinc-400 hover:text-white"
        >
          ← Back to Dashboard
        </button>

        <div className="rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-xl">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-yellow-400">
                Create Battle
              </h1>

              <p className="mt-1 text-sm text-zinc-400">
                Battle amount aapke wallet balance se deduct hoga.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-right">
              <p className="text-[11px] text-zinc-500">
                Wallet Balance
              </p>

              <p className="text-lg font-black text-green-400">
                {walletLoading ? "..." : `₹${balance}`}
              </p>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <label className="mb-2 block text-sm font-bold">
              Battle Amount
            </label>

            <input
              type="number"
              inputMode="numeric"
              min={100}
              step={50}
              placeholder="₹100, ₹150, ₹200..."
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mb-4 w-full rounded-xl border border-zinc-800 bg-black p-3 text-white outline-none focus:border-yellow-400"
            />

            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  disabled={walletLoading || value > balance}
                  className={`rounded-xl border py-2 text-sm font-black disabled:opacity-40 ${
                    Number(amount) === value
                      ? "border-yellow-400 bg-yellow-400 text-black"
                      : "border-zinc-800 bg-zinc-900 text-white"
                  }`}
                >
                  ₹{value}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-zinc-400">
                Current Balance
              </span>

              <span className="font-black text-green-400">
                ₹{balance}
              </span>
            </div>

            <div className="mb-2 flex justify-between text-sm">
              <span className="text-zinc-400">
                Battle Amount
              </span>

              <span className="font-bold text-yellow-400">
                ₹{battleAmount}
              </span>
            </div>

            <div className="mt-3 border-t border-zinc-800 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">
                  Balance After Battle
                </span>

                <span
                  className={`font-black ${
                    battleAmount > balance
                      ? "text-red-400"
                      : "text-white"
                  }`}
                >
                  ₹
                  {battleAmount > balance
                    ? balance - battleAmount
                    : balanceAfter}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={createBattle}
            disabled={loading || walletLoading}
            className="w-full rounded-2xl bg-yellow-400 py-3 font-black text-black active:scale-[0.99] disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {loading ? "Creating Battle..." : "Create Battle"}
          </button>

          <p className="mt-4 text-center text-xs text-zinc-500">
            Minimum ₹100. Amount ₹50 ke multiple me hona chahiye.
          </p>
        </div>
      </div>
    </main>
  );
}