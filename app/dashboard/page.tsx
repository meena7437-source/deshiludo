"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

type Battle = {
  id: number;
  amount: number;
  status: string;
  room_code?: string | null;
  creator_uid: string;
  joiner_uid?: string | null;
  creator_name?: string | null;
  joiner_name?: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [wallet, setWallet] = useState(0);
  const [openBattles, setOpenBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<number | null>(null);

  useEffect(() => {
    let battleChannel: any = null;
    let walletChannel: any = null;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setUid(user.uid);
      setPhone(user.phoneNumber || "User");

      await loadWallet(user.uid);
      await loadOpenBattles();

      battleChannel = supabase
        .channel("dashboard-open-battles")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "battles" },
          () => loadOpenBattles()
        )
        .subscribe();

      walletChannel = supabase
        .channel(`wallet-${user.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallets",
            filter: `uid=eq.${user.uid}`,
          },
          (payload: any) => {
            setWallet(Number(payload.new?.balance || 0));
          }
        )
        .subscribe();

      setLoading(false);
    });

    return () => {
      unsub();
      if (battleChannel) supabase.removeChannel(battleChannel);
      if (walletChannel) supabase.removeChannel(walletChannel);
    };
  }, [router]);

  async function loadWallet(userId: string) {
    const { data } = await supabase
      .from("wallets")
      .select("balance")
      .eq("uid", userId)
      .single();

    setWallet(Number(data?.balance || 0));
  }

  async function loadOpenBattles() {
    const { data, error } = await supabase
      .from("battles")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    setOpenBattles((data || []) as Battle[]);
  }

  async function joinBattle(battleId: number) {
    try {
      const user = auth.currentUser;

      if (!user) {
        router.push("/login");
        return;
      }

      setJoiningId(battleId);

      const res = await fetch("/api/battles/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          battleId,
          uid: user.uid,
          phone: user.phoneNumber || "",
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        toast.error(result.message || "Battle join nahi hui");
        return;
      }

      toast.success("Battle joined successfully");
      router.push(`/battle/${battleId}`);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setJoiningId(null);
    }
  }

  async function logout() {
    await signOut(auth);
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-yellow-400 font-bold">Loading DeshiLudo...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white pb-20">
      <header className="sticky top-0 z-20 bg-black/95 backdrop-blur border-b border-yellow-500/30 px-3 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-yellow-400 leading-none">
              DeshiLudo
            </h1>
            <p className="text-[11px] text-zinc-400 mt-1">
              {phone}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] text-zinc-400">Balance</p>
            <p className="text-lg font-black text-green-400">₹{wallet}</p>
          </div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-3 pt-4">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Link href="/create-battle">
            <button className="w-full rounded-xl bg-yellow-400 text-black py-2 text-xs font-black shadow-lg shadow-yellow-500/10">
              Create
            </button>
          </Link>

          <Link href="/wallet">
            <button className="w-full rounded-xl bg-zinc-900 border border-zinc-700 py-2 text-xs font-bold">
              Wallet
            </button>
          </Link>

          <Link href="/deposit">
            <button className="w-full rounded-xl bg-zinc-900 border border-green-700/50 text-green-400 py-2 text-xs font-bold">
              Deposit
            </button>
          </Link>

          <Link href="/withdraw">
            <button className="w-full rounded-xl bg-zinc-900 border border-red-700/50 text-red-400 py-2 text-xs font-bold">
              Withdraw
            </button>
          </Link>
        </div>

        <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-zinc-950 to-zinc-900 p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">Live Battles</p>
              <h2 className="text-lg font-black text-white">
                Open Battle Room
              </h2>
            </div>

            <div className="rounded-full bg-green-500/10 border border-green-500/30 px-3 py-1">
              <p className="text-[11px] font-bold text-green-400">
                {openBattles.length} Open
              </p>
            </div>
          </div>
        </div>

        {openBattles.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="text-zinc-400 text-sm">Abhi koi open battle nahi hai.</p>
            <Link href="/create-battle">
              <button className="mt-4 bg-yellow-400 text-black px-5 py-2 rounded-xl text-sm font-black">
                First Battle Create Karo
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {openBattles.map((battle) => {
              const isOwnBattle = battle.creator_uid === uid;

              return (
                <div
                  key={battle.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 shadow-lg"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-black text-yellow-400">
                          ₹{battle.amount}
                        </p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                          OPEN
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 truncate mt-1">
                        {battle.creator_name || "Player"} waiting for opponent
                      </p>

                      <p className="text-[11px] text-zinc-500 mt-1">
                        Battle ID #{battle.id}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isOwnBattle ? (
                        <button
                          disabled
                          className="rounded-xl bg-zinc-800 text-zinc-300 px-3 py-2 text-xs font-bold border border-zinc-700"
                        >
                          Waiting for Player
                        </button>
                      ) : (
                        <button
                          onClick={() => joinBattle(battle.id)}
                          disabled={joiningId === battle.id}
                          className="rounded-xl bg-yellow-400 text-black px-5 py-2 text-xs font-black shadow-md shadow-yellow-500/10 disabled:opacity-60"
                        >
                          {joiningId === battle.id ? "Joining..." : "Join"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href="/my-battles">
            <button className="w-full rounded-xl bg-zinc-900 border border-zinc-700 py-2 text-xs font-bold">
              My Battles
            </button>
          </Link>

          <button
            onClick={logout}
            className="w-full rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 py-2 text-xs font-bold"
          >
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}