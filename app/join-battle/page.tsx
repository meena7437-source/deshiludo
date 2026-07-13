"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

type Battle = {
  id: number;
  creator_uid: string;
  creator_phone?: string | null;
  creator_name?: string | null;
  amount: number;
  status: string;
  created_at?: string;
  creator_condition?: string | null;
};

export default function JoinBattlePage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [balance, setBalance] = useState(0);
  const [battles, setBattles] = useState<Battle[]>([]);

  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<number | null>(null);

  useEffect(() => {
    let battleChannel: any = null;
    let walletChannel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setUid(user.uid);

      await Promise.all([loadWallet(user.uid), loadBattles(user.uid)]);

      walletChannel = supabase
        .channel(`join-wallet-${user.uid}`)
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
          },
        )
        .subscribe();

      battleChannel = supabase
        .channel("join-open-battles")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "battles",
          },
          () => {
            loadBattles(user.uid);
          },
        )
        .subscribe();

      setLoading(false);
    });

    return () => {
      unsubscribe();

      if (walletChannel) {
        supabase.removeChannel(walletChannel);
      }

      if (battleChannel) {
        supabase.removeChannel(battleChannel);
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
      return;
    }

    setBalance(Number(data?.balance || 0));
  }

  async function loadBattles(userId: string) {
    const { data, error } = await supabase
      .from("battles")
      .select(
        `
          id,
          creator_uid,
          creator_phone,
          creator_name,
          amount,
          status,
          created_at,
          creator_condition
        `,
      )
      .eq("status", "open")
      .neq("creator_uid", userId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Battles load nahi hui");
      return;
    }

    setBattles((data || []) as Battle[]);
  }

  async function refreshPage() {
    const user = auth.currentUser;

    if (!user) {
      router.replace("/login");
      return;
    }

    setLoading(true);

    await Promise.all([loadWallet(user.uid), loadBattles(user.uid)]);

    setLoading(false);
  }

  async function joinBattle(battle: Battle) {
    if (joiningId !== null) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      toast.error("Please login first");
      router.replace("/login");
      return;
    }

    const battleAmount = Number(battle.amount || 0);

    if (battle.creator_uid === user.uid) {
      toast.error("Apni battle khud join nahi kar sakte");
      return;
    }

    if (battleAmount <= 0) {
      toast.error("Invalid battle amount");
      return;
    }

    if (battleAmount > balance) {
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
        await loadBattles(user.uid);
        return;
      }

      if (data === "battle_not_open") {
        toast.error("Battle ab open nahi hai");
        await loadBattles(user.uid);
        return;
      }

      if (data === "already_joined") {
        toast.error("Ye battle already kisi ne join kar li");
        await loadBattles(user.uid);
        return;
      }

      if (data === "cannot_join_own_battle") {
        toast.error("Apni battle khud join nahi kar sakte");
        return;
      }

      if (data === "already_in_active_battle") {
        toast.error("Aap pehle se ek active battle me hain");
        return;
      }

      if (data === "creator_in_active_battle") {
        toast.error("Creator ab kisi active battle me hai");
        await loadBattles(user.uid);
        return;
      }

      if (data === "insufficient_balance") {
        toast.error("Insufficient balance");
        await loadWallet(user.uid);
        return;
      }

      if (data !== "joined") {
        toast.error(typeof data === "string" ? data : "Battle join nahi hui");
        return;
      }

      toast.success("Battle joined ✅");

      await Promise.all([loadWallet(user.uid), loadBattles(user.uid)]);

      router.push(`/battle/${battle.id}`);
    } catch (error: any) {
      toast.error(error?.message || "Battle join failed");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white">
      <div className="mx-auto max-w-xl">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-4 text-sm text-zinc-400 hover:text-white"
        >
          ← Back to Dashboard
        </button>

        <div className="rounded-3xl border border-green-400/20 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-xl">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-green-400">
                Join Battle
              </h1>

              <p className="mt-1 text-sm text-zinc-400">
                Battle amount single wallet balance se deduct hoga.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-right">
              <p className="text-[11px] text-zinc-500">Wallet Balance</p>

              <p className="text-lg font-black text-yellow-400">₹{balance}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshPage}
            disabled={loading}
            className="mb-5 w-full rounded-2xl border border-zinc-700 bg-zinc-800 py-3 font-bold text-white disabled:text-zinc-500"
          >
            {loading ? "Refreshing..." : "Refresh Battles"}
          </button>

          {loading ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center">
              <p className="font-bold">Loading battles...</p>
            </div>
          ) : battles.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center">
              <p className="text-xl font-bold">No battles available</p>

              <p className="mt-2 text-sm text-zinc-400">
                Abhi koi open battle nahi hai.
              </p>

              <button
                type="button"
                onClick={() => router.push("/create-battle")}
                className="mt-5 w-full rounded-2xl bg-yellow-400 py-3 font-black text-black"
              >
                Create New Battle
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {battles.map((battle) => {
                const battleAmount = Number(battle.amount || 0);

                const canJoin = balance >= battleAmount && joiningId === null;

                const balanceAfter = balance - battleAmount;

                return (
                  <div
                    key={battle.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-zinc-500">
                          Battle #{battle.id}
                        </p>

                        <p className="mt-1 text-2xl font-black text-green-400">
                          ₹{battleAmount}
                        </p>
                      </div>

                      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400">
                        OPEN
                      </span>
                    </div>

                    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                      <p className="text-xs text-zinc-500">Created by</p>

                      <p className="text-sm font-semibold">
                        {battle.creator_name ||
                          battle.creator_phone ||
                          "Player"}
                      </p>
                    </div>

                    <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-400/10 p-3">
                      <p className="text-xs font-black text-yellow-400">
                        Creator Game Condition
                      </p>

                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-zinc-200">
                        {battle.creator_condition?.trim() ||
                          "Default Game Play Only"}
                      </p>

                      <p className="mt-2 text-[10px] leading-4 text-zinc-500">
                        Condition ko follow kar sakte hain tabhi Join Battle
                        dabayein.
                      </p>
                    </div>

                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Current Balance</span>

                        <span className="font-bold text-green-400">
                          ₹{balance}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-zinc-400">Battle Amount</span>

                        <span className="font-bold text-yellow-400">
                          ₹{battleAmount}
                        </span>
                      </div>

                      <div className="flex justify-between border-t border-zinc-800 pt-2">
                        <span className="text-zinc-400">
                          Balance After Join
                        </span>

                        <span
                          className={`font-black ${
                            balanceAfter >= 0 ? "text-white" : "text-red-400"
                          }`}
                        >
                          ₹{balanceAfter}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => joinBattle(battle)}
                      disabled={joiningId === battle.id || !canJoin}
                      className="mt-4 w-full rounded-2xl bg-green-500 py-3 font-black text-white active:scale-[0.99] disabled:bg-zinc-700 disabled:text-zinc-400"
                    >
                      {joiningId === battle.id
                        ? "Joining..."
                        : balance < battleAmount
                          ? "Low Balance"
                          : "Join Battle"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-5 text-center text-xs text-zinc-500">
            Join karte hi battle amount wallet balance se deduct hoga.
          </p>
        </div>
      </div>
    </main>
  );
}
