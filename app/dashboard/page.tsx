"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

const quickAmounts = [50, 100, 200, 500, 1000];

const notices = [
  "🔥 DeshiLudo par fair play karo aur fast payout pao",
  "⚡ Deposit aur Withdraw requests admin approval ke baad update hoti hain",
  "🎮 Room code sirf battle join hone ke baad share karo",
];

export default function DashboardPage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [wallet, setWallet] = useState(0);
  const [amount, setAmount] = useState("");
  const [noticeIndex, setNoticeIndex] = useState(0);

  const [openBattles, setOpenBattles] = useState<any[]>([]);
  const [liveBets, setLiveBets] = useState<any[]>([]);

  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % notices.length);
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let channel: any = null;

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setUid(user.uid);
      setPhone(user.phoneNumber || "User");

      loadWallet(user.uid);
      loadBattles(user.uid);

      channel = supabase
        .channel("premium-dashboard-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "battles" },
          () => loadBattles(user.uid)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wallets" },
          () => loadWallet(user.uid)
        )
        .subscribe();
    });

    return () => {
      unsub();
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  async function loadWallet(userId: string) {
    const { data } = await supabase
      .from("wallets")
      .select("balance")
      .eq("uid", userId)
      .maybeSingle();

    setWallet(Number(data?.balance || 0));
  }

  async function loadBattles(userId: string) {
    const { data: open } = await supabase
      .from("battles")
      .select("*")
      .eq("status", "open")
      .order("id", { ascending: false });

    const { data: live } = await supabase
      .from("battles")
      .select("*")
      .in("status", ["joined", "running", "pending"])
      .order("id", { ascending: false })
      .limit(12);

    setOpenBattles((open || []).filter((b) => b.creator_uid !== userId));
    setLiveBets(live || []);
  }

  async function createBattle() {
    const amt = Number(amount);

    if (!uid) return;
    if (!amt || amt < 50) return toast.error("Minimum ₹50 battle banao");
    if (wallet < amt) return toast.error("Wallet balance kam hai");

    setCreating(true);

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: wallet - amt })
      .eq("uid", uid);

    if (walletError) {
      setCreating(false);
      return toast.error(walletError.message);
    }

    const { error } = await supabase.from("battles").insert({
      creator_uid: uid,
      creator_phone: phone,
      amount: amt,
      status: "open",
    });

    setCreating(false);

    if (error) {
      await loadWallet(uid);
      return toast.error(error.message);
    }

    setAmount("");
    toast.success("Battle created");
    await loadWallet(uid);
    await loadBattles(uid);
  }

  async function joinBattle(battle: any) {
    if (!uid) return;

    const amt = Number(battle.amount);

    if (wallet < amt) return toast.error("Wallet balance kam hai");

    setJoiningId(battle.id);

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: wallet - amt })
      .eq("uid", uid);

    if (walletError) {
      setJoiningId(null);
      return toast.error(walletError.message);
    }

    const { error } = await supabase
      .from("battles")
      .update({
        joiner_uid: uid,
        joiner_phone: phone,
        status: "joined",
      })
      .eq("id", battle.id)
      .eq("status", "open");

    setJoiningId(null);

    if (error) {
      await loadWallet(uid);
      return toast.error(error.message);
    }

    toast.success("Battle joined");
    router.push(`/battle/${battle.id}`);
  }

  function playerName(value: string) {
    if (!value) return "Player";
    const clean = value.replace("+91", "");
    return clean.length > 4 ? `****${clean.slice(-4)}` : clean;
  }

  return (
    <main className="min-h-screen bg-[#050510] text-white pb-28">
      <div className="mx-auto max-w-md px-4 pt-4">

        {/* Header */}
        <div className="relative overflow-hidden rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-4 shadow-[0_0_35px_rgba(234,179,8,0.12)]">
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-yellow-400/10 blur-2xl" />
          <div className="absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-fuchsia-500/10 blur-2xl" />

          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400 text-xl font-black text-black">
                  DL
                </div>
                <div>
                  <h1 className="text-2xl font-black leading-none text-yellow-400">
                    DeshiLudo
                  </h1>
                  <p className="mt-1 text-xs text-zinc-400">{phone}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-green-400/30 bg-green-500/10 px-4 py-2 text-right shadow-[0_0_20px_rgba(34,197,94,0.15)]">
              <p className="text-[10px] font-bold text-green-300">BALANCE</p>
              <p className="text-xl font-black text-green-400">₹{wallet}</p>
            </div>
          </div>
        </div>

        {/* Announcement */}
        <div className="mt-4 rounded-2xl border border-fuchsia-400/20 bg-gradient-to-r from-fuchsia-500/10 via-yellow-500/10 to-green-500/10 p-4">
          <p className="text-xs font-bold text-yellow-300">ANNOUNCEMENT</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {notices[noticeIndex]}
          </p>
        </div>

        {/* Create Battle */}
        <section className="mt-5 rounded-[28px] border border-yellow-400/20 bg-zinc-950/95 p-4 shadow-[0_0_35px_rgba(234,179,8,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Create Battle</h2>
              <p className="text-xs text-zinc-400">Apna amount set karo</p>
            </div>

            <div className="rounded-full bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-300">
              MIN ₹50
            </div>
          </div>

          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            placeholder="₹ Amount"
            className="mt-4 w-full rounded-2xl border border-zinc-700 bg-black px-4 py-4 text-xl font-black text-yellow-400 outline-none placeholder:text-zinc-600 focus:border-yellow-400"
          />

          <div className="mt-3 grid grid-cols-5 gap-2">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(String(amt))}
                className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 py-2 text-xs font-black text-yellow-300 active:scale-95"
              >
                ₹{amt}
              </button>
            ))}
          </div>

          <button
            onClick={createBattle}
            disabled={creating}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-500 py-4 text-base font-black text-black shadow-[0_0_30px_rgba(234,179,8,0.35)] active:scale-[0.98] disabled:opacity-60"
          >
            {creating ? "Creating Battle..." : "Create Now"}
          </button>
        </section>

        {/* Safety */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            ["🛡️", "Safe"],
            ["⚡", "Payout"],
            ["🎯", "Fair"],
            ["☎️", "Support"],
          ].map(([icon, text]) => (
            <div
              key={text}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-center"
            >
              <p className="text-lg">{icon}</p>
              <p className="mt-1 text-[10px] font-bold text-zinc-300">{text}</p>
            </div>
          ))}
        </div>

        {/* Open Battles */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Open Battles</h2>
            <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400">
              LIVE
            </span>
          </div>

          {openBattles.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
              <p className="text-3xl">🎮</p>
              <p className="mt-2 font-bold">No open battle</p>
              <p className="text-xs text-zinc-400">Pehli battle aap create karo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openBattles.map((battle) => (
                <div
                  key={battle.id}
                  className="rounded-[26px] border border-green-400/20 bg-gradient-to-br from-zinc-950 to-black p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400">Battle Amount</p>
                      <p className="text-3xl font-black text-yellow-400">
                        ₹{battle.amount}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-zinc-400">Players</p>
                      <p className="text-lg font-black text-white">1/2</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/5 p-3">
                    <div>
                      <p className="text-xs text-zinc-500">Creator</p>
                      <p className="font-bold text-white">
                        {playerName(battle.creator_phone)}
                      </p>
                    </div>

                    <button
                      onClick={() => joinBattle(battle)}
                      disabled={joiningId === battle.id}
                      className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-black shadow-[0_0_20px_rgba(34,197,94,0.25)] active:scale-95 disabled:opacity-60"
                    >
                      {joiningId === battle.id ? "Joining..." : "Join Now"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Live Bets */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Live Bets</h2>
            <span className="rounded-full bg-fuchsia-500/10 px-3 py-1 text-xs font-bold text-fuchsia-400">
              IN GAME
            </span>
          </div>

          {liveBets.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
              <p className="text-3xl">⚔️</p>
              <p className="mt-2 font-bold">No live bets</p>
              <p className="text-xs text-zinc-400">Joined battles yaha show hongi</p>
            </div>
          ) : (
            <div className="space-y-2">
              {liveBets.map((bet) => (
                <div
                  key={bet.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                >
                  <div>
                    <p className="text-[10px] font-bold text-green-400">● LIVE</p>
                    <p className="text-sm font-black">
                      {playerName(bet.creator_phone)}{" "}
                      <span className="text-zinc-500">VS</span>{" "}
                      {playerName(bet.joiner_phone)}
                    </p>
                  </div>

                  <p className="text-xl font-black text-yellow-400">
                    ₹{bet.amount}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-5 items-center py-2 text-center text-[11px] font-bold text-zinc-400">
          <button className="text-yellow-400">
            <div className="text-lg">🏠</div>
            Home
          </button>

          <button onClick={() => router.push("/battle-history")}>
            <div className="text-lg">⚔️</div>
            History
          </button>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="relative -mt-8"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400 text-2xl text-black shadow-[0_0_30px_rgba(234,179,8,0.45)]">
              +
            </div>
            <p className="mt-1 text-yellow-400">Create</p>
          </button>

          <button onClick={() => router.push("/wallet")}>
            <div className="text-lg">💰</div>
            Wallet
          </button>

          <button onClick={() => router.push("/profile")}>
            <div className="text-lg">👤</div>
            Profile
          </button>
        </div>
      </nav>
    </main>
  );
}