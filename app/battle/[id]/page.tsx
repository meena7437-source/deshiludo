"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { supabase } from "../../../lib/supabase";

type PlayerInfo = {
  username: string;
  name: string;
  phone: string;
};

export default function BattlePage() {
  const router = useRouter();
  const params = useParams();
  const battleId = String(params.id || "");

  const [battle, setBattle] = useState<any>(null);
  const [creatorInfo, setCreatorInfo] = useState<PlayerInfo>({
    username: "",
    name: "",
    phone: "",
  });
  const [joinerInfo, setJoinerInfo] = useState<PlayerInfo>({
    username: "",
    name: "",
    phone: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [claim, setClaim] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingRoom, setSavingRoom] = useState(false);
  const [cancellingJoin, setCancellingJoin] = useState(false);
  const [uploading, setUploading] = useState(false);

  const lastBattleRef = useRef<any>(null);

  useEffect(() => {
    let channel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      await loadBattle(true);

      channel = supabase
        .channel(`battle-live-${battleId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "battles",
            filter: `id=eq.${battleId}`,
          },
          async (payload) => {
            const updatedBattle: any = payload.new;

            if (!updatedBattle) return;

            const oldBattle = lastBattleRef.current;

            if (oldBattle) {
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
            }

            lastBattleRef.current = updatedBattle;
            setBattle(updatedBattle);

            if (updatedBattle.room_code) {
              setRoomCode(updatedBattle.room_code);
            }

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

            await loadPlayerNames(updatedBattle);
          },
        )
        .subscribe();
    });

    return () => {
      unsubscribe();

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [battleId, router]);

  async function loadPlayerNames(battleData: any) {
    const userIds = [battleData?.creator_uid, battleData?.joiner_uid].filter(
      Boolean,
    );

    if (userIds.length === 0) return;

    const { data, error } = await supabase
      .from("users")
      .select("firebase_uid,username,name,phone")
      .in("firebase_uid", userIds);

    if (error) {
      console.error("Player profile load error:", error);
      return;
    }

    const creator = data?.find(
      (item: any) => item.firebase_uid === battleData.creator_uid,
    );

    const joiner = data?.find(
      (item: any) => item.firebase_uid === battleData.joiner_uid,
    );

    setCreatorInfo({
      username: creator?.username || "",
      name: creator?.name || "",
      phone: creator?.phone || battleData.creator_phone || "",
    });

    setJoinerInfo({
      username: joiner?.username || "",
      name: joiner?.name || "",
      phone: joiner?.phone || battleData.joiner_phone || "",
    });
  }

  async function loadBattle(showLoader = false) {
    const user = auth.currentUser;

    if (!user) return;

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
      router.replace("/battle-history");
      return;
    }

    lastBattleRef.current = data;
    setBattle(data);

    if (data.room_code) {
      setRoomCode(data.room_code);
    }

    if (data.creator_uid === user.uid && data.creator_claim) {
      setClaim(data.creator_claim);
    }

    if (data.joiner_uid === user.uid && data.joiner_claim) {
      setClaim(data.joiner_claim);
    }

    await loadPlayerNames(data);
  }

  function isCreator() {
    return auth.currentUser?.uid === battle?.creator_uid;
  }

  function isJoiner() {
    return auth.currentUser?.uid === battle?.joiner_uid;
  }

  function myResultUploaded() {
    if (!battle) return false;
    if (isCreator()) return Boolean(battle.creator_result_uploaded);
    if (isJoiner()) return Boolean(battle.joiner_result_uploaded);

    return false;
  }

  function getWinningAmount() {
    const amount = Number(battle?.amount || 0);
    const totalPot = amount * 2;
    const commission = Math.floor(amount * 0.1);

    return totalPot - commission;
  }

  function getCommission() {
    return Math.floor(Number(battle?.amount || 0) * 0.1);
  }

  function maskPhone(value?: string | null) {
    const digits = String(value || "").replace(/\D/g, "");
    const last4 = digits.slice(-4);

    return last4 ? `XXXXXX${last4}` : "";
  }

  function playerLabel(info: PlayerInfo, fallback: string) {
    if (info.username.trim()) {
      return `@${info.username.trim()}`;
    }

    if (info.name.trim()) {
      return info.name.trim();
    }

    return maskPhone(info.phone) || fallback;
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
      toast.success("Result submitted ✅ Opponent ke result ka wait hai");
      await loadBattle(false);
      return;
    }

    if (data === "dispute") {
      toast.success("Result submitted ✅ Admin review required");
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
      router.replace("/battle-history");
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
      .update({
        room_code: roomCode.trim(),
        status: "running",
      })
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

  async function cancelJoinBeforeRoom() {
    const user = auth.currentUser;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!battle || !isJoiner()) {
      toast.error("Sirf joiner cancel kar sakta hai");
      return;
    }

    if (battle.room_code) {
      toast.error("Room code aane ke baad join cancel nahi hoga");
      return;
    }

    setCancellingJoin(true);

    try {
      const { data, error } = await supabase.rpc(
        "cancel_join_before_room_safe",
        {
          battle_id_input: Number(battleId),
          joiner_uid_input: user.uid,
        },
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data === "join_cancelled_refunded") {
        toast.success("Join cancel ho gaya, refund done ✅");
        router.replace("/dashboard");
        return;
      }

      if (data === "room_code_already_added") {
        toast.error("Room code add ho chuka hai, ab cancel nahi hoga");
      } else if (data === "unauthorized") {
        toast.error("Aap is battle ke joiner nahi ho");
      } else if (data === "battle_not_found") {
        toast.error("Battle nahi mili");
      } else {
        toast.error(String(data || "Join cancel nahi hua"));
      }

      await loadBattle(false);
    } catch (error: any) {
      toast.error(error?.message || "Join cancel failed");
    } finally {
      setCancellingJoin(false);
    }
  }

  async function copyRoomCode() {
    if (!battle?.room_code) {
      toast.error("Room code abhi available nahi hai");
      return;
    }

    try {
      await navigator.clipboard.writeText(battle.room_code);
      toast.success("Room code copied ✅");
    } catch {
      toast.error("Room code copy nahi hua");
    }
  }

  async function submitResult() {
    const user = auth.currentUser;

    if (!user) {
      router.replace("/login");
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

    if (!battle.room_code) {
      toast.error("Room code save hone ke baad result submit hoga");
      return;
    }

    if (!isCreator() && !isJoiner()) {
      toast.error("Aap is battle ke player nahi ho");
      return;
    }

    if (myResultUploaded()) {
      toast.error("Aap result already submit kar chuke ho");
      return;
    }

    if (!claim) {
      toast.error("Win / Lose / Cancel me se ek select karo");
      return;
    }

    if (claim === "win" && !file) {
      toast.error("Win claim ke liye screenshot zaroori hai");
      return;
    }

    setUploading(true);

    try {
      let imageUrl = "";

      if (claim === "win" && file) {
        const safeFileName = file.name.replaceAll(" ", "-");
        const filePath = `battle-${battleId}/${user.uid}-${Date.now()}-${safeFileName}`;

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

        imageUrl = urlData.publicUrl;
      }

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
    } catch (error: any) {
      console.error("Result submit error:", error);
      toast.error(error?.message || "Result submit failed");
    } finally {
      setUploading(false);
    }
  }

  function statusClass(status: string) {
    if (status === "open")
      return "border-blue-500/30 bg-blue-500/15 text-blue-300";
    if (status === "matched")
      return "border-purple-500/30 bg-purple-500/15 text-purple-300";
    if (status === "running")
      return "border-yellow-500/30 bg-yellow-500/15 text-yellow-300";
    if (status === "completed")
      return "border-green-500/30 bg-green-500/15 text-green-300";
    if (status === "cancelled")
      return "border-red-500/30 bg-red-500/15 text-red-300";

    return "border-zinc-500/30 bg-zinc-500/15 text-zinc-300";
  }

  function claimBadge(value: string | null) {
    if (!value) return "Not submitted";
    if (value === "win") return "Win Claim";
    if (value === "lose") return "Lose Claim";
    if (value === "cancel") return "Cancel Claim";

    return value;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07070b] p-4 text-white">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          <p className="text-sm font-semibold text-zinc-400">
            Battle loading...
          </p>
        </div>
      </main>
    );
  }

  if (!battle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07070b] p-4 text-white">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center">
          <p className="font-bold text-red-300">Battle not found</p>
        </div>
      </main>
    );
  }

  const userIsPlayer = isCreator() || isJoiner();
  const battleClosed =
    battle.status === "completed" || battle.status === "cancelled";

  const adminReview =
    battle.creator_result_uploaded &&
    battle.joiner_result_uploaded &&
    battle.status !== "completed" &&
    battle.status !== "cancelled";

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto w-full max-w-md px-3 py-3">
        <section className="mb-3 rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-3.5 shadow-xl shadow-black/40">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                DeshiLudo Battle
              </p>
              <h1 className="mt-1 text-2xl font-black leading-tight">
                Battle #{battleId}
              </h1>
            </div>

            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(
                battle.status,
              )}`}
            >
              {battle.status}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="rounded-xl border border-zinc-800 bg-black/50 p-2.5">
              <p className="text-[9px] text-zinc-500">Entry</p>
              <p className="mt-0.5 text-base font-black text-green-400">
                ₹{battle.amount}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/50 p-2.5">
              <p className="text-[9px] text-zinc-500">Winning</p>
              <p className="mt-0.5 text-base font-black text-yellow-400">
                ₹{getWinningAmount()}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/50 p-2.5">
              <p className="text-[9px] text-zinc-500">Fee</p>
              <p className="mt-0.5 text-base font-black text-red-400">
                ₹{getCommission()}
              </p>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
              <p className="text-[9px] text-zinc-500">Creator</p>
              <p className="mt-0.5 truncate text-sm font-bold text-white">
                {playerLabel(creatorInfo, "Player 1")}
              </p>
              <p className="mt-1 text-[10px] text-zinc-400">
                {battle.creator_result_uploaded
                  ? claimBadge(battle.creator_claim)
                  : "Waiting result"}
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
              <p className="text-[9px] text-zinc-500">Joiner</p>
              <p className="mt-0.5 truncate text-sm font-bold text-white">
                {battle.joiner_uid
                  ? playerLabel(joinerInfo, "Player 2")
                  : "Waiting..."}
              </p>
              <p className="mt-1 text-[10px] text-zinc-400">
                {battle.joiner_result_uploaded
                  ? claimBadge(battle.joiner_claim)
                  : battle.joiner_uid
                    ? "Waiting result"
                    : "Not joined"}
              </p>
            </div>
          </div>

          <div className="mt-2.5 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[9px] text-zinc-500">You are</p>
                <p className="text-sm font-bold">
                  {isCreator() ? "Creator" : isJoiner() ? "Joiner" : "Viewer"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[9px] text-zinc-500">Opponent</p>
                <p className="text-sm font-bold">
                  {battle.joiner_uid ? "Joined ✅" : "Waiting..."}
                </p>
              </div>
            </div>
          </div>

          {adminReview && (
            <div className="mt-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
              <p className="text-sm font-bold text-yellow-300">
                Admin Review Required ⚠️
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-400">
                Dono players ne result submit kar diya hai.
              </p>
            </div>
          )}

          {battle.status === "completed" && (
            <div className="mt-2.5 rounded-xl border border-green-500/30 bg-green-500/10 p-3">
              <p className="text-sm font-bold text-green-300">
                Winner Selected ✅
              </p>
              <p className="mt-0.5 truncate text-[10px] text-zinc-400">
                {battle.winner_uid}
              </p>
            </div>
          )}

          {battle.status === "cancelled" && (
            <div className="mt-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm font-bold text-red-300">
                Battle Cancelled / Refunded ✅
              </p>
            </div>
          )}
        </section>

        <section className="mb-3 rounded-2xl border border-yellow-500/25 bg-yellow-400/5 p-3.5">
          <h2 className="text-sm font-black text-yellow-400">
            Creator Game Conditions
          </h2>

          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-300">
            {battle.creator_condition?.trim() ||
              "No special condition. Platform ke default rules follow honge."}
          </p>

          <p className="mt-2 text-[9px] leading-4 text-zinc-500">
            Platform ke official rules hamesha creator ki condition se upar
            rahenge.
          </p>
        </section>

        <section className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-yellow-400">
                Ludo Room Code
              </h2>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                Creator room code save karega.
              </p>
            </div>

            <div className="rounded-full bg-yellow-400/10 px-2.5 py-1 text-[9px] font-bold text-yellow-300">
              LIVE
            </div>
          </div>

          {isCreator() ? (
            <>
              {!battle.joiner_uid ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  Waiting for player to join...
                </div>
              ) : battle.room_code ? (
                <div className="rounded-xl border border-yellow-400/30 bg-black p-3 text-center text-2xl font-black tracking-[0.2em] text-yellow-300">
                  {battle.room_code}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Room code enter karo"
                    value={roomCode}
                    onChange={(event) => setRoomCode(event.target.value)}
                    className="mb-2.5 w-full rounded-xl border border-zinc-800 bg-black p-3 text-sm text-white outline-none focus:border-yellow-400"
                  />

                  <button
                    type="button"
                    onClick={saveRoomCode}
                    disabled={savingRoom}
                    className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-black text-black disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {savingRoom ? "Saving..." : "Save Room Code"}
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-black p-3 text-center text-2xl font-black tracking-[0.2em] text-yellow-300">
              {battle.room_code || "Waiting..."}
            </div>
          )}

          {isJoiner() &&
            battle.joiner_uid &&
            !battle.room_code &&
            !battleClosed && (
              <button
                type="button"
                onClick={cancelJoinBeforeRoom}
                disabled={cancellingJoin}
                className="mt-2.5 w-full rounded-xl border border-red-500/40 bg-red-500/10 py-3 text-sm font-black text-red-300 disabled:opacity-60"
              >
                {cancellingJoin
                  ? "Cancelling Join..."
                  : "Cancel Join & Get Refund"}
              </button>
            )}

          {battle.room_code && (
            <button
              type="button"
              onClick={copyRoomCode}
              className="mt-2.5 w-full rounded-xl border border-yellow-400/40 bg-yellow-400/10 py-3 text-sm font-black text-yellow-300"
            >
              Copy Room Code
            </button>
          )}
        </section>

        {battle.room_code && !battleClosed ? (
          <section className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5">
            <h2 className="text-lg font-black text-yellow-400">
              Submit Result
            </h2>

            <p className="mt-0.5 text-[10px] text-zinc-500">
              Win पर screenshot जरूरी है। Lose/Cancel पर नहीं।
            </p>

            {!userIsPlayer && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                Aap is battle ke player nahi ho.
              </div>
            )}

            {myResultUploaded() ? (
              <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
                Aap result already submit kar chuke ho ✅
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {["win", "lose", "cancel"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setClaim(item);

                        if (item !== "win") {
                          setFile(null);
                        }
                      }}
                      className={`rounded-xl py-3 text-xs font-black uppercase ${
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

                {claim === "win" && (
                  <label className="mt-3 block rounded-xl border border-dashed border-zinc-700 bg-black p-3 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setFile(event.target.files?.[0] || null)
                      }
                      className="hidden"
                    />

                    <p className="truncate text-xs font-bold text-zinc-200">
                      {file ? file.name : "Tap to select screenshot"}
                    </p>
                    <p className="mt-0.5 text-[9px] text-zinc-500">
                      Win claim के लिए screenshot जरूरी है।
                    </p>
                  </label>
                )}

                <button
                  type="button"
                  onClick={submitResult}
                  disabled={uploading || !userIsPlayer}
                  className="mt-3 w-full rounded-xl bg-green-500 py-3 text-sm font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  {uploading ? "Submitting..." : "Submit Result"}
                </button>
              </>
            )}
          </section>
        ) : (
          <section className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-xs text-zinc-400">
              {battleClosed
                ? "Battle closed hai."
                : "Room code save hone ke baad result submit option aayega."}
            </p>
          </section>
        )}

        <button
          type="button"
          onClick={() => router.push("/battle-history")}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-sm font-black text-white"
        >
          Back to Battle History
        </button>
      </div>
    </main>
  );
}
