"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalWallet: 0,
    totalBattles: 0,
    openBattles: 0,
    completedBattles: 0,
    totalDeposits: 0,
    totalWithdraws: 0,
    pendingDeposits: 0,
    pendingWithdraws: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("deshiludo_admin");
    if (saved === "yes") {
      setIsAdmin(true);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    loadStats();

    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "battles" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdraws" }, loadStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  function loginAdmin() {
    if (password !== ADMIN_PASSWORD) {
      toast.error("Wrong admin password");
      return;
    }

    localStorage.setItem("deshiludo_admin", "yes");
    setIsAdmin(true);
    toast.success("Admin login successful");
  }

  function logoutAdmin() {
    localStorage.removeItem("deshiludo_admin");
    setIsAdmin(false);
    setPassword("");
  }

  async function loadStats() {
    const { data: wallets, error: walletError } = await supabase
      .from("wallets")
      .select("balance");

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id");

    const { data: battles, error: battlesError } = await supabase
      .from("battles")
      .select("status");

    const { data: deposits, error: depositsError } = await supabase
      .from("deposits")
      .select("amount,status");

    const { data: withdraws, error: withdrawsError } = await supabase
      .from("withdraws")
      .select("amount,status");

    if (
      walletError ||
      usersError ||
      battlesError ||
      depositsError ||
      withdrawsError
    ) {
      toast.error("Stats load failed");
      return;
    }

    const totalWallet =
      wallets?.reduce((sum, w: any) => sum + Number(w.balance || 0), 0) || 0;

    const totalDeposits =
      deposits
        ?.filter((d: any) => d.status === "approved")
        .reduce((sum, d: any) => sum + Number(d.amount || 0), 0) || 0;

    const totalWithdraws =
      withdraws
        ?.filter((w: any) => w.status === "approved")
        .reduce((sum, w: any) => sum + Number(w.amount || 0), 0) || 0;

    setStats({
      totalUsers: users?.length || 0,
      totalWallet,
      totalBattles: battles?.length || 0,
      openBattles: battles?.filter((b: any) => b.status === "open").length || 0,
      completedBattles:
        battles?.filter((b: any) => b.status === "completed").length || 0,
      totalDeposits,
      totalWithdraws,
      pendingDeposits:
        deposits?.filter((d: any) => d.status === "pending").length || 0,
      pendingWithdraws:
        withdraws?.filter((w: any) => w.status === "pending").length || 0,
    });
  }

  const cards = [
    ["👥 Total Users", stats.totalUsers],
    ["💰 Total Wallet Balance", `₹${stats.totalWallet}`],
    ["🎮 Total Battles", stats.totalBattles],
    ["🟢 Open Battles", stats.openBattles],
    ["✅ Completed Battles", stats.completedBattles],
    ["💳 Approved Deposits", `₹${stats.totalDeposits}`],
    ["🏧 Approved Withdraws", `₹${stats.totalWithdraws}`],
    ["⏳ Pending Deposits", stats.pendingDeposits],
    ["⏳ Pending Withdraws", stats.pendingWithdraws],
  ];

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-5">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">
            Admin Login
          </h1>
          <p className="text-zinc-400 mb-5">
            Admin dashboard खोलने के लिए password डालो.
          </p>

          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loginAdmin();
            }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 outline-none mb-4"
          />

          <button
            onClick={loginAdmin}
            className="w-full bg-yellow-400 text-black py-3 rounded-xl font-bold active:scale-95 transition"
          >
            Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 sm:p-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400">
              Admin Dashboard
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              DeshiLudo ka full control panel.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadStats}
              className="bg-yellow-400 text-black px-5 py-2 rounded-xl font-bold active:scale-95 transition"
            >
              Refresh
            </button>

            <button
              onClick={logoutAdmin}
              className="bg-red-500 text-white px-5 py-2 rounded-xl font-bold active:scale-95 transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Link href="/admin/battles" className="bg-blue-500 hover:bg-blue-600 text-white rounded-2xl p-5 font-bold text-center active:scale-95 transition">
            Manage Battles
          </Link>

          <Link href="/admin/deposits" className="bg-green-500 hover:bg-green-600 text-white rounded-2xl p-5 font-bold text-center active:scale-95 transition">
            Manage Deposits
          </Link>

          <Link href="/admin/withdraws" className="bg-red-500 hover:bg-red-600 text-white rounded-2xl p-5 font-bold text-center active:scale-95 transition">
            Manage Withdraws
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {cards.map((card, index) => (
            <div key={index} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <p className="text-zinc-400 text-sm">{card[0]}</p>
              <h2 className="text-3xl font-bold mt-2">{card[1]}</h2>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}