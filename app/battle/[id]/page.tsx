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

  async function updateWallet(uid: string, amount: number) {
    const { error } = await supabase.rpc("add_wallet_balance", {
      user_id_input: uid,
      amount_input: amount,
    });

    if (error) throw error;
  }

  async function autoSettleBattle() {
    const { data: latest, error } = await supabase
      .from("battles")
      .select("*")
      .eq("id", battleId)
      .maybeSingle();

    if (error || !latest) return;

    if (latest.status === "completed" || latest.status === "cancelled") return;

    const creatorClaim = latest.creator_claim;
    const joinerClaim = latest.joiner_claim;

    if (!creatorClaim || !joinerClaim) return;

    const amount = Number(latest.amount || 0);
    const winningAmount = amount * 2;

    let winnerUid = "";
    let loserUid = "";

    if (creatorClaim === "win" && joinerClaim === "lose") {
      winnerUid = latest.creator_uid;
      loserUid = latest.joiner_uid;
    }

    if (creatorClaim === "lose" && joinerClaim === "win") {
      winnerUid = latest.joiner_uid;
      loserUid = latest.creator_uid;
    }

    if (winnerUid && loserUid) {
      const { data: updatedBattle, error: updateError } = await supabase
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

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      if (updatedBattle) {
        await updateWallet(winnerUid, winningAmount);
        toast.success("Auto Winner Done ✅");
      }

      return;
    }

    if (creatorClaim === "cancel" && joinerClaim === "cancel") {
      const { data: updatedBattle, error: cancelError } = await supabase
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

      if (cancelError) {
        toast.error(cancelError.message);
        return;
      }

      if (updatedBattle) {
        await updateWallet(latest.creator_uid, amount);
        await updateWallet(latest.joiner_uid, amount);
        toast.success("Battle Cancelled ✅ Refund Done");
      }
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
      .eq("id", battleId);

    setSavingRoom(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Room code save ho gaya ✅");
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
        .eq("id", battleId);

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      toast.success("Result uploaded successfully ✅");
      await autoSettleBattle();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Result upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white p-5">
        <p>Loading...</p>
      </main>
    );
  }

  if (!battle) {
    return (
      <main className="min-h-screen bg-black text-white p-5">
        <p>Battle not found</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-5">
      <div className="max-w-xl mx-auto bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">
          Battle #{battleId}
        </h1>

        <p className="text-zinc-400 mb-2">Amount: ₹{battle.amount}</p>
        <p className="text-zinc-400 mb-6">Status: {battle.status}</p>

        {battle.status === "completed" && (
          <p className="text-green-400 mb-4">Winner: {battle.winner_uid}</p>
        )}

        {battle.status === "cancelled" && (
          <p className="text-red-400 mb-4">Battle Cancelled / Refunded</p>
        )}

        <div className="bg-zinc-800 rounded-xl p-4 mb-5">
          <h2 className="text-xl font-bold text-yellow-400 mb-2">
            Ludo Room Code
          </h2>

          {isCreator() ? (
            <>
              {!battle.joiner_uid ? (
                <p className="text-red-400">Waiting for player to join...</p>
              ) : battle.room_code ? (
                <div className="bg-black rounded-xl p-4 text-center text-2xl font-bold tracking-widest">
                  {battle.room_code}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Room code enter karo"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="w-full bg-zinc-900 text-white p-4 rounded-xl mb-3 outline-none"
                  />

                  <button
                    onClick={saveRoomCode}
                    disabled={savingRoom}
                    className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl disabled:bg-zinc-700 disabled:text-zinc-400"
                  >
                    {savingRoom ? "Saving..." : "Save Room Code"}
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="bg-black rounded-xl p-4 text-center text-2xl font-bold tracking-widest">
              {battle.room_code || "Waiting..."}
            </div>
          )}

          {battle.room_code && (
            <button
              onClick={copyRoomCode}
              className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl mt-3"
            >
              Copy Room Code
            </button>
          )}
        </div>

        {battle.room_code &&
        battle.status !== "completed" &&
        battle.status !== "cancelled" ? (
          <div className="bg-zinc-800 rounded-xl p-4 mb-5">
            <h2 className="text-xl font-bold text-yellow-400 mb-3">
              Upload Result Screenshot
            </h2>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {["win", "lose", "cancel"].map((item) => (
                <button
                  key={item}
                  onClick={() => setClaim(item)}
                  className={`py-3 rounded-xl font-bold ${
                    claim === item
                      ? item === "win"
                        ? "bg-green-500 text-white"
                        : item === "lose"
                        ? "bg-red-500 text-white"
                        : "bg-yellow-400 text-black"
                      : "bg-zinc-900 text-zinc-300"
                  }`}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full mb-5"
            />

            <button
              onClick={submitResult}
              disabled={uploading}
              className="w-full bg-green-500 text-white font-bold py-4 rounded-xl disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {uploading ? "Uploading..." : "Upload Result"}
            </button>
          </div>
        ) : (
          <div className="bg-zinc-800 rounded-xl p-4 mb-5">
            <p className="text-zinc-400">
              {battle.status === "completed" || battle.status === "cancelled"
                ? "Battle closed hai."
                : "Room code save hone ke baad result upload option aayega."}
            </p>
          </div>
        )}

        <button
          onClick={() => router.push("/battle-history")}
          className="w-full bg-zinc-800 text-white font-bold py-4 rounded-xl"
        >
          Back
        </button>
      </div>
    </main>
  );
}