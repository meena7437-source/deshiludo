"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function BattleHistoryPage() {
  const router = useRouter();

  const [battles, setBattles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUid, setCurrentUid] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let battlesChannel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUid(user.uid);
      await loadBattles(user.uid);

      battlesChannel = supabase
        .channel(`battle-history-live-${user.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "battles",
          },
          async () => {
            await loadBattles(user.uid);
          }
        )
        .subscribe();
    });

    return () => {
      unsubscribe();

      if (battlesChannel) {
        supabase.removeChannel(battlesChannel);
      }
    };
  }, [router]);

  async function loadBattles(uid: string) {
    const { data, error } = await supabase
      .from("battles")
      .select("*")
      .or(`creator_uid.eq.${uid},joiner_uid.eq.${uid}`)
      .order("id", { ascending: false });

    setLoading(false);

    if (error) {
      console.error("Battle history load error:", error);
      toast.error(error.message);
      return;
    }

    setBattles(data || []);
  }

  function getNetWinning(amount: number) {
    const totalPot = Number(amount || 0) * 2;
    const commission = Math.floor(totalPot * 0.1);

    return totalPot - commission;
  }

  const stats = useMemo(() => {
    const total = battles.length;

    const wins = battles.filter(
      (battle) =>
        battle.status === "completed" &&
        battle.winner_uid === currentUid
    ).length;

    const losses = battles.filter(
      (battle) =>
        battle.status === "completed" &&
        battle.winner_uid !== currentUid
    ).length;

    const cancelled = battles.filter(
      (battle) => battle.status === "cancelled"
    ).length;

    const winning = battles
      .filter(
        (battle) =>
          battle.status === "completed" &&
          battle.winner_uid === currentUid
      )
      .reduce(
        (sum, battle) =>
          sum + getNetWinning(Number(battle.amount || 0)),
        0
      );

    return {
      total,
      wins,
      losses,
      cancelled,
      winning,
    };
  }, [battles, currentUid]);

  const filteredBattles = useMemo(() => {
    if (filter === "all") {
      return battles;
    }

    if (filter === "won") {
      return battles.filter(
        (battle) =>
          battle.status === "completed" &&
          battle.winner_uid === currentUid
      );
    }

    if (filter === "lost") {
      return battles.filter(
        (battle) =>
          battle.status === "completed" &&
          battle.winner_uid !== currentUid
      );
    }

    if (filter === "running") {
      return battles.filter(
        (battle) =>
          battle.status === "matched" ||
          battle.status === "running"
      );
    }

    return battles.filter((battle) => battle.status === filter);
  }, [battles, filter, currentUid]);

  function getStatusStyle(status: string) {
    if (status === "open") {
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
    }

    if (status === "matched" || status === "running") {
      return "border-blue-400/30 bg-blue-400/10 text-blue-300";
    }

    if (status === "completed") {
      return "border-green-400/30 bg-green-400/10 text-green-300";
    }

    if (status === "cancelled") {
      return "border-red-400/30 bg-red-400/10 text-red-300";
    }

    return "border-zinc-400/30 bg-zinc-400/10 text-zinc-300";
  }

  function getResultText(battle: any) {
    if (battle.status === "completed") {
      return battle.winner_uid === currentUid
        ? "You Won ✅"
        : "You Lost ❌";
    }

    if (battle.status === "cancelled") {
      return "Cancelled / Refunded";
    }

    if (
      battle.status === "matched" ||
      battle.status === "running"
    ) {
      return "Match Running";
    }

    return "Waiting for Player";
  }

  function getResultColor(battle: any) {
    if (battle.status === "completed") {
      return battle.winner_uid === currentUid
        ? "text-green-400"
        : "text-red-400";
    }

    if (battle.status === "cancelled") {
      return "text-red-400";
    }

    if (
      battle.status === "matched" ||
      battle.status === "running"
    ) {
      return "text-blue-400";
    }

    return "text-yellow-400";
  }

  function formatDate(dateValue: string) {
    if (!dateValue) {
      return "No date";
    }

    return new Date(dateValue).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07070b] p-4 text-white">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          <p className="text-sm font-bold text-zinc-300">
            Loading battle history...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto w-full max-w-md px-3 py-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-[11px] font-bold text-zinc-300"
        >
          ← Dashboard
        </button>

        <section className="mb-3 rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-3.5 shadow-xl shadow-black/40">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-yellow-400">
            DeshiLudo
          </p>

          <h1 className="mt-1 text-2xl font-black leading-tight text-white">
            Battle History
          </h1>

          <p className="mt-0.5 text-[10px] text-zinc-500">
            Aapki create aur joined battles yahan dikhegi.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-zinc-800 bg-black/60 p-2.5">
              <p className="text-[9px] text-zinc-500">Total Battles</p>
              <p className="mt-0.5 text-lg font-black text-yellow-400">
                {stats.total}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/60 p-2.5">
              <p className="text-[9px] text-zinc-500">
                Total Winning
              </p>
              <p className="mt-0.5 text-lg font-black text-green-400">
                ₹{stats.winning}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/60 p-2.5">
              <p className="text-[9px] text-zinc-500">Won</p>
              <p className="mt-0.5 text-lg font-black text-green-400">
                {stats.wins}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/60 p-2.5">
              <p className="text-[9px] text-zinc-500">
                Lost / Cancel
              </p>
              <p className="mt-0.5 text-lg font-black text-red-400">
                {stats.losses}/{stats.cancelled}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {[
            { key: "all", label: "All" },
            { key: "won", label: "Won" },
            { key: "lost", label: "Lost" },
            { key: "running", label: "Running" },
            { key: "open", label: "Open" },
            { key: "cancelled", label: "Cancel" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black ${
                filter === item.key
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {battles.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-center">
            <p className="text-base font-black">No history found</p>

            <p className="mt-1 text-[11px] text-zinc-500">
              Battle create ya join hone ke baad yahan dikhegi.
            </p>

            <button
              type="button"
              onClick={() => router.push("/create-battle")}
              className="mt-3 w-full rounded-xl bg-yellow-400 py-3 text-sm font-black text-black"
            >
              Create Battle
            </button>
          </div>
        ) : filteredBattles.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-center">
            <p className="text-sm font-black">
              No battle in this filter
            </p>

            <p className="mt-1 text-[10px] text-zinc-500">
              Dusra filter select karo.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredBattles.map((battle) => {
              const isCreator =
                battle.creator_uid === currentUid;

              const opponentPhone = isCreator
                ? battle.joiner_phone || "Waiting"
                : battle.creator_phone || "User";

              const cardBorder =
                battle.status === "completed"
                  ? battle.winner_uid === currentUid
                    ? "border-green-500/30"
                    : "border-red-500/30"
                  : battle.status === "cancelled"
                  ? "border-red-500/30"
                  : "border-zinc-800";

              return (
                <article
                  key={battle.id}
                  className={`rounded-2xl border ${cardBorder} bg-zinc-950 p-3 shadow-lg shadow-black/30`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-bold text-zinc-500">
                        Battle #{battle.id}
                      </p>

                      <p className="mt-0.5 text-xl font-black text-yellow-400">
                        ₹{Number(battle.amount || 0).toLocaleString(
                          "en-IN"
                        )}
                      </p>

                      <p className="mt-0.5 text-[9px] text-zinc-500">
                        Winning ₹
                        {getNetWinning(
                          Number(battle.amount || 0)
                        ).toLocaleString("en-IN")}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${getStatusStyle(
                        battle.status
                      )}`}
                    >
                      {battle.status}
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-zinc-800 bg-black p-2.5">
                      <p className="text-[9px] text-zinc-500">
                        Your Role
                      </p>
                      <p className="mt-0.5 text-xs font-black">
                        {isCreator ? "Creator" : "Joiner"}
                      </p>
                    </div>

                    <div className="min-w-0 rounded-xl border border-zinc-800 bg-black p-2.5">
                      <p className="text-[9px] text-zinc-500">
                        Opponent
                      </p>
                      <p className="mt-0.5 truncate text-xs font-black">
                        {opponentPhone}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl border border-zinc-800 bg-black p-2.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-[10px] text-zinc-500">
                        Result
                      </span>

                      <span
                        className={`text-right text-[10px] font-black ${getResultColor(
                          battle
                        )}`}
                      >
                        {getResultText(battle)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex justify-between gap-2">
                      <span className="text-[10px] text-zinc-500">
                        Date
                      </span>

                      <span className="text-right text-[10px] font-bold text-zinc-300">
                        {formatDate(battle.created_at)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/battle/${battle.id}`)
                    }
                    className="mt-2.5 w-full rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black active:scale-[0.99]"
                  >
                    View Battle
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
