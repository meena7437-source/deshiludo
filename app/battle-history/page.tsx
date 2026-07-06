"use client";

import { useEffect, useState } from "react";
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
  }, []);

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

  function getStatusStyle(status: string) {
    if (status === "open") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    if (status === "matched") return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    if (status === "completed") return "text-green-400 bg-green-400/10 border-green-400/30";
    if (status === "cancelled") return "text-red-400 bg-red-400/10 border-red-400/30";
    return "text-zinc-400 bg-zinc-400/10 border-zinc-400/30";
  }

  function getResultText(battle: any) {
    if (battle.status === "completed") {
      return battle.winner_uid === currentUid ? "You Won ✅" : "You Lost ❌";
    }

    if (battle.status === "cancelled") {
      return "Cancelled / Refunded";
    }

    if (battle.status === "matched") {
      return "Match Running";
    }

    return "Waiting for Player";
  }

  function getResultColor(battle: any) {
    if (battle.status === "completed") {
      return battle.winner_uid === currentUid ? "text-green-400" : "text-red-400";
    }

    if (battle.status === "cancelled") return "text-red-400";
    if (battle.status === "matched") return "text-blue-400";
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
      <main className="min-h-screen bg-black text-white px-4 py-6">
        <div className="max-w-xl mx-auto bg-zinc-900 rounded-3xl p-6 border border-zinc-800">
          <p className="font-bold">Loading battle history...</p>
          <p className="text-zinc-500 text-sm mt-1">Please wait.</p>
        </div>
      </main>
    );
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
          <div className="mb-5">
            <h1 className="text-3xl font-extrabold text-yellow-400">
              Battle History
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Aapki create aur joined battles yahan dikhegi.
            </p>
          </div>

          {battles.length === 0 ? (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-xl font-bold">No history found</p>
              <p className="text-zinc-400 text-sm mt-2">
                Battle create ya join hone ke baad yahan dikhegi.
              </p>

              <button
                onClick={() => router.push("/create-battle")}
                className="mt-5 w-full bg-yellow-400 text-black font-extrabold py-3 rounded-2xl"
              >
                Create Battle
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {battles.map((battle) => {
                const isCreator = battle.creator_uid === currentUid;
                const opponentPhone = isCreator
                  ? battle.joiner_phone || "Waiting"
                  : battle.creator_phone || "User";

                return (
                  <div
                    key={battle.id}
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-zinc-500">
                          Battle #{battle.id}
                        </p>
                        <p className="text-3xl font-extrabold text-yellow-400 mt-1">
                          ₹{battle.amount}
                        </p>
                      </div>

                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border uppercase ${getStatusStyle(
                          battle.status
                        )}`}
                      >
                        {battle.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                        <p className="text-xs text-zinc-500">Your Role</p>
                        <p className="font-bold">
                          {isCreator ? "Creator" : "Joiner"}
                        </p>
                      </div>

                      <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                        <p className="text-xs text-zinc-500">Opponent</p>
                        <p className="font-bold text-sm truncate">
                          {opponentPhone}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                      <div className="flex justify-between gap-3">
                        <span className="text-zinc-400 text-sm">Result</span>
                        <span className={`font-bold text-sm ${getResultColor(battle)}`}>
                          {getResultText(battle)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3 mt-2">
                        <span className="text-zinc-400 text-sm">Date</span>
                        <span className="font-semibold text-sm text-right">
                          {formatDate(battle.created_at)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/battle/${battle.id}`)}
                      className="w-full mt-4 bg-yellow-400 text-black font-extrabold py-3 rounded-2xl active:scale-[0.99]"
                    >
                      View Battle
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}