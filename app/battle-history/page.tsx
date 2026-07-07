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

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUid(user.uid);
      loadBattles(user.uid);

      battlesChannel = supabase
        .channel(`battle-history-live-${user.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "battles",
          },
          () => {
            loadBattles(user.uid);
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
      toast.error(error.message);
      return;
    }

    setBattles(data || []);
  }

  const stats = useMemo(() => {
    const total = battles.length;
    const wins = battles.filter(
      (b) => b.status === "completed" && b.winner_uid === currentUid
    ).length;
    const losses = battles.filter(
      (b) => b.status === "completed" && b.winner_uid !== currentUid
    ).length;
    const cancelled = battles.filter((b) => b.status === "cancelled").length;
    const winning = battles
      .filter((b) => b.status === "completed" && b.winner_uid === currentUid)
      .reduce((sum, b) => sum + Number(b.amount || 0) * 2, 0);

    return { total, wins, losses, cancelled, winning };
  }, [battles, currentUid]);

  const filteredBattles = useMemo(() => {
    if (filter === "all") return battles;

    if (filter === "won") {
      return battles.filter(
        (b) => b.status === "completed" && b.winner_uid === currentUid
      );
    }

    if (filter === "lost") {
      return battles.filter(
        (b) => b.status === "completed" && b.winner_uid !== currentUid
      );
    }

    return battles.filter((b) => b.status === filter);
  }, [battles, filter, currentUid]);

  function getStatusStyle(status: string) {
    if (status === "open")
      return "text-yellow-300 bg-yellow-400/10 border-yellow-400/30";
    if (status === "matched" || status === "running")
      return "text-blue-300 bg-blue-400/10 border-blue-400/30";
    if (status === "completed")
      return "text-green-300 bg-green-400/10 border-green-400/30";
    if (status === "cancelled")
      return "text-red-300 bg-red-400/10 border-red-400/30";
    return "text-zinc-300 bg-zinc-400/10 border-zinc-400/30";
  }

  function getResultText(battle: any) {
    if (battle.status === "completed") {
      return battle.winner_uid === currentUid ? "You Won ✅" : "You Lost ❌";
    }

    if (battle.status === "cancelled") return "Cancelled / Refunded";
    if (battle.status === "matched" || battle.status === "running")
      return "Match Running";

    return "Waiting for Player";
  }

  function getResultColor(battle: any) {
    if (battle.status === "completed") {
      return battle.winner_uid === currentUid
        ? "text-green-400"
        : "text-red-400";
    }

    if (battle.status === "cancelled") return "text-red-400";
    if (battle.status === "matched" || battle.status === "running")
      return "text-blue-400";

    return "text-yellow-400";
  }

  function formatDate(dateValue: string) {
    if (!dateValue) return "No date";

    return new Date(dateValue).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-5">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          <p className="font-bold text-zinc-300">Loading battle history...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-xl px-4 py-5">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300"
        >
          ← Dashboard
        </button>

        <section className="mb-5 rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            DeshiLudo
          </p>

          <h1 className="mt-2 text-3xl font-black text-white">
            Battle History
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Aapki create aur joined battles yahan dikhegi.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
              <p className="text-xs text-zinc-500">Total Battles</p>
              <p className="mt-1 text-2xl font-black text-yellow-400">
                {stats.total}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
              <p className="text-xs text-zinc-500">Total Winning</p>
              <p className="mt-1 text-2xl font-black text-green-400">
                ₹{stats.winning}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
              <p className="text-xs text-zinc-500">Won</p>
              <p className="mt-1 text-2xl font-black text-green-400">
                {stats.wins}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
              <p className="text-xs text-zinc-500">Lost / Cancel</p>
              <p className="mt-1 text-2xl font-black text-red-400">
                {stats.losses}/{stats.cancelled}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
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
              onClick={() => setFilter(item.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black ${
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
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="text-xl font-black">No history found</p>
            <p className="mt-2 text-sm text-zinc-500">
              Battle create ya join hone ke baad yahan dikhegi.
            </p>

            <button
              onClick={() => router.push("/create-battle")}
              className="mt-5 w-full rounded-2xl bg-yellow-400 py-4 font-black text-black"
            >
              Create Battle
            </button>
          </div>
        ) : filteredBattles.length === 0 ? (
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="text-lg font-black">No battle in this filter</p>
            <p className="mt-2 text-sm text-zinc-500">
              Dusra filter select karo.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBattles.map((battle) => {
              const isCreator = battle.creator_uid === currentUid;
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
                <div
                  key={battle.id}
                  className={`rounded-[26px] border ${cardBorder} bg-zinc-950 p-4 shadow-xl shadow-black/30`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-zinc-500">
                        Battle #{battle.id}
                      </p>

                      <p className="mt-1 text-3xl font-black text-yellow-400">
                        ₹{battle.amount}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        Winning ₹{Number(battle.amount || 0) * 2}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusStyle(
                        battle.status
                      )}`}
                    >
                      {battle.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-zinc-800 bg-black p-3">
                      <p className="text-xs text-zinc-500">Your Role</p>
                      <p className="font-black">
                        {isCreator ? "Creator" : "Joiner"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black p-3">
                      <p className="text-xs text-zinc-500">Opponent</p>
                      <p className="truncate text-sm font-black">
                        {opponentPhone}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-zinc-800 bg-black p-3">
                    <div className="flex justify-between gap-3">
                      <span className="text-sm text-zinc-500">Result</span>
                      <span
                        className={`text-sm font-black ${getResultColor(
                          battle
                        )}`}
                      >
                        {getResultText(battle)}
                      </span>
                    </div>

                    <div className="mt-2 flex justify-between gap-3">
                      <span className="text-sm text-zinc-500">Date</span>
                      <span className="text-right text-sm font-bold text-zinc-300">
                        {formatDate(battle.created_at)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/battle/${battle.id}`)}
                    className="mt-4 w-full rounded-2xl bg-yellow-400 py-4 font-black text-black active:scale-[0.99]"
                  >
                    View Battle
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}