"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";

const ADMIN_PASSWORD = "772527";

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
      toast.error("Wrong password");
      return;
    }
    setIsAdmin(true);
    toast.success("Admin login successful");
  }

  async function loadStats() {
    const { data: wallets } = await supabase.from("wallets").select("balance");
    const { data: users } = await supabase.from("users").select("id");
    const { data: battles } = await supabase.from("battles").select("status");
    const { data: deposits } = await supabase.from("deposits").select("amount,status");
    const { data: withdraws } = await supabase.from("withdraws").select("amount,status");

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
      completedBattles: battles?.filter((b: any) => b.status === "completed").length || 0,
      totalDeposits,
      totalWithdraws,
      pendingDeposits: deposits?.filter((d: any) => d.status === "pending").length || 0,
      pendingWithdraws: withdraws?.filter((w: any) => w.status === "pending").length || 0,
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
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">Admin Login</h1>
          <p className="text-zinc-400 mb-5">Password डालो.</p>

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
            className="w-full bg-yellow-400 text-black py-3 rounded-xl font-bold"
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
        <div className="flex justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400">Admin Dashboard</h1>
            <p className="text-zinc-400 text-sm mt-1">DeshiLudo ka full control panel.</p>
          </div>

          <button
            onClick={() => setIsAdmin(false)}
            className="bg-red-500 text-white px-5 py-2 rounded-xl font-bold"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Link href="/admin/battles" className="bg-blue-500 text-white rounded-2xl p-5 font-bold text-center">
            Manage Battles
          </Link>

          <Link href="/admin/deposits" className="bg-green-500 text-white rounded-2xl p-5 font-bold text-center">
            Manage Deposits
          </Link>

          <Link href="/admin/withdraws" className="bg-red-500 text-white rounded-2xl p-5 font-bold text-center">
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