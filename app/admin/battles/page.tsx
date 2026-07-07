"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";

export default function AdminBattlesPage() {
  const [battles, setBattles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

    const { data, error } = await supabase
      .from("battles")
      .select("*")
      .order("created_at", { ascending: false });

    if (showLoader) setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setBattles(data || []);
  }

  const stats = useMemo(() => {
    return {
      all: battles.length,
      open: battles.filter((b) => b.status === "open").length,
      running: battles.filter((b) => b.status === "running").length,
      completed: battles.filter((b) => b.status === "completed").length,
      cancelled: battles.filter((b) => b.status === "cancelled").length,
    };
  }, [battles]);

  const filteredBattles =
    filter === "all"
      ? battles
      : battles.filter((battle) => battle.status === filter);

  function statusClass(status: string) {
    if (status === "open")
      return "border-green-500/30 bg-green-500/10 text-green-300";
    if (status === "running")
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
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
      <div className="mx-auto max-w-6xl px-4 py-5">
        <section className="mb-6 rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
                Admin Control
              </p>

              <h1 className="mt-2 text-3xl font-black text-white">
                Battle Management
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                Battles ko live monitor aur manage karo.
              </p>
            </div>

            <button
              onClick={() => loadBattles()}
              className="rounded-2xl bg-yellow-400 px-5 py-3 font-black text-black active:scale-95"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
              <p className="text-xs text-zinc-500">Total Battles</p>
              <p className="mt-1 text-2xl font-black text-yellow-400">
                {stats.all}
              </p>
            </div>

            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-xs text-green-300">Open</p>
              <p className="mt-1 text-2xl font-black text-green-400">
                {stats.open}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-xs text-blue-300">Running</p>
              <p className="mt-1 text-2xl font-black text-blue-400">
                {stats.running}
              </p>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-xs text-red-300">Cancelled</p>
              <p className="mt-1 text-2xl font-black text-red-400">
                {stats.cancelled}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black ${
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
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
            <p className="font-bold text-zinc-300">Loading battles...</p>
          </div>
        ) : filteredBattles.length === 0 ? (
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="font-black text-zinc-300">No battles found.</p>
            <p className="mt-1 text-sm text-zinc-500">
              Is filter me koi battle nahi hai.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredBattles.map((battle) => (
              <div
                key={battle.id}
                className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-zinc-500">
                      Battle #{battle.id}
                    </p>

                    <h2 className="mt-1 text-3xl font-black text-yellow-400">
                      ₹{battle.amount}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDate(battle.created_at)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(
                      battle.status
                    )}`}
                  >
                    {battle.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-black p-3">
                    <p className="text-xs text-zinc-500">Creator</p>
                    <p className="mt-1 break-all text-sm font-bold text-zinc-300">
                      {battle.creator_uid}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-black p-3">
                    <p className="text-xs text-zinc-500">Joiner</p>
                    <p className="mt-1 break-all text-sm font-bold text-zinc-300">
                      {battle.joiner_uid || "Not joined"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-zinc-800 bg-black p-3">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-zinc-500">Room Code</span>
                    <span className="font-black text-yellow-300">
                      {battle.room_code || "Not added"}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between gap-3 text-sm">
                    <span className="text-zinc-500">Winner</span>
                    <span className="break-all text-right font-bold text-zinc-300">
                      {battle.winner_uid || "Not selected"}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/admin/battles/${battle.id}`}
                  className="mt-4 block w-full rounded-2xl bg-blue-500 py-4 text-center font-black text-white active:scale-95"
                >
                  Open Battle
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}