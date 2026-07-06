"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function DashboardPage() {
  const router = useRouter();

  const [wallet, setWallet] = useState(0);
  const [totalBattles, setTotalBattles] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let walletChannel: any = null;
    let battlesChannel: any = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setPhone(user.phoneNumber || "User");
      loadDashboard(user.uid);

      walletChannel = supabase
        .channel(`wallet-live-${user.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallets",
            filter: `uid=eq.${user.uid}`,
          },
          (payload) => {
            const updatedWallet: any = payload.new;
            if (updatedWallet) {
              setWallet(Number(updatedWallet.balance || 0));
            }
          }
        )
        .subscribe();

      battlesChannel = supabase
        .channel(`dashboard-battles-live-${user.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "battles",
          },
          () => {
            loadDashboard(user.uid);
          }
        )
        .subscribe();
    });

    return () => {
      unsubscribe();
      if (walletChannel) supabase.removeChannel(walletChannel);
      if (battlesChannel) supabase.removeChannel(battlesChannel);
    };
  }, [router]);

  async function loadDashboard(uid: string) {
    setLoading(true);

    const { data: walletData } = await supabase
      .from("wallets")
      .select("balance")
      .eq("uid", uid)
      .maybeSingle();

    setWallet(Number(walletData?.balance || 0));

    const { data: battlesData } = await supabase
      .from("battles")
      .select("*")
      .or(`creator_uid.eq.${uid},joiner_uid.eq.${uid}`);

    setTotalBattles(battlesData?.length || 0);

    const wins =
      battlesData?.filter((battle) => battle.winner_uid === uid).length || 0;

    setTotalWins(wins);
    setLoading(false);
  }

  async function logout() {
    await signOut(auth);
    router.push("/login");
  }

  const winRate =
    totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0;

  return (
    <main className="min-h-screen bg-black text-white px-4 py-5">
      <div className="max-w-5xl mx-auto">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-3xl p-5 mb-5 border border-zinc-800 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-400 mb-1">Welcome back</p>
              <h1 className="text-3xl font-extrabold text-yellow-400">
                DeshiLudo
              </h1>
              <p className="text-zinc-300 mt-2 text-sm">Mobile: {phone}</p>
            </div>

            <button
              onClick={logout}
              className="bg-red-500/15 text-red-400 border border-red-500/30 font-bold px-4 py-2 rounded-xl text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="bg-yellow-400 text-black rounded-3xl p-5 mb-5 shadow-xl">
          <p className="font-semibold opacity-80">Wallet Balance</p>
          <h2 className="text-4xl font-extrabold mt-1">
            {loading ? "..." : `₹${wallet}`}
          </h2>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={() => router.push("/deposit")}
              className="bg-black text-white font-bold py-3 rounded-2xl"
            >
              Add Money
            </button>

            <button
              onClick={() => router.push("/withdraw")}
              className="bg-white text-black font-bold py-3 rounded-2xl"
            >
              Withdraw
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 text-center">
            <p className="text-zinc-400 text-xs">Battles</p>
            <h2 className="text-2xl font-extrabold text-yellow-400 mt-1">
              {loading ? "..." : totalBattles}
            </h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 text-center">
            <p className="text-zinc-400 text-xs">Wins</p>
            <h2 className="text-2xl font-extrabold text-green-400 mt-1">
              {loading ? "..." : totalWins}
            </h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 text-center">
            <p className="text-zinc-400 text-xs">Win Rate</p>
            <h2 className="text-2xl font-extrabold text-blue-400 mt-1">
              {loading ? "..." : `${winRate}%`}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => router.push("/create-battle")}
            className="bg-zinc-900 border border-yellow-400/40 text-white p-5 rounded-3xl text-left hover:bg-zinc-800"
          >
            <p className="text-3xl mb-2">🎮</p>
            <h3 className="text-xl font-bold text-yellow-400">Create Battle</h3>
            <p className="text-zinc-400 text-sm mt-1">
              Apna amount set karke battle banao
            </p>
          </button>

          <button
            onClick={() => router.push("/join-battle")}
            className="bg-zinc-900 border border-green-500/40 text-white p-5 rounded-3xl text-left hover:bg-zinc-800"
          >
            <p className="text-3xl mb-2">🤝</p>
            <h3 className="text-xl font-bold text-green-400">Join Battle</h3>
            <p className="text-zinc-400 text-sm mt-1">
              Available battles join karo
            </p>
          </button>

          <button
            onClick={() => router.push("/battle-history")}
            className="bg-zinc-900 border border-zinc-800 text-white p-5 rounded-3xl text-left hover:bg-zinc-800"
          >
            <p className="text-3xl mb-2">📜</p>
            <h3 className="text-xl font-bold">Battle History</h3>
            <p className="text-zinc-400 text-sm mt-1">
              Apni old battles check karo
            </p>
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="bg-zinc-900 border border-zinc-800 text-white p-5 rounded-3xl text-left hover:bg-zinc-800"
          >
            <p className="text-3xl mb-2">👤</p>
            <h3 className="text-xl font-bold">Profile</h3>
            <p className="text-zinc-400 text-sm mt-1">
              Account details dekho
            </p>
          </button>
        </div>
      </div>
    </main>
  );
}