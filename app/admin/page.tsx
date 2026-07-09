"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function AdminDashboardPage() {
  const router = useRouter();

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
    pendingKyc: 0,
    openSupport: 0,
  });

  useEffect(() => {
    loadStats();

    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battles" },
        () => loadStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deposits" },
        () => loadStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdraws" },
        () => loadStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => loadStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => loadStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadStats() {
    const { data: wallets } = await supabase
      .from("wallets")
      .select("deposit_balance, winning_balance");

    const { data: users } = await supabase
      .from("users")
      .select("id, kyc_status, aadhaar_url, pan_url");

    const { data: battles } = await supabase.from("battles").select("status");

    const { data: deposits } = await supabase
      .from("deposits")
      .select("amount,status");

    const { data: withdraws } = await supabase
      .from("withdraws")
      .select("amount,status");

    const { data: supportTickets } = await supabase
      .from("support_tickets")
      .select("status");

    setStats({
      totalUsers: users?.length || 0,

      totalWallet:
        wallets?.reduce(
          (sum: number, w: any) =>
            sum +
            Number(w.deposit_balance || 0) +
            Number(w.winning_balance || 0),
          0
        ) || 0,

      totalBattles: battles?.length || 0,

      openBattles:
        battles?.filter((b: any) => b.status === "open").length || 0,

      completedBattles:
        battles?.filter((b: any) => b.status === "completed").length || 0,

      totalDeposits:
        deposits
          ?.filter((d: any) => d.status === "approved")
          .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0) || 0,

      totalWithdraws:
        withdraws
          ?.filter((w: any) => w.status === "approved")
          .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0) || 0,

      pendingDeposits:
        deposits?.filter((d: any) => d.status === "pending").length || 0,

      pendingWithdraws:
        withdraws?.filter((w: any) => w.status === "pending").length || 0,

      pendingKyc:
        users?.filter(
          (u: any) =>
            u.kyc_status === "pending" && (u.aadhaar_url || u.pan_url)
        ).length || 0,

      openSupport:
        supportTickets?.filter((t: any) => t.status === "open").length || 0,
    });
  }

  async function logout() {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });

    router.replace("/admin-login");
    router.refresh();
  }

  const mainActions = [
    {
      title: "Manage Battles",
      desc: "Running, open aur completed battles",
      href: "/admin/battles",
      color: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    },
    {
      title: "Manage Deposits",
      desc: `${stats.pendingDeposits} pending requests`,
      href: "/admin/deposits",
      color: "border-green-500/30 bg-green-500/10 text-green-300",
    },
    {
      title: "Manage Withdraws",
      desc: `${stats.pendingWithdraws} pending requests`,
      href: "/admin/withdraws",
      color: "border-red-500/30 bg-red-500/10 text-red-300",
    },
    {
      title: "KYC Requests",
      desc: `${stats.pendingKyc} pending KYC`,
      href: "/admin/kyc",
      color: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    },
    {
      title: "Help & Support",
      desc: `${stats.openSupport} open tickets`,
      href: "/admin/support",
      color: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    },
  ];

  const cards = [
    ["👥", "Total Users", stats.totalUsers, "text-blue-300"],
    ["💰", "Wallet Balance", `₹${stats.totalWallet}`, "text-green-300"],
    ["🎮", "Total Battles", stats.totalBattles, "text-yellow-300"],
    ["🟢", "Open Battles", stats.openBattles, "text-blue-300"],
    ["✅", "Completed", stats.completedBattles, "text-green-300"],
    ["💳", "Deposits", `₹${stats.totalDeposits}`, "text-green-300"],
    ["🏧", "Withdraws", `₹${stats.totalWithdraws}`, "text-red-300"],
    ["⏳", "Pending Deposits", stats.pendingDeposits, "text-yellow-300"],
    ["⚠️", "Pending Withdraws", stats.pendingWithdraws, "text-red-300"],
    ["🪪", "Pending KYC", stats.pendingKyc, "text-purple-300"],
    ["🎧", "Open Support", stats.openSupport, "text-yellow-300"],
  ];

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <section className="mb-6 rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
                DeshiLudo Admin
              </p>

              <h1 className="mt-2 text-3xl font-black text-white">
                Control Panel
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                Live stats, payments, KYC, support aur battles management.
              </p>
            </div>

            <button
              onClick={logout}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-300 active:scale-95"
            >
              Logout
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-xs text-green-300">Approved Deposits</p>
              <p className="mt-1 text-2xl font-black text-green-400">
                ₹{stats.totalDeposits}
              </p>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-xs text-red-300">Approved Withdraws</p>
              <p className="mt-1 text-2xl font-black text-red-400">
                ₹{stats.totalWithdraws}
              </p>
            </div>

            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
              <p className="text-xs text-yellow-300">Open Support</p>
              <p className="mt-1 text-2xl font-black text-yellow-400">
                {stats.openSupport}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
          {mainActions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-[24px] border p-5 shadow-xl shadow-black/30 ${item.color}`}
            >
              <p className="text-xl font-black">{item.title}</p>
              <p className="mt-2 text-sm opacity-80">{item.desc}</p>
              <p className="mt-4 text-sm font-black">Open →</p>
            </Link>
          ))}
        </section>

        {(stats.pendingDeposits > 0 ||
          stats.pendingWithdraws > 0 ||
          stats.pendingKyc > 0 ||
          stats.openSupport > 0) && (
          <section className="mb-6 rounded-[24px] border border-yellow-400/30 bg-yellow-400/10 p-4">
            <p className="font-black text-yellow-300">Pending Alert ⚠️</p>
            <p className="mt-1 text-sm text-zinc-300">
              {stats.pendingDeposits} deposit, {stats.pendingWithdraws} withdraw,
              {stats.pendingKyc} KYC aur {stats.openSupport} support ticket open hai.
            </p>
          </section>
        )}

        <section>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
              Realtime
            </p>
            <h2 className="mt-1 text-2xl font-black">Live Stats</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {cards.map((card, index) => (
              <div
                key={index}
                className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-5 shadow-xl shadow-black/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-2xl">{card[0]}</p>
                  <span className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs font-bold text-zinc-500">
                    Live
                  </span>
                </div>

                <p className="mt-4 text-sm font-bold text-zinc-500">
                  {card[1]}
                </p>

                <h2 className={`mt-2 text-3xl font-black ${card[3]}`}>
                  {card[2]}
                </h2>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}