"use client";

import { useEffect, useState } from "react";
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

  const filteredBattles =
    filter === "all"
      ? battles
      : battles.filter((battle) => battle.status === filter);

  function statusClass(status: string) {
    if (status === "open") return "bg-green-500/20 text-green-400";
    if (status === "running") return "bg-blue-500/20 text-blue-400";
    if (status === "completed") return "bg-yellow-500/20 text-yellow-400";
    if (status === "cancelled") return "bg-red-500/20 text-red-400";
    return "bg-zinc-700 text-zinc-300";
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 sm:p-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400">
              Admin Battles
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Battles ko monitor aur manage karo.
            </p>
          </div>

          <button
            onClick={() => loadBattles()}
            className="bg-yellow-400 text-black font-bold px-5 py-2 rounded-xl active:scale-95 transition"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl p-3 font-bold ${
              filter === "all" ? "bg-yellow-400 text-black" : "bg-zinc-900"
            }`}
          >
            All
          </button>

          <button
            onClick={() => setFilter("open")}
            className={`rounded-xl p-3 font-bold ${
              filter === "open" ? "bg-green-500 text-white" : "bg-zinc-900"
            }`}
          >
            Open
          </button>

          <button
            onClick={() => setFilter("running")}
            className={`rounded-xl p-3 font-bold ${
              filter === "running" ? "bg-blue-500 text-white" : "bg-zinc-900"
            }`}
          >
            Running
          </button>

          <button
            onClick={() => setFilter("completed")}
            className={`rounded-xl p-3 font-bold ${
              filter === "completed"
                ? "bg-yellow-500 text-black"
                : "bg-zinc-900"
            }`}
          >
            Completed
          </button>
        </div>

        {loading ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            Loading battles...
          </div>
        ) : filteredBattles.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-400">
            No battles found.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBattles.map((battle) => (
              <div
                key={battle.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-bold text-yellow-400">
                        Battle #{battle.id}
                      </h2>

                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full ${statusClass(
                          battle.status
                        )}`}
                      >
                        {battle.status}
                      </span>
                    </div>

                    <p className="text-lg font-bold">Amount: ₹{battle.amount}</p>

                    <div className="text-sm text-zinc-400 space-y-1 break-all">
                      <p>Creator: {battle.creator_uid}</p>
                      <p>Joiner: {battle.joiner_uid || "Not joined"}</p>
                    </div>
                  </div>

                  <Link
                    href={`/admin/battles/${battle.id}`}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-5 py-3 rounded-xl text-center active:scale-95 transition"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}