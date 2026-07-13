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

    todayCommission: 0,
    monthCommission: 0,
    totalCommission: 0,

    todayFirstDepositBonus: 0,
    monthFirstDepositBonus: 0,
    totalFirstDepositBonus: 0,

    todayReferralBonus: 0,
    monthReferralBonus: 0,
    totalReferralBonus: 0,

    todayProfit: 0,
    monthProfit: 0,
    totalProfit: 0,
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_transactions" },
        () => loadStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function getIndiaDateParts(value?: string | null) {
    const date = value ? new Date(value) : new Date();

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const getPart = (type: string) =>
      parts.find((part) => part.type === type)?.value || "";

    return {
      year: getPart("year"),
      month: getPart("month"),
      day: getPart("day"),
    };
  }

  function isSameIndiaDay(value?: string | null) {
    if (!value) return false;

    const current = getIndiaDateParts();
    const item = getIndiaDateParts(value);

    return (
      current.year === item.year &&
      current.month === item.month &&
      current.day === item.day
    );
  }

  function isSameIndiaMonth(value?: string | null) {
    if (!value) return false;

    const current = getIndiaDateParts();
    const item = getIndiaDateParts(value);

    return (
      current.year === item.year &&
      current.month === item.month
    );
  }

  function transactionText(transaction: any) {
    return [
      transaction?.type,
      transaction?.title,
      transaction?.description,
      transaction?.unique_key,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function isFirstDepositBonus(transaction: any) {
    const text = transactionText(transaction);

    return (
      text.includes("first deposit bonus") ||
      text.includes("first_deposit_bonus") ||
      text.includes("first-deposit-bonus")
    );
  }

  function isReferralBonus(transaction: any) {
    const text = transactionText(transaction);

    return (
      text.includes("referral bonus") ||
      text.includes("referral_bonus") ||
      text.includes("referral-bonus")
    );
  }

  function sumAmounts(rows: any[]) {
    return rows.reduce(
      (sum: number, row: any) =>
        sum + Math.abs(Number(row?.amount || 0)),
      0
    );
  }

  async function loadStats() {
    const [
      walletsResult,
      usersResult,
      battlesResult,
      depositsResult,
      withdrawsResult,
      supportResult,
      transactionsResult,
    ] = await Promise.all([
      supabase
        .from("wallets")
        .select("balance,deposit_balance,winning_balance"),

      supabase
        .from("users")
        .select("id,kyc_status,aadhaar_url,pan_url"),

      supabase
        .from("battles")
        .select("status,amount,admin_commission,created_at"),

      supabase
        .from("deposits")
        .select("amount,status"),

      supabase
        .from("withdraws")
        .select("amount,status"),

      supabase
        .from("support_tickets")
        .select("status"),

      supabase
        .from("wallet_transactions")
        .select(
          "type,title,description,amount,status,created_at,unique_key"
        ),
    ]);

    if (walletsResult.error) {
      console.error("Wallet stats error:", walletsResult.error);
    }

    if (usersResult.error) {
      console.error("Users stats error:", usersResult.error);
    }

    if (battlesResult.error) {
      console.error("Battles stats error:", battlesResult.error);
    }

    if (depositsResult.error) {
      console.error("Deposits stats error:", depositsResult.error);
    }

    if (withdrawsResult.error) {
      console.error("Withdraws stats error:", withdrawsResult.error);
    }

    if (supportResult.error) {
      console.error("Support stats error:", supportResult.error);
    }

    if (transactionsResult.error) {
      console.error(
        "Wallet transaction stats error:",
        transactionsResult.error
      );
    }

    const wallets = walletsResult.data || [];
    const users = usersResult.data || [];
    const battles = battlesResult.data || [];
    const deposits = depositsResult.data || [];
    const withdraws = withdrawsResult.data || [];
    const supportTickets = supportResult.data || [];
    const walletTransactions = transactionsResult.data || [];

    const completedBattles = battles.filter(
      (battle: any) => battle.status === "completed"
    );

    const commissionForBattle = (battle: any) => {
      if (battle.status !== "completed") return 0;

      const savedCommission = Number(
        battle.admin_commission || 0
      );

      if (savedCommission > 0) {
        return savedCommission;
      }

      const totalPot = Number(battle.amount || 0) * 2;
      return Math.round(totalPot * 10) / 100;
    };

    const totalCommission = completedBattles.reduce(
      (sum: number, battle: any) =>
        sum + commissionForBattle(battle),
      0
    );

    const todayCommission = completedBattles
      .filter((battle: any) =>
        isSameIndiaDay(battle.created_at)
      )
      .reduce(
        (sum: number, battle: any) =>
          sum + commissionForBattle(battle),
        0
      );

    const monthCommission = completedBattles
      .filter((battle: any) =>
        isSameIndiaMonth(battle.created_at)
      )
      .reduce(
        (sum: number, battle: any) =>
          sum + commissionForBattle(battle),
        0
      );

    const successfulTransactions = walletTransactions.filter(
      (transaction: any) =>
        !transaction.status ||
        transaction.status === "approved" ||
        transaction.status === "completed" ||
        transaction.status === "success"
    );

    const firstDepositBonusTransactions =
      successfulTransactions.filter(isFirstDepositBonus);

    const referralBonusTransactions =
      successfulTransactions.filter(isReferralBonus);

    const totalFirstDepositBonus = sumAmounts(
      firstDepositBonusTransactions
    );

    const todayFirstDepositBonus = sumAmounts(
      firstDepositBonusTransactions.filter((transaction: any) =>
        isSameIndiaDay(transaction.created_at)
      )
    );

    const monthFirstDepositBonus = sumAmounts(
      firstDepositBonusTransactions.filter((transaction: any) =>
        isSameIndiaMonth(transaction.created_at)
      )
    );

    const totalReferralBonus = sumAmounts(
      referralBonusTransactions
    );

    const todayReferralBonus = sumAmounts(
      referralBonusTransactions.filter((transaction: any) =>
        isSameIndiaDay(transaction.created_at)
      )
    );

    const monthReferralBonus = sumAmounts(
      referralBonusTransactions.filter((transaction: any) =>
        isSameIndiaMonth(transaction.created_at)
      )
    );

    const todayProfit =
      todayCommission -
      todayFirstDepositBonus -
      todayReferralBonus;

    const monthProfit =
      monthCommission -
      monthFirstDepositBonus -
      monthReferralBonus;

    const totalProfit =
      totalCommission -
      totalFirstDepositBonus -
      totalReferralBonus;

    setStats({
      totalUsers: users.length,

      totalWallet: wallets.reduce(
        (sum: number, wallet: any) => {
          const singleBalance = Number(wallet.balance || 0);

          if (singleBalance > 0) {
            return sum + singleBalance;
          }

          return (
            sum +
            Number(wallet.deposit_balance || 0) +
            Number(wallet.winning_balance || 0)
          );
        },
        0
      ),

      totalBattles: battles.length,

      openBattles: battles.filter(
        (battle: any) => battle.status === "open"
      ).length,

      completedBattles: completedBattles.length,

      totalDeposits: deposits
        .filter((deposit: any) => deposit.status === "approved")
        .reduce(
          (sum: number, deposit: any) =>
            sum + Number(deposit.amount || 0),
          0
        ),

      totalWithdraws: withdraws
        .filter((withdraw: any) => withdraw.status === "approved")
        .reduce(
          (sum: number, withdraw: any) =>
            sum + Number(withdraw.amount || 0),
          0
        ),

      pendingDeposits: deposits.filter(
        (deposit: any) => deposit.status === "pending"
      ).length,

      pendingWithdraws: withdraws.filter(
        (withdraw: any) => withdraw.status === "pending"
      ).length,

      pendingKyc: users.filter(
        (user: any) =>
          user.kyc_status === "pending" &&
          (user.aadhaar_url || user.pan_url)
      ).length,

      openSupport: supportTickets.filter(
        (ticket: any) => ticket.status === "open"
      ).length,

      todayCommission,
      monthCommission,
      totalCommission,

      todayFirstDepositBonus,
      monthFirstDepositBonus,
      totalFirstDepositBonus,

      todayReferralBonus,
      monthReferralBonus,
      totalReferralBonus,

      todayProfit,
      monthProfit,
      totalProfit,
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
      title: "Manage Users",
      desc: `${stats.totalUsers} registered users`,
      href: "/admin/users",
      color: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    },
    {
      title: "Announcement",
      desc: "Dashboard message edit aur ON/OFF karein",
      href: "/admin/announcement",
      color: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    },
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

  const money = (value: number) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;

  const profitCards = [
    {
      icon: "💰",
      title: "Today Net Profit",
      value: money(stats.todayProfit),
      note: `Commission ${money(
        stats.todayCommission
      )} − Bonus ${money(
        stats.todayFirstDepositBonus +
          stats.todayReferralBonus
      )}`,
      color:
        stats.todayProfit >= 0
          ? "border-green-500/30 bg-green-500/10 text-green-300"
          : "border-red-500/30 bg-red-500/10 text-red-300",
    },
    {
      icon: "📅",
      title: "This Month Profit",
      value: money(stats.monthProfit),
      note: `Commission ${money(
        stats.monthCommission
      )} − Bonus ${money(
        stats.monthFirstDepositBonus +
          stats.monthReferralBonus
      )}`,
      color:
        stats.monthProfit >= 0
          ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
          : "border-red-500/30 bg-red-500/10 text-red-300",
    },
    {
      icon: "🏆",
      title: "Total Net Profit",
      value: money(stats.totalProfit),
      note: `Commission ${money(
        stats.totalCommission
      )} − Bonus ${money(
        stats.totalFirstDepositBonus +
          stats.totalReferralBonus
      )}`,
      color:
        stats.totalProfit >= 0
          ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
          : "border-red-500/30 bg-red-500/10 text-red-300",
    },
    {
      icon: "🎮",
      title: "Battle Commission",
      value: money(stats.totalCommission),
      note: "Sirf completed battles ka total",
      color:
        "border-purple-500/30 bg-purple-500/10 text-purple-300",
    },
    {
      icon: "🎁",
      title: "First Deposit Bonus",
      value: money(stats.totalFirstDepositBonus),
      note: "Users ko diya gaya total bonus",
      color:
        "border-orange-500/30 bg-orange-500/10 text-orange-300",
    },
    {
      icon: "👥",
      title: "Referral Bonus",
      value: money(stats.totalReferralBonus),
      note: "Referrers ko diya gaya total bonus",
      color:
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    },
  ];

  const cards = [
    ["👥", "Total Users", stats.totalUsers, "text-blue-300"],
    ["💰", "Wallet Balance", money(stats.totalWallet), "text-green-300"],
    ["🎮", "Total Battles", stats.totalBattles, "text-yellow-300"],
    ["🟢", "Open Battles", stats.openBattles, "text-blue-300"],
    ["✅", "Completed", stats.completedBattles, "text-green-300"],
    ["💳", "Deposits", money(stats.totalDeposits), "text-green-300"],
    ["🏧", "Withdraws", money(stats.totalWithdraws), "text-red-300"],
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
                Live stats, users, announcement, payments, KYC, support aur
                battles management.
              </p>
            </div>

            <button
              type="button"
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
                {money(stats.totalDeposits)}
              </p>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-xs text-red-300">Approved Withdraws</p>

              <p className="mt-1 text-2xl font-black text-red-400">
                {money(stats.totalWithdraws)}
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

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {mainActions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-[24px] border p-5 shadow-xl shadow-black/30 transition active:scale-[0.98] ${item.color}`}
            >
              <p className="text-xl font-black">{item.title}</p>

              <p className="mt-2 text-sm opacity-80">{item.desc}</p>

              <p className="mt-4 text-sm font-black">Open →</p>
            </Link>
          ))}
        </section>

        <section className="mb-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
              Earnings
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Profit Analytics
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              Net Profit = Completed Battle Commission − First Deposit Bonus − Referral Bonus
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profitCards.map((item) => (
              <div
                key={item.title}
                className={`rounded-[24px] border p-4 shadow-xl shadow-black/30 ${item.color}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-2xl">{item.icon}</span>

                  <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-black uppercase">
                    Live
                  </span>
                </div>

                <p className="mt-4 text-xs font-bold opacity-80">
                  {item.title}
                </p>

                <p className="mt-1 text-3xl font-black">
                  {item.value}
                </p>

                <p className="mt-2 text-[10px] leading-4 opacity-70">
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        {(stats.pendingDeposits > 0 ||
          stats.pendingWithdraws > 0 ||
          stats.pendingKyc > 0 ||
          stats.openSupport > 0) && (
          <section className="mb-6 rounded-[24px] border border-yellow-400/30 bg-yellow-400/10 p-4">
            <p className="font-black text-yellow-300">Pending Alert ⚠️</p>

            <p className="mt-1 text-sm text-zinc-300">
              {stats.pendingDeposits} deposit, {stats.pendingWithdraws} withdraw,
              {stats.pendingKyc} KYC aur {stats.openSupport} support ticket open
              hai.
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