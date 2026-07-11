"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";

type UserRow = {
  id: number;
  firebase_uid: string;
  phone: string | number | null;
  name: string | null;
  username: string | null;
  referral_code: string | null;
  referred_by: string | null;
  kyc_status: string | null;
  total_battles: number | null;
  total_wins: number | null;
  created_at: string | null;
};

type WalletRow = {
  uid: string;
  balance: number | null;
  first_deposit_bonus_given: boolean | null;
  referral_bonus_given: boolean | null;
  referral_code: string | null;
  referred_by: string | null;
  updated_at: string | null;
};

type TransactionRow = {
  id: number;
  uid: string;
  type: string | null;
  title: string | null;
  description: string | null;
  amount: number | null;
  balance_after: number | null;
  status: string | null;
  battle_id: number | null;
  deposit_id: number | null;
  withdraw_id: number | null;
  created_at: string | null;
};

type CombinedUser = UserRow & {
  wallet: WalletRow | null;
};

function formatMoney(value: number | null | undefined) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhone(phone: string | number | null) {
  if (!phone) return "Phone not available";

  const value = String(phone);

  if (value.startsWith("91") && value.length === 12) {
    return `+91 ${value.slice(2)}`;
  }

  if (value.startsWith("+")) {
    return value;
  }

  return value;
}

function isMinusTransaction(type: string | null) {
  const minusTypes = [
    "battle_join",
    "join_battle",
    "battle_create",
    "create_battle",
    "withdraw",
    "withdrawal",
  ];

  return minusTypes.includes(String(type || "").toLowerCase());
}

function getTransactionSign(type: string | null, amount: number | null) {
  if (Number(amount || 0) < 0) return "−";
  return isMinusTransaction(type) ? "−" : "+";
}

