"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "../../../../lib/supabase";

export default function AdminBattleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const battleId = params.id as string;

  const [battle, setBattle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBattle();

    const channel = supabase
      .channel(`admin-battle-detail-${battleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battles",
          filter: `id=eq.${battleId}`,
        },
        (payload) => {
          if (payload.new) setBattle(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId]);

  async function loadBattle() {
    setLoading(true);

    const { data, error } = await supabase
      .from("battles")
      .select("*")
      .eq("id", battleId)
      .maybeSingle();

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setBattle(data);
  }

  function statusClass(status: string) {
    if (status === "open") return "bg-green-500/20 text-green-400";
    if (status === "running") return "bg-blue-500/20 text-blue-400";
    if (status === "completed") return "bg-yellow-500/20 text-yellow-400";
    if (status === "cancelled") return "bg-red-500/20 text-red-400";
    return "bg-zinc-700 text-zinc-300";
  }

  async function updateWallet(uid: string, amount: number) {
    if (!uid) throw new Error("UID missing hai");

    const { error } = await supabase.rpc("add_wallet_balance", {
      user_id_input: uid,
      amount_input: amount,
    });

    if (error) throw error;
  }

  async function selectWinner(winnerUid: string, loserUid: string) {
    if (!battle) return;

    if (battle.status === "completed" || battle.status === "cancelled") {
      toast.error("Ye battle already closed hai");
      return;
    }

    if (!winnerUid || !loserUid) {
      toast.error("Winner/Loser UID missing hai");
      return;
    }

    if (!confirm("Kya aap sure ho winner select karna hai?")) return;

    setSaving(true);

    try {
      const winningAmount = Number(battle.amount || 0) * 2;

      const { data: updatedBattle, error: battleError } = await supabase
        .from("battles")
        .update({
          status: "completed",
          winner_uid: winnerUid,
          loser_uid: loserUid,
        })
        .eq("id", battleId)
        .not("status", "in", '("completed","cancelled")')
        .select("*")
        .maybeSingle();

      if (battleError) {
        toast.error(battleError.message);
        return;
      }

      if (!updatedBattle) {
        toast.error("Battle already closed hai");
        await loadBattle();
        return;
      }

      await updateWallet(winnerUid, winningAmount);

      toast.success(`Winner selected ✅ ₹${winningAmount} wallet me add ho gaya`);
      await loadBattle();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Winner select failed");
    } finally {
      setSaving(false);
    }
  }

  async function cancelBattle() {
    if (!battle) return;

    if (battle.status === "completed" || battle.status === "cancelled") {
      toast.error("Ye battle already closed hai");
      return;
    }

    if (!confirm("Battle cancel karke refund dena hai?")) return;

    setSaving(true);

    try {
      const amount = Number(battle.amount || 0);

      const { data: updatedBattle, error: battleError } = await supabase
        .from("battles")
        .update({
          status: "cancelled",
          winner_uid: null,
          loser_uid: null,
        })
        .eq("id", battleId)
        .not("status", "in", '("completed","cancelled")')
        .select("*")
        .maybeSingle();

      if (battleError) {
        toast.error(battleError.message);
        return;
      }

      if (!updatedBattle) {
        toast.error("Battle already closed hai");
        await loadBattle();
        return;
      }

      if (battle.creator_uid) await updateWallet(battle.creator_uid, amount);
      if (battle.joiner_uid) await updateWallet(battle.joiner_uid, amount);

      toast.success("Battle cancelled ✅ Refund ho gaya");
      await loadBattle();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Cancel/refund failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white p-5">
        <div className="max-w-4xl mx-auto bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          Loading battle...
        </div>
      </main>
    );
  }

  if (!battle) {
    return (
      <main className="min-h-screen bg-black text-white p-5">
        <div className="max-w-4xl mx-auto bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          Battle not found
        </div>
      </main>
    );
  }

  const closed = battle.status === "completed" || battle.status === "cancelled";

  return (
    <main className="min-h-screen bg-black text-white p-4 sm:p-5">
      <div className="max-w-4xl mx-auto">
        <div className="bg-zinc-900 rounded-2xl p-5 sm:p-6 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
            <div>
              <h1 className="text-3xl font-bold text-yellow-400">
                Battle #{battleId}
              </h1>

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${statusClass(
                    battle.status
                  )}`}
                >
                  {battle.status}
                </span>

                <span className="text-zinc-300 font-bold">
                  Amount: ₹{battle.amount}
                </span>
              </div>
            </div>

            <button
              onClick={() => router.push("/admin/battles")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-5 py-3 rounded-xl active:scale-95 transition"
            >
              Back
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <p className="text-zinc-400 text-sm">Creator UID</p>
              <p className="font-bold break-all mt-1">{battle.creator_uid}</p>
              <p className="text-zinc-400 text-sm mt-3">Creator Claim</p>
              <p className="font-bold">{battle.creator_claim || "Not uploaded"}</p>
            </div>

            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <p className="text-zinc-400 text-sm">Joiner UID</p>
              <p className="font-bold break-all mt-1">
                {battle.joiner_uid || "Not joined"}
              </p>
              <p className="text-zinc-400 text-sm mt-3">Joiner Claim</p>
              <p className="font-bold">{battle.joiner_claim || "Not uploaded"}</p>
            </div>
          </div>

          {battle.room_code && (
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 mb-5">
              <p className="text-zinc-400 text-sm">Room Code</p>
              <p className="text-2xl font-bold tracking-widest mt-1">
                {battle.room_code}
              </p>
            </div>
          )}

          {battle.winner_uid && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-5">
              <p className="text-green-400 font-bold break-all">
                Winner: {battle.winner_uid}
              </p>
            </div>
          )}

          {battle.status === "cancelled" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5">
              <p className="text-red-400 font-bold">
                Battle Cancelled / Refund Done
              </p>
            </div>
          )}

          <button
            onClick={cancelBattle}
            disabled={saving || closed}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl disabled:bg-zinc-700 disabled:text-zinc-400 active:scale-95 transition mb-6"
          >
            {saving ? "Saving..." : "Cancel Battle & Refund"}
          </button>

          <h2 className="text-2xl font-bold text-yellow-400 mb-4">
            Battle Screenshots
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <h3 className="font-bold mb-3">Creator Screenshot</h3>

              {battle.creator_result ? (
                <a href={battle.creator_result} target="_blank">
                  <img
                    src={battle.creator_result}
                    alt="Creator Result"
                    className="w-full rounded-xl border border-zinc-700 mb-4"
                  />
                </a>
              ) : (
                <p className="text-red-400 mb-4">
                  Creator ne screenshot upload nahi kiya.
                </p>
              )}

              <button
                onClick={() =>
                  selectWinner(battle.creator_uid, battle.joiner_uid)
                }
                disabled={saving || closed || !battle.joiner_uid}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl disabled:bg-zinc-700 disabled:text-zinc-400 active:scale-95 transition"
              >
                Creator Winner
              </button>
            </div>

            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <h3 className="font-bold mb-3">Joiner Screenshot</h3>

              {battle.joiner_result ? (
                <a href={battle.joiner_result} target="_blank">
                  <img
                    src={battle.joiner_result}
                    alt="Joiner Result"
                    className="w-full rounded-xl border border-zinc-700 mb-4"
                  />
                </a>
              ) : (
                <p className="text-red-400 mb-4">
                  Joiner ne screenshot upload nahi kiya.
                </p>
              )}

              <button
                onClick={() =>
                  selectWinner(battle.joiner_uid, battle.creator_uid)
                }
                disabled={saving || closed || !battle.joiner_uid}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl disabled:bg-zinc-700 disabled:text-zinc-400 active:scale-95 transition"
              >
                Joiner Winner
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}