"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

type GameType = "classic" | "ulta";

type Battle = {
  id: number;
  amount: number;
  status: string;
  room_code?: string | null;
  game_type?: string | null;
  creator_uid: string;
  joiner_uid?: string | null;
  creator_name?: string | null;
  joiner_name?: string | null;
  creator_phone?: string | null;
  joiner_phone?: string | null;
  created_at: string;
};

type PlayerProfile = {
  username: string;
  name: string;
  phone: string;
};

export default function GameBattlesPage({ gameType }: { gameType: GameType }) {
  const router = useRouter();
  const isUlta = gameType === "ulta";

  const [uid, setUid] = useState("");
  const [balance, setBalance] = useState(0);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

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

      battleChannel = supabase
        .channel(`${gameType}-battles-live`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "battles" },
          () => loadBattles(user.uid)
        )
        .subscribe();

      walletChannel = supabase
        .channel(`${gameType}-wallet-${user.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallets",
            filter: `uid=eq.${user.uid}`,
          },
          (payload: any) => setBalance(Number(payload.new?.balance || 0))
        )
        .subscribe();

      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (battleChannel) supabase.removeChannel(battleChannel);
      if (walletChannel) supabase.removeChannel(walletChannel);
    };
  }, [gameType, router]);

  async function loadWallet(userId: string) {
    const { data } = await supabase
      .from("wallets")
      .select("balance")
      .eq("uid", userId)
      .maybeSingle();

    setBalance(Number(data?.balance || 0));
  }

  async function loadBattles(currentUserId: string) {
    const { data, error } = await supabase
      .from("battles")
      .select(`
        id,amount,status,room_code,game_type,
        creator_uid,joiner_uid,
        creator_name,joiner_name,
        creator_phone,joiner_phone,created_at
      `)
      .eq("game_type", gameType)
      .in("status", ["open", "matched", "running"])
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    const rows = (data || []) as Battle[];
    setBattles(rows);

    const ids = new Set<string>([currentUserId]);
    rows.forEach((battle) => {
      if (battle.creator_uid) ids.add(battle.creator_uid);
      if (battle.joiner_uid) ids.add(battle.joiner_uid);
    });

    const { data: usersData } = await supabase
      .from("users")
      .select("firebase_uid,username,name,phone")
      .in("firebase_uid", Array.from(ids));

    const map: Record<string, PlayerProfile> = {};
    (usersData || []).forEach((item: any) => {
      map[item.firebase_uid] = {
        username: String(item.username || "").trim(),
        name: String(item.name || "").trim(),
        phone: String(item.phone || "").trim(),
      };
    });
    setProfiles(map);
  }

  const openBattles = useMemo(
    () => battles.filter((battle) => battle.status === "open"),
    [battles]
  );

  const liveBattles = useMemo(
    () =>
      battles.filter(
        (battle) =>
          battle.status === "matched" || battle.status === "running"
      ),
    [battles]
  );

  function maskPhone(value?: string | null) {
    const digits = String(value || "").replace(/\D/g, "");
    const last4 = digits.slice(-4);
    return last4 ? `XXXXXX${last4}` : "";
  }

  function playerName(
    userId?: string | null,
    fallbackName?: string | null,
    fallbackPhone?: string | null
  ) {
    if (!userId) return "Waiting";

    const profile = profiles[userId];
    if (profile?.username) return `@${profile.username}`;
    if (profile?.name) return profile.name;
    if (fallbackName?.trim()) return fallbackName.trim();

    return maskPhone(profile?.phone) || maskPhone(fallbackPhone) || "Player";
  }

  async function joinBattle(battleId: number) {
    if (joiningId !== null) return;

    const user = auth.currentUser;
    if (!user) return router.replace("/login");

    setJoiningId(battleId);

    try {
      const response = await fetch("/api/battles/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battleId,
          uid: user.uid,
          phone: user.phoneNumber || "",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.message || "Battle join nahi hui");
        return;
      }

      toast.success("Battle joined successfully");
      router.push(`/battle/${battleId}`);
    } finally {
      setJoiningId(null);
    }
  }

  async function cancelBattle(battleId: number) {
    const user = auth.currentUser;
    if (!user) return;

    setCancellingId(battleId);

    try {
      const { data, error } = await supabase.rpc("cancel_battle_safe", {
        battle_id_input: battleId,
        uid_input: user.uid,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(
        data === "cancelled_refunded"
          ? "Battle cancel, refund done ✅"
          : "Battle cancel request done ✅"
      );

      await Promise.all([loadBattles(user.uid), loadWallet(user.uid)]);
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07070b] text-white">
        <p className="font-black text-yellow-400">Loading battles...</p>
      </main>
    );
  }

  const accent = isUlta
    ? {
        text: "text-red-400",
        border: "border-red-500/30",
        bg: "bg-red-500",
        soft: "bg-red-500/10",
        icon: "🔄",
      }
    : {
        text: "text-blue-400",
        border: "border-blue-500/30",
        bg: "bg-blue-500",
        soft: "bg-blue-500/10",
        icon: "🎲",
      };

  return (
    <main className="min-h-screen bg-[#07070b] pb-20 text-white">
      <header className={`sticky top-0 z-20 border-b ${accent.border} bg-black/95 px-3 py-3 backdrop-blur`}>
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              ←
            </button>
            <Image src="/logo.png" alt="DeshiLudo" width={42} height={42} className="h-11 w-11 rounded-xl object-contain" />
            <div>
              <h1 className={`text-lg font-black ${accent.text}`}>
                {isUlta ? "Ulta Ludo" : "Ludo Classic"}
              </h1>
              <p className="text-[10px] text-zinc-500">2 Players · Minimum ₹100</p>
            </div>
          </div>

          <Link href="/profile" className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-right">
            <p className="text-[9px] text-zinc-500">Wallet</p>
            <p className="text-sm font-black text-green-400">₹{balance}</p>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-md px-3 pt-4">
        {isUlta && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-200">
            Game screenshot me jo Lose karega, DeshiLudo result me wahi WIN select karega.
          </div>
        )}

        <Link
          href={`/create-battle?game=${gameType}`}
          className={`mb-4 block rounded-2xl ${accent.bg} py-3 text-center text-sm font-black text-white`}
        >
          + CREATE {isUlta ? "ULTA" : "CLASSIC"} BATTLE
        </Link>

        <h2 className="mb-2 text-lg font-black">Open Battles</h2>

        {openBattles.length === 0 ? (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center text-sm text-zinc-500">
            Is mode me abhi koi open battle nahi hai.
          </div>
        ) : (
          <div className="mb-6 space-y-2">
            {openBattles.map((battle) => {
              const isOwnBattle = battle.creator_uid === uid;

              return (
                <div
                  key={battle.id}
                  className={`rounded-2xl border bg-zinc-950 p-3 ${
                    isOwnBattle ? accent.border : "border-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-black text-yellow-400">
                          ₹{battle.amount}
                        </p>

                        <span
                          className={`rounded-full border ${accent.border} ${accent.soft} px-2 py-0.5 text-[9px] font-black ${accent.text}`}
                        >
                          {isUlta ? "ULTA" : "CLASSIC"}
                        </span>

                        {isOwnBattle && (
                          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[9px] font-black text-yellow-300">
                            YOUR BATTLE
                          </span>
                        )}
                      </div>

                      <p className="mt-1 truncate text-xs text-zinc-400">
                        {playerName(
                          battle.creator_uid,
                          battle.creator_name,
                          battle.creator_phone
                        )}
                      </p>

                      <p className="mt-1 text-[10px] text-zinc-600">
                        Battle #{battle.id}
                      </p>
                    </div>

                    {isOwnBattle ? (
                      <button
                        type="button"
                        onClick={() => cancelBattle(battle.id)}
                        disabled={cancellingId === battle.id}
                        className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2 text-xs font-black text-red-400 disabled:opacity-50"
                      >
                        {cancellingId === battle.id
                          ? "Cancelling..."
                          : "Cancel"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => joinBattle(battle.id)}
                        disabled={joiningId !== null}
                        className={`shrink-0 rounded-xl ${accent.bg} px-5 py-2 text-xs font-black text-white disabled:opacity-50`}
                      >
                        {joiningId === battle.id ? "Joining..." : "Join"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="mb-2 text-lg font-black">Live Battles</h2>

        {liveBattles.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center text-sm text-zinc-500">
            Is mode me abhi koi live battle nahi hai.
          </div>
        ) : (
          <div className="space-y-2">
            {liveBattles.map((battle) => {
              const isMyLiveBattle =
                battle.creator_uid === uid || battle.joiner_uid === uid;

              return (
                <div
                  key={`live-${battle.id}`}
                  className={`rounded-2xl border bg-zinc-950 p-3 ${
                    isMyLiveBattle ? accent.border : "border-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-black text-yellow-400">
                          ₹{battle.amount}
                        </p>

                        <span
                          className={`rounded-full border ${accent.border} ${accent.soft} px-2 py-0.5 text-[9px] font-black ${accent.text}`}
                        >
                          {isUlta ? "ULTA" : "CLASSIC"}
                        </span>

                        {isMyLiveBattle && (
                          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[9px] font-black text-green-300">
                            YOUR BATTLE
                          </span>
                        )}
                      </div>

                      <p className="mt-1 truncate text-xs text-zinc-300">
                        {playerName(
                          battle.creator_uid,
                          battle.creator_name,
                          battle.creator_phone
                        )}{" "}
                        vs{" "}
                        {playerName(
                          battle.joiner_uid,
                          battle.joiner_name,
                          battle.joiner_phone
                        )}
                      </p>

                      <p className="mt-1 text-[10px] uppercase text-zinc-600">
                        {battle.status} · #{battle.id}
                      </p>
                    </div>

                    {isMyLiveBattle && (
                      <button
                        type="button"
                        onClick={() => router.push(`/battle/${battle.id}`)}
                        className={`shrink-0 rounded-xl border ${accent.border} ${accent.soft} px-4 py-2 text-xs font-black ${accent.text}`}
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
