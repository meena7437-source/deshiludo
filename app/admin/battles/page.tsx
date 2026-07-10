"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";

type PlayerProfile = {
  username: string;
  name: string;
  phone: string;
};

export default function AdminBattlesPage() {
  const [battles, setBattles] = useState<any[]>([]);
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, PlayerProfile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadBattles();

    const channel = supabase
      .channel("admin-battles-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battles" },
        async () => {
          await loadBattles(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadBattles(showLoader = true) {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("battles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error(error.message);
        return;
      }

      const rows = data || [];
      setBattles(rows);

      const userIds = new Set<string>();

      rows.forEach((battle: any) => {
        if (battle.creator_uid) userIds.add(battle.creator_uid);
        if (battle.joiner_uid) userIds.add(battle.joiner_uid);
        if (battle.winner_uid) userIds.add(battle.winner_uid);
      });

      if (userIds.size === 0) {
        setPlayerProfiles({});
        return;
      }

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("firebase_uid,username,name,phone")
        .in("firebase_uid", Array.from(userIds));

      if (usersError) {
        console.error(usersError);
        toast.error("Player details load nahi hui");
        return;
      }

      const profiles: Record<string, PlayerProfile> = {};

      (usersData || []).forEach((user: any) => {
        profiles[user.firebase_uid] = {
          username: String(user.username || "").trim(),
          name: String(user.name || "").trim(),
          phone: String(user.phone || "").trim(),
        };
      });

      setPlayerProfiles(profiles);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Battles load nahi hui");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const stats = useMemo(
    () => ({
      all: battles.length,
      open: battles.filter((b) => b.status === "open").length,
      running: battles.filter(
        (b) => b.status === "matched" || b.status === "running"
      ).length,
      completed: battles.filter((b) => b.status === "completed").length,
      cancelled: battles.filter((b) => b.status === "cancelled").length,
    }),
    [battles]
  );

  const filteredBattles = useMemo(() => {
    if (filter === "all") return battles;

    if (filter === "running") {
      return battles.filter(
        (battle) =>
          battle.status === "matched" || battle.status === "running"
      );
    }

    return battles.filter((battle) => battle.status === filter);
  }, [battles, filter]);

  function maskPhone(value?: string | null) {
    const digits = String(value || "").replace(/\D/g, "");
    const last4 = digits.slice(-4);
    return last4 ? `XXXXXX${last4}` : "";
  }

  function getPlayerDisplay(
    uid?: string | null,
    fallbackName?: string | null,
    fallbackPhone?: string | null,
    emptyLabel = "Player"
  ) {
    if (!uid) return emptyLabel;

    const profile = playerProfiles[uid];

    if (profile?.username) return `@${profile.username}`;
    if (profile?.name) return profile.name;
    if (fallbackName?.trim()) return fallbackName.trim();

    return (
      maskPhone(profile?.phone) ||
      maskPhone(fallbackPhone) ||
      emptyLabel
    );
  }

  function statusClass(status: string) {
    if (status === "open")
      return "border-green-500/30 bg-green-500/10 text-green-300";
    if (status === "matched" || status === "running")
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    if (status === "completed")
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
    if (status === "cancelled")
      return "border-red-500/30 bg-red-500/10 text-red-300";

    return "border-zinc-700 bg-zinc-800 text-zinc-300";
  }

  function formatDate(dateValue: string) {
    if (!dateValue) return "No date";

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

  const filters = [
    { key: "all", label: "All", count: stats.all },
    { key: "open", label: "Open", count: stats.open },
    { key: "running", label: "Running", count: stats.running },
    { key: "completed", label: "Completed", count: stats.completed },
    { key: "cancelled", label: "Cancel", count: stats.cancelled },
  ];

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-5">
        <section className="mb-5 rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-4 shadow-2xl shadow-black/50 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-yellow-400 sm:text-xs">
                Admin Control
              </p>

              <h1 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                Battle Management
              </h1>

              <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
                Battles ko live monitor aur manage karo.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadBattles(false)}
              disabled={refreshing}
              className="shrink-0 rounded-xl bg-yellow-400 px-4 py-2.5 text-xs font-black text-black active:scale-95 disabled:opacity-60 sm:text-sm"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-black/60 p-3 sm:p-4">
              <p className="text-[10px] text-zinc-500 sm:text-xs">Total Battles</p>
              <p className="mt-1 text-xl font-black text-yellow-400 sm:text-2xl">
                {stats.all}
              </p>
            </div>

            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 sm:p-4">
              <p className="text-[10px] text-green-300 sm:text-xs">Open</p>
              <p className="mt-1 text-xl font-black text-green-400 sm:text-2xl">
                {stats.open}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 sm:p-4">
              <p className="text-[10px] text-blue-300 sm:text-xs">Running</p>
              <p className="mt-1 text-xl font-black text-blue-400 sm:text-2xl">
                {stats.running}
              </p>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 sm:p-4">
              <p className="text-[10px] text-red-300 sm:text-xs">Cancelled</p>
              <p className="mt-1 text-xl font-black text-red-400 sm:text-2xl">
                {stats.cancelled}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black sm:px-4 sm:py-2 sm:text-sm ${
                filter === item.key
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400"
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
            <p className="text-sm font-bold text-zinc-300">Loading battles...</p>
          </div>
        ) : filteredBattles.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="font-black text-zinc-300">No battles found.</p>
            <p className="mt-1 text-sm text-zinc-500">
              Is filter me koi battle nahi hai.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            {filteredBattles.map((battle) => {
              const creatorDisplay = getPlayerDisplay(
                battle.creator_uid,
                battle.creator_name,
                battle.creator_phone,
                "Creator"
              );

              const joinerDisplay = getPlayerDisplay(
                battle.joiner_uid,
                battle.joiner_name,
                battle.joiner_phone,
                "Not joined"
              );

              const winnerDisplay = getPlayerDisplay(
                battle.winner_uid,
                battle.winner_name,
                battle.winner_phone,
                "Not selected"
              );

              return (
                <article
                  key={battle.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-950 p-3.5 shadow-xl shadow-black/30 sm:p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 sm:text-xs">
                        Battle #{battle.id}
                      </p>

                      <h2 className="mt-0.5 text-2xl font-black text-yellow-400 sm:text-3xl">
                        ₹{Number(battle.amount || 0).toLocaleString("en-IN")}
                      </h2>

                      <p className="mt-0.5 text-[10px] text-zinc-500 sm:text-xs">
                        {formatDate(battle.created_at)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase sm:px-3 sm:text-xs ${statusClass(
                        battle.status
                      )}`}
                    >
                      {battle.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="min-w-0 rounded-2xl border border-zinc-800 bg-black p-3">
                      <p className="text-[10px] text-zinc-500 sm:text-xs">
                        Creator
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-zinc-200 sm:text-sm">
                        {creatorDisplay}
                      </p>
                    </div>

                    <div className="min-w-0 rounded-2xl border border-zinc-800 bg-black p-3">
                      <p className="text-[10px] text-zinc-500 sm:text-xs">
                        Joiner
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-zinc-200 sm:text-sm">
                        {joinerDisplay}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 rounded-2xl border border-zinc-800 bg-black p-3">
                    <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-3 text-xs sm:text-sm">
                      <span className="text-zinc-500">Room Code</span>
                      <span className="truncate text-right font-black text-yellow-300">
                        {battle.room_code || "Not added"}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-[90px_minmax(0,1fr)] items-center gap-3 text-xs sm:text-sm">
                      <span className="text-zinc-500">Winner</span>
                      <span className="truncate text-right font-bold text-zinc-200">
                        {winnerDisplay}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/admin/battles/${battle.id}`}
                    className="mt-3 block w-full rounded-xl bg-blue-500 py-3 text-center text-sm font-black text-white active:scale-95 sm:mt-4"
                  >
                    Open Battle
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}