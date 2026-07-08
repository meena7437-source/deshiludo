"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "../../../lib/firebase";
import { supabase } from "../../../lib/supabase";

export default function BattlePage() {
  const router = useRouter();
  const params = useParams();
  const battleId = params.id as string;

  const [battle, setBattle] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [claim, setClaim] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRoom, setSavingRoom] = useState(false);
  const [uploading, setUploading] = useState(false);

  const lastBattleRef = useRef<any>(null);

  useEffect(() => {
    loadBattle(true);

    const channel = supabase
      .channel(`battle-live-${battleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battles",
          filter: `id=eq.${battleId}`,
        },
        (payload) => {
          const updatedBattle: any = payload.new;
          if (!updatedBattle) return;

          const oldBattle = lastBattleRef.current;
          const user = auth.currentUser;

          if (oldBattle && user) {
            if (!oldBattle.joiner_uid && updatedBattle.joiner_uid) {
              toast("Opponent battle join kar chuka hai 🔔");
            }

            if (!oldBattle.room_code && updatedBattle.room_code) {
              toast.success("Room code add ho gaya ✅");
            }

            if (
              oldBattle.status !== "completed" &&
              updatedBattle.status === "completed"
            ) {
              if (updatedBattle.winner_uid === user.uid) {
                toast.success("Aap battle jeet gaye 🎉");
              } else {
                toast.error("Aap battle haar gaye");
              }
            }

            if (
              oldBattle.status !== "cancelled" &&
              updatedBattle.status === "cancelled"
            ) {
              toast.success("Battle cancel ho gayi, refund done ✅");
            }

            if (
              updatedBattle.creator_uid === user.uid &&
              !oldBattle.joiner_result_uploaded &&
              updatedBattle.joiner_result_uploaded
            ) {
              toast("Opponent ne result screenshot upload kar diya 🔔");
            }

            if (
              updatedBattle.joiner_uid === user.uid &&
              !oldBattle.creator_result_uploaded &&
              updatedBattle.creator_result_uploaded
            ) {
              toast("Opponent ne result screenshot upload kar diya 🔔");
            }
          }

          lastBattleRef.current = updatedBattle;
          setBattle(updatedBattle);

          if (updatedBattle.room_code) {
            setRoomCode(updatedBattle.room_code);
          }

          if (user) {
            if (
              updatedBattle.creator_uid === user.uid &&
              updatedBattle.creator_claim
            ) {
              setClaim(updatedBattle.creator_claim);
            }

            if (
              updatedBattle.joiner_uid === user.uid &&
              updatedBattle.joiner_claim
            ) {
              setClaim(updatedBattle.joiner_claim);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId]);

  async function loadBattle(showLoader = false) {
    const user = auth.currentUser;

    if (!user) {
      router.push("/login");
      return;
    }

    if (showLoader) setLoading(true);

    const { data, error } = await supabase
      .from("battles")
      .select("*")
      .eq("id", battleId)
      .maybeSingle();

    if (showLoader) setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data) {
      toast.error("Battle not found");
      router.push("/battle-history");
      return;
    }

    lastBattleRef.current = data;
    setBattle(data);

    if (data.room_code) setRoomCode(data.room_code);

    if (data.creator_uid === user.uid && data.creator_claim) {
      setClaim(data.creator_claim);
    }

    if (data.joiner_uid === user.uid && data.joiner_claim) {
      setClaim(data.joiner_claim);
    }
  }

  function isCreator() {
    return auth.currentUser && battle?.creator_uid === auth.currentUser.uid;
  }

  function isJoiner() {
    return auth.currentUser && battle?.joiner_uid === auth.currentUser.uid;
  }

  async function autoSettleBattle() {
    const { data, error } = await supabase.rpc("settle_battle_safe", {
      battle_id_input: Number(battleId),
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data === "creator_won" || data === "joiner_won") {
      toast.success("Winner payment done ✅");
      await loadBattle(false);
      return;
    }

    if (data === "cancelled_refunded") {
      toast.success("Battle cancelled ✅ Refund done");
      await loadBattle(false);
      return;
    }

    if (data === "waiting_claims") {
      toast.success("Result uploaded ✅ Opponent ke result ka wait hai");
      await loadBattle(false);
      return;
    }

    if (data === "dispute") {
      toast.success("Result uploaded ✅ Admin review required");
      await loadBattle(false);
      return;
    }

    if (data === "already_completed") {
      toast.error("Battle already completed hai");
      await loadBattle(false);
      return;
    }

    if (data === "already_cancelled") {
      toast.error("Battle already cancelled hai");
      await loadBattle(false);
      return;
    }

    if (data === "battle_not_found") {
      toast.error("Battle nahi mili");
      router.push("/battle-history");
    }
  }

  async function saveRoomCode() {
    if (!battle) return;

    if (!isCreator()) {
      toast.error("Sirf creator room code daal sakta hai");
      return;
    }

    if (!battle.joiner_uid) {
      toast.error("Pehle koi player join kare");
      return;
    }

    if (!roomCode.trim()) {
      toast.error("Room code enter karo");
      return;
    }

    setSavingRoom(true);

    const { error } = await supabase
      .from("battles")
      .update({ room_code: roomCode.trim(), status: "running" })
      .eq("id", battleId)
      .not("status", "in", '("completed","cancelled")');

    setSavingRoom(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Room code save ho gaya ✅");
    await loadBattle(false);
  }

  async function copyRoomCode() {
    if (!battle?.room_code) {
      toast.error("Room code abhi available nahi hai");
      return;
    }

    await navigator.clipboard.writeText(battle.room_code);
    toast.success("Room code copied ✅");
  }

  async function submitResult() {
    const user = auth.currentUser;

    if (!user) {
      router.push("/login");
      return;
    }

    if (!battle) {
      toast.error("Battle load nahi hui");
      return;
    }

    if (battle.status === "completed" || battle.status === "cancelled") {
      toast.error("Ye battle already closed hai");
      return;
    }

    if (!battle?.room_code) {
      toast.error("Room code save hone ke baad result upload hoga");
      return;
    }

    if (!isCreator() && !isJoiner()) {
      toast.error("Aap is battle ke player nahi ho");
      return;
    }

    if (!claim) {
      toast.error("Win / Lose / Cancel me se ek select karo");
      return;
    }

    if (!file) {
      toast.error("Please select screenshot");
      return;
    }

    setUploading(true);

    try {
      const filePath = `battle-${battleId}/${user.uid}-${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("battle-results")
        .upload(filePath, file);

      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("battle-results")
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;

      let updateData: any = {};

      if (battle.creator_uid === user.uid) {
        updateData = {
          creator_result: imageUrl,
          creator_result_uploaded: true,
          creator_claim: claim,
        };
      }

      if (battle.joiner_uid === user.uid) {
        updateData = {
          joiner_result: imageUrl,
          joiner_result_uploaded: true,
          joiner_claim: claim,
        };
      }

      const { error: updateError } = await supabase
        .from("battles")
        .update(updateData)
        .eq("id", battleId)
        .not("status", "in", '("completed","cancelled")');

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      await autoSettleBattle();
      setFile(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Result upload failed");
    } finally {
      setUploading(false);
    }
  }

  function statusClass(status: string) {
    if (status === "open")
      return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    if (status === "running")
      return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
    if (status === "completed")
      return "bg-green-500/15 text-green-300 border-green-500/30";
    if (status === "cancelled")
      return "bg-red-500/15 text-red-300 border-red-500/30";

    return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-5">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          <p className="text-zinc-400 font-semibold">Battle loading...</p>
        </div>
      </main>
    );
  }

  if (!battle) {
    return (
      <main className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-5">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-300 font-bold">Battle not found</p>
        </div>
      </main>
    );
  }

  const userIsPlayer = isCreator() || isJoiner();
  const battleClosed =
    battle.status === "completed" || battle.status === "cancelled";

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="mb-5 rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
                DeshiLudo Battle
              </p>
              <h1 className="mt-2 text-3xl font-black">Battle #{battleId}</h1>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusClass(
                battle.status
              )}`}
            >
              {battle.status}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-black/50 p-4">
              <p className="text-xs text-zinc-500">Entry Amount</p>
              <p className="mt-1 text-2xl font-black text-green-400">
                ₹{battle.amount}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black/50 p-4">
              <p className="text-xs text-zinc-500">Winning</p>
              <p className="mt-1 text-2xl font-black text-yellow-400">
                ₹{Number(battle.amount || 0) * 2}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500">You are</p>
                <p className="font-bold">
                  {isCreator() ? "Creator" : isJoiner() ? "Joiner" : "Viewer"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Opponent</p>
                <p className="font-bold">
                  {battle.joiner_uid ? "Joined ✅" : "Waiting..."}
                </p>
              </div>
            </div>
          </div>

          {battle.status === "completed" && (
            <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
              <p className="font-bold text-green-300">Winner Selected ✅</p>
              <p className="mt-1 break-all text-xs text-zinc-400">
                {battle.winner_uid}
              </p>
            </div>
          )}

          {battle.status === "cancelled" && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="font-bold text-red-300">
                Battle Cancelled / Refunded ✅
              </p>
            </div>
          )}
        </div>

        <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-yellow-400">
                Ludo Room Code
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Creator room code save karega.
              </p>
            </div>
            <div className="rounded-full bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-300">
              LIVE
            </div>
          </div>

          {isCreator() ? (
            <>
              {!battle.joiner_uid ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                  Waiting for player to join...
                </div>
              ) : battle.room_code ? (
                <div className="rounded-2xl border border-yellow-400/30 bg-black p-5 text-center text-3xl font-black tracking-[0.25em] text-yellow-300">
                  {battle.room_code}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Room code enter karo"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="mb-3 w-full rounded-2xl border border-zinc-800 bg-black p-4 text-white outline-none focus:border-yellow-400"
                  />

                  <button
                    onClick={saveRoomCode}
                    disabled={savingRoom}
                    className="w-full rounded-2xl bg-yellow-400 py-4 font-black text-black disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {savingRoom ? "Saving..." : "Save Room Code"}
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-black p-5 text-center text-3xl font-black tracking-[0.25em] text-yellow-300">
              {battle.room_code || "Waiting..."}
            </div>
          )}

          {battle.room_code && (
            <button
              onClick={copyRoomCode}
              className="mt-3 w-full rounded-2xl border border-yellow-400/40 bg-yellow-400/10 py-4 font-black text-yellow-300"
            >
              Copy Room Code
            </button>
          )}
        </section>

        {battle.room_code && !battleClosed ? (
          <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-xl font-black text-yellow-400">
              Upload Result
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Win / Lose / Cancel select karke screenshot upload karo.
            </p>

            {!userIsPlayer && (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                Aap is battle ke player nahi ho.
              </div>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2">
              {["win", "lose", "cancel"].map((item) => (
                <button
                  key={item}
                  onClick={() => setClaim(item)}
                  className={`rounded-2xl py-4 text-sm font-black uppercase ${
                    claim === item
                      ? item === "win"
                        ? "bg-green-500 text-white"
                        : item === "lose"
                        ? "bg-red-500 text-white"
                        : "bg-yellow-400 text-black"
                      : "border border-zinc-800 bg-black text-zinc-400"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <label className="mt-4 block rounded-2xl border border-dashed border-zinc-700 bg-black p-4 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <p className="font-bold text-zinc-200">
                {file ? file.name : "Tap to select screenshot"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Image proof required
              </p>
            </label>

            <button
              onClick={submitResult}
              disabled={uploading || !userIsPlayer}
              className="mt-4 w-full rounded-2xl bg-green-500 py-4 font-black text-white shadow-lg shadow-green-500/20 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {uploading ? "Uploading..." : "Upload Result"}
            </button>
          </section>
        ) : (
          <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-zinc-400">
              {battleClosed
                ? "Battle closed hai."
                : "Room code save hone ke baad result upload option aayega."}
            </p>
          </section>
        )}

        <button
          onClick={() => router.push("/battle-history")}
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 py-4 font-black text-white"
        >
          Back to Battle History
        </button>
      </div>
    </main>
  );
}