function getKycClass(status: string | null) {
  if (status === "approved") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (status === "pending") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  if (status === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-400";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<CombinedUser[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("admin-users-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => loadData(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets" },
        () => loadData(false)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallet_transactions",
        },
        () => loadData(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadData(showLoader = true) {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const [usersResult, walletsResult, transactionsResult] =
        await Promise.all([
          supabase
            .from("users")
            .select(
              "id,firebase_uid,phone,name,username,referral_code,referred_by,kyc_status,total_battles,total_wins,created_at"
            )
            .order("created_at", { ascending: false }),

          supabase
            .from("wallets")
            .select(
              "uid,balance,first_deposit_bonus_given,referral_bonus_given,referral_code,referred_by,updated_at"
            ),

          supabase
            .from("wallet_transactions")
            .select(
              "id,uid,type,title,description,amount,balance_after,status,battle_id,deposit_id,withdraw_id,created_at"
            )
            .order("created_at", { ascending: false }),
        ]);

      if (usersResult.error) {
        throw usersResult.error;
      }

      if (walletsResult.error) {
        throw walletsResult.error;
      }

      if (transactionsResult.error) {
        throw transactionsResult.error;
      }

      const walletMap = new Map<string, WalletRow>();

      (walletsResult.data || []).forEach((wallet: WalletRow) => {
        walletMap.set(wallet.uid, wallet);
      });

      const finalUsers: CombinedUser[] = (usersResult.data || []).map(
        (user: UserRow) => ({
          ...user,
          wallet: walletMap.get(user.firebase_uid) || null,
        })
      );

      setUsers(finalUsers);
      setTransactions(transactionsResult.data || []);
    } catch (error: any) {
      console.error("Admin users load error:", error);
      toast.error(error?.message || "Users load नहीं हो पाए");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return users;

    return users.filter((user) => {
      const searchableText = [
        user.name,
        user.username,
        user.phone,
        user.firebase_uid,
        user.referral_code,
        user.wallet?.referral_code,
        user.referred_by,
        user.wallet?.referred_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [search, users]);

  const selectedUser = useMemo(() => {
    if (!selectedUid) return null;

    return (
      users.find((user) => user.firebase_uid === selectedUid) || null
    );
  }, [selectedUid, users]);

  const selectedTransactions = useMemo(() => {
    if (!selectedUid) return [];

    return transactions.filter(
      (transaction) => transaction.uid === selectedUid
    );
  }, [selectedUid, transactions]);

  const selectedTotals = useMemo(() => {
    return selectedTransactions.reduce(
      (total, transaction) => {
        const amount = Math.abs(Number(transaction.amount || 0));

        if (isMinusTransaction(transaction.type)) {
          total.minus += amount;
        } else {
          total.plus += amount;
        }

        return total;
      },
      { plus: 0, minus: 0 }
    );
  }, [selectedTransactions]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07070b] text-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-8 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-yellow-400" />

            <p className="mt-4 font-bold text-zinc-400">
              Users और wallet details load हो रही हैं...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <section className="mb-5 rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
                DeshiLudo Admin
              </p>

              <h1 className="mt-2 text-3xl font-black">Users Management</h1>

              <p className="mt-1 text-sm text-zinc-500">
                User details, wallet balance और transaction history
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => loadData(false)}
                disabled={refreshing}
                className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-black text-green-300 disabled:opacity-50"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/admin"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300"
              >
                ← Admin
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-xs font-bold text-blue-300">Total Users</p>
              <p className="mt-1 text-2xl font-black text-blue-400">
                {users.length}
              </p>
            </div>

            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-xs font-bold text-green-300">
                Total Wallet Balance
              </p>
              <p className="mt-1 text-2xl font-black text-green-400">
                {formatMoney(
                  users.reduce(
                    (sum, user) =>
                      sum + Number(user.wallet?.balance || 0),
                    0
                  )
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
              <p className="text-xs font-bold text-purple-300">
                Total Transactions
              </p>
              <p className="mt-1 text-2xl font-black text-purple-400">
                {transactions.length}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[24px] border border-zinc-800 bg-zinc-950 p-4">
          <label className="mb-2 block text-sm font-bold text-zinc-400">
            User Search
          </label>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, username, phone, UID या referral code..."
            className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-yellow-400/50"
          />

          <p className="mt-2 text-xs text-zinc-600">
            {filteredUsers.length} user मिले
          </p>
        </section>

        {filteredUsers.length === 0 ? (
          <section className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-8 text-center">
            <p className="text-lg font-black text-zinc-300">
              कोई user नहीं मिला
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredUsers.map((user) => {
              const userTransactions = transactions.filter(
                (transaction) =>
                  transaction.uid === user.firebase_uid
              );

              return (
                <article
                  key={user.firebase_uid}
                  className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-5 shadow-xl shadow-black/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xl font-black text-white">
                        {user.name ||
                          user.username ||
                          formatPhone(user.phone)}
                      </p>

                      {user.username && (
                        <p className="mt-1 text-sm font-bold text-yellow-400">
                          @{user.username}
                        </p>
                      )}

                      <p className="mt-1 text-sm text-zinc-500">
                        {formatPhone(user.phone)}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black uppercase ${getKycClass(
                        user.kyc_status
                      )}`}
                    >
                      KYC {user.kyc_status || "not submitted"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
                    <p className="text-xs font-bold text-green-300">
                      Current Wallet
                    </p>

                    <p className="mt-1 text-3xl font-black text-green-400">
                      {formatMoney(user.wallet?.balance)}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-zinc-800 bg-black p-3">
                      <p className="text-xs text-zinc-500">
                        Total Battles
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {Number(user.total_battles || 0)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black p-3">
                      <p className="text-xs text-zinc-500">
                        Total Wins
                      </p>
                      <p className="mt-1 text-lg font-black text-green-400">
                        {Number(user.total_wins || 0)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black p-3">
                      <p className="text-xs text-zinc-500">
                        Transactions
                      </p>
                      <p className="mt-1 text-lg font-black text-purple-300">
                        {userTransactions.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black p-3">
                      <p className="text-xs text-zinc-500">
                        Joined Date
                      </p>
                      <p className="mt-1 text-xs font-bold text-zinc-300">
                        {formatDate(user.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-2xl border border-zinc-800 bg-black p-3 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-500">Referral Code</span>
                      <span className="font-bold text-yellow-300">
                        {user.referral_code ||
                          user.wallet?.referral_code ||
                          "—"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-500">Referred By</span>
                      <span className="break-all text-right font-bold text-zinc-300">
                        {user.referred_by ||
                          user.wallet?.referred_by ||
                          "—"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-500">
                        First Deposit Bonus
                      </span>
                      <span
                        className={
                          user.wallet?.first_deposit_bonus_given
                            ? "font-bold text-green-400"
                            : "font-bold text-zinc-500"
                        }
                      >
                        {user.wallet?.first_deposit_bonus_given
                          ? "Given"
                          : "Not Given"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-500">
                        Referral Bonus
                      </span>
                      <span
                        className={
                          user.wallet?.referral_bonus_given
                            ? "font-bold text-green-400"
                            : "font-bold text-zinc-500"
                        }
                      >
                        {user.wallet?.referral_bonus_given
                          ? "Given"
                          : "Not Given"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedUid(user.firebase_uid)}
                    className="mt-4 w-full rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 font-black text-yellow-300 active:scale-[0.98]"
                  >
                    View Full Details & Transactions →
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 px-3 py-5 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl rounded-[28px] border border-zinc-800 bg-[#09090d] shadow-2xl">
            <div className="sticky top-0 z-10 rounded-t-[28px] border-b border-zinc-800 bg-[#09090d]/95 p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
                    User Full Details
                  </p>

                  <h2 className="mt-1 truncate text-2xl font-black">
                    {selectedUser.name ||
                      selectedUser.username ||
                      formatPhone(selectedUser.phone)}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {formatPhone(selectedUser.phone)}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedUid(null)}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 font-black text-red-300"
                >
                  Close ✕
                </button>
              </div>
            </div>

            <div className="space-y-5 p-4">
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
                  <p className="text-xs text-green-300">
                    Current Balance
                  </p>
                  <p className="mt-1 text-2xl font-black text-green-400">
                    {formatMoney(selectedUser.wallet?.balance)}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                  <p className="text-xs text-blue-300">Total Credit</p>
                  <p className="mt-1 text-2xl font-black text-blue-400">
                    {formatMoney(selectedTotals.plus)}
                  </p>
                </div>

                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-xs text-red-300">Total Debit</p>
                  <p className="mt-1 text-2xl font-black text-red-400">
                    {formatMoney(selectedTotals.minus)}
                  </p>
                </div>
              </section>

              <section className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="text-lg font-black text-white">
                  Account Information
                </h3>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex flex-col justify-between gap-1 border-b border-zinc-800 pb-3 sm:flex-row">
                    <span className="text-zinc-500">Name</span>
                    <span className="font-bold text-white">
                      {selectedUser.name || "—"}
                    </span>
                  </div>

                  <div className="flex flex-col justify-between gap-1 border-b border-zinc-800 pb-3 sm:flex-row">
                    <span className="text-zinc-500">Username</span>
                    <span className="font-bold text-yellow-300">
                      {selectedUser.username
                        ? `@${selectedUser.username}`
                        : "—"}
                    </span>
                  </div>

                  <div className="flex flex-col justify-between gap-1 border-b border-zinc-800 pb-3 sm:flex-row">
                    <span className="text-zinc-500">Mobile</span>
                    <span className="font-bold text-white">
                      {formatPhone(selectedUser.phone)}
                    </span>
                  </div>

                  <div className="flex flex-col justify-between gap-1 border-b border-zinc-800 pb-3 sm:flex-row">
                    <span className="text-zinc-500">Firebase UID</span>
                    <span className="break-all font-mono text-xs text-zinc-300">
                      {selectedUser.firebase_uid}
                    </span>
                  </div>

                  <div className="flex flex-col justify-between gap-1 border-b border-zinc-800 pb-3 sm:flex-row">
                    <span className="text-zinc-500">Referral Code</span>
                    <span className="font-bold text-yellow-300">
                      {selectedUser.referral_code ||
                        selectedUser.wallet?.referral_code ||
                        "—"}
                    </span>
                  </div>

                  <div className="flex flex-col justify-between gap-1 border-b border-zinc-800 pb-3 sm:flex-row">
                    <span className="text-zinc-500">Referred By</span>
                    <span className="break-all font-bold text-zinc-300">
                      {selectedUser.referred_by ||
                        selectedUser.wallet?.referred_by ||
                        "—"}
                    </span>
                  </div>

                  <div className="flex flex-col justify-between gap-1 border-b border-zinc-800 pb-3 sm:flex-row">
                    <span className="text-zinc-500">KYC Status</span>
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${getKycClass(
                        selectedUser.kyc_status
                      )}`}
                    >
                      {selectedUser.kyc_status || "not submitted"}
                    </span>
                  </div>

                  <div className="flex flex-col justify-between gap-1 sm:flex-row">
                    <span className="text-zinc-500">
                      Account Created
                    </span>
                    <span className="font-bold text-zinc-300">
                      {formatDate(selectedUser.created_at)}
                    </span>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black">
                    Transaction History
                  </h3>

                  <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-black text-purple-300">
                    {selectedTransactions.length} Entries
                  </span>
                </div>

                {selectedTransactions.length === 0 ? (
                  <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-8 text-center">
                    <p className="font-bold text-zinc-500">
                      इस user की transaction history खाली है।
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedTransactions.map((transaction) => {
                      const sign = getTransactionSign(
                        transaction.type,
                        transaction.amount
                      );

                      const isMinus = sign === "−";

                      return (
                        <article
                          key={transaction.id}
                          className="rounded-[22px] border border-zinc-800 bg-zinc-950 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-black text-white">
                                {transaction.title ||
                                  transaction.type ||
                                  "Transaction"}
                              </p>

                              <p className="mt-1 text-sm text-zinc-500">
                                {transaction.description || "—"}
                              </p>

                              <p className="mt-2 text-xs text-zinc-600">
                                {formatDate(transaction.created_at)}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p
                                className={`text-xl font-black ${
                                  isMinus
                                    ? "text-red-400"
                                    : "text-green-400"
                                }`}
                              >
                                {sign}
                                {formatMoney(
                                  Math.abs(
                                    Number(transaction.amount || 0)
                                  )
                                )}
                              </p>

                              <p className="mt-1 text-xs font-bold text-zinc-500">
                                Balance:{" "}
                                {formatMoney(
                                  transaction.balance_after
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-xs font-bold text-zinc-400">
                              {transaction.type || "unknown"}
                            </span>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                                transaction.status === "completed" ||
                                transaction.status === "approved"
                                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                                  : transaction.status === "rejected"
                                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                                  : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                              }`}
                            >
                              {transaction.status || "—"}
                            </span>

                            {transaction.battle_id && (
                              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                                Battle #{transaction.battle_id}
                              </span>
                            )}

                            {transaction.deposit_id && (
                              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
                                Deposit #{transaction.deposit_id}
                              </span>
                            )}

                            {transaction.withdraw_id && (
                              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
                                Withdraw #{transaction.withdraw_id}
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}