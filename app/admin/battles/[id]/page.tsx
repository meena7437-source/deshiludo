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
    if (status === "open")
      return "border-green-500/30 bg-green-500/10 text-green-300";
    if (status === "running" || status === "matched")
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    if (status === "completed")
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
    if (status === "cancelled")
      return "border-red-500/30 bg-red-500/10 text-red-300";

    return "border-zinc-700 bg-zinc-800 text-zinc-300";
  }

  function claimClass(claim: string) {
    if (claim === "win") return "text-green-400";
    if (claim === "lose") return "text-red-400";
    if (claim === "cancel") return "text-yellow-400";
    return "text-zinc-400";
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
      const { data, error } = await supabase.rpc("complete_battle_safe", {
        battle_id_input: Number(battleId),
        winner_uid_input: winnerUid,
        loser_uid_input: loserUid,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data === "battle_not_found") toast.error("Battle nahi mili");
      else if (data === "already_closed") toast.error("Battle already closed hai");
      else if (data === "players_missing") toast.error("Dono players missing hain");
      else if (data === "invalid_winner") toast.error("Invalid winner");
      else if (data === "invalid_loser") toast.error("Invalid loser");
      else if (data === "same_winner_loser") toast.error("Winner aur loser same nahi ho sakte");
      else if (data === "completed") {
        toast.success("Winner selected ✅ 10% commission cut ho gaya");
        await loadBattle();
      } else {
        toast.error("Winner select nahi hua");
      }
    } catch (err: any) {
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

    if (!confirm("Battle cancel karke deposit balance me refund dena hai?")) return;

    setSaving(true);

    try {
      const { data, error } = await supabase.rpc("cancel_battle_safe", {
        battle_id_input: Number(battleId),
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data === "battle_not_found") toast.error("Battle nahi mili");
      else if (data === "already_closed") toast.error("Battle already closed hai");
      else if (data === "cancelled") {
        toast.success("Battle cancelled ✅ Refund deposit balance me ho gaya");
        await loadBattle();
      } else {
        toast.error("Cancel failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Cancel/refund failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-5">
        <p className="font-bold text-zinc-300">Loading battle...</p>
      </main>
    );
  }

  if (!battle) {
    return (
      <main className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-5">
        <p className="font-black text-red-300">Battle not found</p>
      </main>
    );
  }

  const closed = battle.status === "completed" || battle.status === "cancelled";
  const totalPot = Number(battle.amount || 0) * 2;
  const commission = Math.round(totalPot * 10) / 100;
  const winningAmount = totalPot - commission;

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <section className="mb-6 rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5">
          <button
            onClick={() => router.push("/admin/battles")}
            className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300"
          >
            ← Back
          </button>

          <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            Admin Battle Detail
          </p>

          <h1 className="mt-2 text-3xl font-black">Battle #{battleId}</h1>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(battle.status)}`}>
              {battle.status}
            </span>
            <span className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs font-bold">
              Entry ₹{battle.amount}
            </span>
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
              Commission ₹{battle.admin_commission || commission}
            </span>
            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
              Winner ₹{battle.winner_amount || winningAmount}
            </span>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">Creator</p>
            <p className="mt-3 text-sm text-zinc-500">UID</p>
            <p className="mt-1 break-all font-bold">{battle.creator_uid}</p>
            <p className="mt-4 text-sm text-zinc-500">Claim</p>
            <p className={`mt-1 text-xl font-black uppercase ${claimClass(battle.creator_claim)}`}>
              {battle.creator_claim || "Not uploaded"}
            </p>
          </div>

          <div className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">Joiner</p>
            <p className="mt-3 text-sm text-zinc-500">UID</p>
            <p className="mt-1 break-all font-bold">{battle.joiner_uid || "Not joined"}</p>
            <p className="mt-4 text-sm text-zinc-500">Claim</p>
            <p className={`mt-1 text-xl font-black uppercase ${claimClass(battle.joiner_claim)}`}>
              {battle.joiner_claim || "Not uploaded"}
            </p>
          </div>
        </section>

        {battle.status === "cancelled" && (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-black text-red-300">
            Battle Cancelled / Refund Done
          </div>
        )}

        {battle.winner_uid && (
          <div className="mb-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
            <p className="font-black text-green-300">Winner Selected ✅</p>
            <p className="mt-1 break-all text-sm">{battle.winner_uid}</p>
          </div>
        )}

        <button
          onClick={cancelBattle}
          disabled={saving || closed}
          className="mb-6 w-full rounded-2xl bg-red-600 py-4 font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {saving ? "Saving..." : "Cancel Battle & Refund"}
        </button>

        <section>
          <h2 className="mb-4 text-2xl font-black text-yellow-400">
            Battle Screenshots
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 font-black text-yellow-400">Creator Screenshot</h3>

              {battle.creator_result ? (
                <a href={battle.creator_result} target="_blank">
                  <img src={battle.creator_result} alt="Creator Result" className="mb-4 w-full rounded-2xl border border-zinc-800" />
                </a>
              ) : (
                <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                  Creator ne screenshot upload nahi kiya.
                </div>
              )}

              <button
                onClick={() => selectWinner(battle.creator_uid, battle.joiner_uid)}
                disabled={saving || closed || !battle.joiner_uid}
                className="w-full rounded-2xl bg-green-500 py-4 font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                Creator Winner
              </button>
            </div>

            <div className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 font-black text-yellow-400">Joiner Screenshot</h3>

              {battle.joiner_result ? (
                <a href={battle.joiner_result} target="_blank">
                  <img src={battle.joiner_result} alt="Joiner Result" className="mb-4 w-full rounded-2xl border border-zinc-800" />
                </a>
              ) : (
                <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                  Joiner ne screenshot upload nahi kiya.
                </div>
              )}

              <button
                onClick={() => selectWinner(battle.joiner_uid, battle.creator_uid)}
                disabled={saving || closed || !battle.joiner_uid}
                className="w-full rounded-2xl bg-blue-500 py-4 font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                Joiner Winner
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}