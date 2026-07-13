"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "../../../../lib/supabase";

type PlayerProfile = {
  username: string;
  name: string;
  phone: string;
};

export default function AdminBattleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const battleId = params.id as string;

  const [battle, setBattle] = useState<any>(null);
  const [playerProfiles, setPlayerProfiles] = useState<
    Record<string, PlayerProfile>
  >({});
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
        async () => {
          await loadBattle(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId]);

  async function loadBattle(showLoader = true) {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .maybeSingle();

      if (error) {
        toast.error(error.message);
        return;
      }

      setBattle(data);

      if (!data) {
        setPlayerProfiles({});
        return;
      }

      const userIds = Array.from(
        new Set(
          [data.creator_uid, data.joiner_uid, data.winner_uid].filter(Boolean)
        )
      ) as string[];

      if (userIds.length === 0) {
        setPlayerProfiles({});
        return;
      }

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("firebase_uid,username,name,phone")
        .in("firebase_uid", userIds);

      if (usersError) {
        console.error("Player details load error:", usersError);
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
      toast.error(error?.message || "Battle load nahi hui");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
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

  function getPlayerProfile(uid?: string | null) {
    if (!uid) return undefined;
    return playerProfiles[uid];
  }

  function getPlayerTitle(
    uid?: string | null,
    fallbackName?: string | null,
    emptyLabel = "Player"
  ) {
    if (!uid) return emptyLabel;

    const profile = getPlayerProfile(uid);

    if (profile?.username) return `@${profile.username}`;
    if (profile?.name) return profile.name;
    if (fallbackName?.trim()) return fallbackName.trim();

    return emptyLabel;
  }

  function getPlayerName(
    uid?: string | null,
    fallbackName?: string | null
  ) {
    if (!uid) return "";

    const profile = getPlayerProfile(uid);

    if (profile?.name) return profile.name;
    if (fallbackName?.trim()) return fallbackName.trim();

    return "";
  }

  function getPlayerPhone(
    uid?: string | null,
    fallbackPhone?: string | null
  ) {
    if (!uid) return "";

    const profile = getPlayerProfile(uid);

    return String(profile?.phone || fallbackPhone || "").trim();
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
      else if (data === "already_closed")
        toast.error("Battle already closed hai");
      else if (data === "players_missing")
        toast.error("Dono players missing hain");
      else if (data === "invalid_winner") toast.error("Invalid winner");
      else if (data === "invalid_loser") toast.error("Invalid loser");
      else if (data === "same_winner_loser")
        toast.error("Winner aur loser same nahi ho sakte");
      else if (data === "completed") {
        toast.success("Winner selected ✅ 10% commission cut ho gaya");
        await loadBattle(false);
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

    if (!confirm("Battle cancel karke wallet me refund dena hai?")) return;

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
      else if (data === "already_closed")
        toast.error("Battle already closed hai");
      else if (
        data === "cancelled" ||
        data === "cancelled_refunded"
      ) {
        toast.success("Battle cancelled ✅ Refund wallet me ho gaya");
        await loadBattle(false);
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
      <main className="flex min-h-screen items-center justify-center bg-[#07070b] p-5 text-white">
        <p className="font-bold text-zinc-300">Loading battle...</p>
      </main>
    );
  }

  if (!battle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07070b] p-5 text-white">
        <p className="font-black text-red-300">Battle not found</p>
      </main>
    );
  }

  const isCancelled = battle.status === "cancelled";
  const isCompleted = battle.status === "completed";
  const closed = isCompleted || isCancelled;

  const entryAmount = Number(battle.amount || 0);
  const totalPot = entryAmount * 2;
  const calculatedCommission = Math.round(totalPot * 10) / 100;
  const completedCommission = Number(
    battle.admin_commission ?? calculatedCommission
  );
  const completedWinningAmount = Number(
    battle.winner_amount ?? totalPot - completedCommission
  );

  const refundAmount = entryAmount * (battle.joiner_uid ? 2 : 1);

  const creatorTitle = getPlayerTitle(
    battle.creator_uid,
    battle.creator_name,
    "Creator"
  );
  const creatorName = getPlayerName(
    battle.creator_uid,
    battle.creator_name
  );
  const creatorPhone = getPlayerPhone(
    battle.creator_uid,
    battle.creator_phone
  );

  const joinerTitle = getPlayerTitle(
    battle.joiner_uid,
    battle.joiner_name,
    "Not joined"
  );
  const joinerName = getPlayerName(
    battle.joiner_uid,
    battle.joiner_name
  );
  const joinerPhone = getPlayerPhone(
    battle.joiner_uid,
    battle.joiner_phone
  );

  const winnerTitle = getPlayerTitle(
    battle.winner_uid,
    battle.winner_name,
    "Winner"
  );
  const winnerName = getPlayerName(
    battle.winner_uid,
    battle.winner_name
  );
  const winnerPhone = getPlayerPhone(
    battle.winner_uid,
    battle.winner_phone
  );

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <section className="mb-6 rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5">
          <button
            type="button"
            onClick={() => router.push("/admin/battles")}
            className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300"
          >
            ← Back
          </button>

          <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            Admin Battle Detail
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Battle #{battleId}
          </h1>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(
                battle.status
              )}`}
            >
              {battle.status}
            </span>

            <span className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs font-bold">
              Entry ₹{entryAmount}
            </span>

            {isCancelled ? (
              <>
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
                  Commission ₹0
                </span>

                <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                  Refund ₹{refundAmount}
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
                  Commission ₹
                  {isCompleted ? completedCommission : calculatedCommission}
                </span>

                <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
                  Winner ₹
                  {isCompleted
                    ? completedWinningAmount
                    : totalPot - calculatedCommission}
                </span>
              </>
            )}
          </div>
        </section>

        <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
              Creator
            </p>

            <p className="mt-3 text-lg font-black text-white">
              {creatorTitle}
            </p>

            {creatorName && creatorName !== creatorTitle && (
              <p className="mt-1 text-sm font-bold text-zinc-300">
                {creatorName}
              </p>
            )}

            {creatorPhone && (
              <p className="mt-1 text-sm font-bold text-green-300">
                {creatorPhone}
              </p>
            )}

            <p className="mt-3 text-sm text-zinc-500">UID</p>
            <p className="mt-1 break-all text-sm font-bold">
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

            <p className="mt-3 text-lg font-black text-white">
              {joinerTitle}
            </p>

            {joinerName && joinerName !== joinerTitle && (
              <p className="mt-1 text-sm font-bold text-zinc-300">
                {joinerName}
              </p>
            )}

            {joinerPhone && (
              <p className="mt-1 text-sm font-bold text-green-300">
                {joinerPhone}
              </p>
            )}

            <p className="mt-3 text-sm text-zinc-500">UID</p>
            <p className="mt-1 break-all text-sm font-bold">
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

        {isCancelled && (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="font-black text-red-300">
              Battle Cancelled / Refund Done ✅
            </p>
            <p className="mt-1 text-sm text-red-200">
              Total refund ₹{refundAmount} • Commission ₹0 • Winner nahi hai
            </p>
          </div>
        )}

        {!isCancelled && battle.winner_uid && (
          <div className="mb-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
            <p className="font-black text-green-300">
              Winner Selected ✅
            </p>

            <p className="mt-2 text-lg font-black text-white">
              {winnerTitle}
            </p>

            {winnerName && winnerName !== winnerTitle && (
              <p className="mt-1 text-sm font-bold text-zinc-200">
                {winnerName}
              </p>
            )}

            {winnerPhone && (
              <p className="mt-1 text-sm font-bold text-green-300">
                {winnerPhone}
              </p>
            )}

            <p className="mt-2 break-all text-xs text-zinc-500">
              UID: {battle.winner_uid}
            </p>
          </div>
        )}

        <button
          type="button"
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
              <h3 className="mb-3 font-black text-yellow-400">
                Creator Screenshot
              </h3>

              {battle.creator_result ? (
                <a
                  href={battle.creator_result}
                  target="_blank"
                  rel="noreferrer"
                >
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
                type="button"
                onClick={() =>
                  selectWinner(
                    battle.creator_uid,
                    battle.joiner_uid
                  )
                }
                disabled={saving || closed || !battle.joiner_uid}
                className="w-full rounded-2xl bg-green-500 py-4 font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                Creator Winner
              </button>
            </div>

            <div className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 font-black text-yellow-400">
                Joiner Screenshot
              </h3>

              {battle.joiner_result ? (
                <a
                  href={battle.joiner_result}
                  target="_blank"
                  rel="noreferrer"
                >
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
                type="button"
                onClick={() =>
                  selectWinner(
                    battle.joiner_uid,
                    battle.creator_uid
                  )
                }
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
