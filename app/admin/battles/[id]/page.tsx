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
    if (status === "running")
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
      <main className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-5">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          <p className="font-bold text-zinc-300">Loading battle...</p>
        </div>
      </main>
    );
  }

  if (!battle) {
    return (
      <main className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-5">
        <div className="rounded-[28px] border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="font-black text-red-300">Battle not found</p>
        </div>
      </main>
    );
  }

  const closed = battle.status === "completed" || battle.status === "cancelled";
  const winningAmount = Number(battle.amount || 0) * 2;

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <section className="mb-6 rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
                Admin Battle Detail
              </p>

              <h1 className="mt-2 text-3xl font-black text-white">
                Battle #{battleId}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(
                    battle.status
                  )}`}
                >
                  {battle.status}
                </span>

                <span className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs font-bold text-zinc-300">
                  Entry ₹{battle.amount}
                </span>

                <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
                  Winning ₹{winningAmount}
                </span>
              </div>
            </div>

            <button
              onClick={() => router.push("/admin/battles")}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 font-black text-zinc-300 active:scale-95"
            >
              ← Back
            </button>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
              Creator
            </p>

            <p className="mt-3 text-sm text-zinc-500">UID</p>
            <p className="mt-1 break-all font-bold text-zinc-200">
              {battle.creator_uid}
            </p>

            <p className="mt-4 text-sm text-zinc-500">Claim</p>
            <p
              className={`mt-1 text-xl font-black uppercase ${claimClass(
                battle.creator_claim
              )}`}
            >
              {battle.creator_claim || "Not uploaded"}
            </p>
          </div>

          <div className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
              Joiner
            </p>

            <p className="mt-3 text-sm text-zinc-500">UID</p>
            <p className="mt-1 break-all font-bold text-zinc-200">
              {battle.joiner_uid || "Not joined"}
            </p>

            <p className="mt-4 text-sm text-zinc-500">Claim</p>
            <p
              className={`mt-1 text-xl font-black uppercase ${claimClass(
                battle.joiner_claim
              )}`}
            >
              {battle.joiner_claim || "Not uploaded"}
            </p>
          </div>
        </section>

        <section className="mb-5 rounded-[26px] border border-zinc-800 bg-zinc-950 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-black p-4">
              <p className="text-xs text-zinc-500">Room Code</p>
              <p className="mt-1 text-2xl font-black tracking-widest text-yellow-300">
                {battle.room_code || "N/A"}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black p-4">
              <p className="text-xs text-zinc-500">Winner</p>
              <p className="mt-1 break-all text-sm font-bold text-green-300">
                {battle.winner_uid || "Not selected"}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black p-4">
              <p className="text-xs text-zinc-500">Loser</p>
              <p className="mt-1 break-all text-sm font-bold text-red-300">
                {battle.loser_uid || "Not selected"}
              </p>
            </div>
          </div>
        </section>

        {battle.status === "cancelled" && (
          <div className="mb-5 rounded-[24px] border border-red-500/30 bg-red-500/10 p-4">
            <p className="font-black text-red-300">
              Battle Cancelled / Refund Done
            </p>
          </div>
        )}

        {battle.winner_uid && (
          <div className="mb-5 rounded-[24px] border border-green-500/30 bg-green-500/10 p-4">
            <p className="font-black text-green-300">Winner Selected ✅</p>
            <p className="mt-1 break-all text-sm text-zinc-300">
              {battle.winner_uid}
            </p>
          </div>
        )}

        <button
          onClick={cancelBattle}
          disabled={saving || closed}
          className="mb-6 w-full rounded-2xl bg-red-600 py-4 font-black text-white shadow-lg shadow-red-500/20 disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-95"
        >
          {saving ? "Saving..." : "Cancel Battle & Refund"}
        </button>

        <section>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
              Proof Review
            </p>
            <h2 className="mt-1 text-2xl font-black">Battle Screenshots</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 font-black text-yellow-400">
                Creator Screenshot
              </h3>

              {battle.creator_result ? (
                <a href={battle.creator_result} target="_blank">
                  <img
                    src={battle.creator_result}
                    alt="Creator Result"
                    className="mb-4 w-full rounded-2xl border border-zinc-800"
                  />
                </a>
              ) : (
                <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                  Creator ne screenshot upload nahi kiya.
                </div>
              )}

              <button
                onClick={() =>
                  selectWinner(battle.creator_uid, battle.joiner_uid)
                }
                disabled={saving || closed || !battle.joiner_uid}
                className="w-full rounded-2xl bg-green-500 py-4 font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-95"
              >
                Creator Winner
              </button>
            </div>

            <div className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 font-black text-yellow-400">
                Joiner Screenshot
              </h3>

              {battle.joiner_result ? (
                <a href={battle.joiner_result} target="_blank">
                  <img
                    src={battle.joiner_result}
                    alt="Joiner Result"
                    className="mb-4 w-full rounded-2xl border border-zinc-800"
                  />
                </a>
              ) : (
                <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                  Joiner ne screenshot upload nahi kiya.
                </div>
              )}

              <button
                onClick={() =>
                  selectWinner(battle.joiner_uid, battle.creator_uid)
                }
                disabled={saving || closed || !battle.joiner_uid}
                className="w-full rounded-2xl bg-blue-500 py-4 font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-95"
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