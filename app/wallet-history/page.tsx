"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";

type WalletTx = {
  id: number;
  uid: string;
  type: string;
  title: string;
  amount: number;
  direction: string;
  balance_type: string | null;
  reference_id: number | null;
  created_at: string;
};

type WalletHistoryResponse = {
  uid?: string;
  history?: WalletTx[];
  error?: string;
  details?: string;
};

export default function WalletHistoryPage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [history, setHistory] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadHistory = useCallback(
    async (showLoader = false) => {
      try {
        const user = auth.currentUser;

        if (!user) {
          router.replace("/login");
          return;
        }

        if (showLoader) setRefreshing(true);

        setLoadError("");

        const idToken = await user.getIdToken(true);

        const response = await fetch("/api/wallet-history", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          cache: "no-store",
        });

        const result =
          (await response.json()) as WalletHistoryResponse;

        if (!response.ok) {
          throw new Error(
            [result.error, result.details].filter(Boolean).join(" | ") ||
              "Wallet history load nahi hui."
          );
        }

        setUid(result.uid || user.uid);
        setHistory(result.history || []);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown wallet history error";

        setHistory([]);
        setLoadError(message);
        toast.error("Wallet history load nahi hui");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      setUid(user.uid);
      await loadHistory();
    });

    return unsubscribe;
  }, [loadHistory, router]);

  function cleanTitle(tx: WalletTx) {
    if (tx.type === "battle_cancel_refund") return "Cancel Refund";
    if (tx.type === "battle_create") return "Create Battle";
    if (tx.type === "battle_join") return "Join Battle";
    if (tx.type === "battle_win") return "Battle Win";
    if (tx.type === "deposit") return "Deposit";
    if (tx.type === "first_deposit_bonus") return "First Deposit Bonus";
    if (tx.type === "referral_bonus") return "Referral Bonus";
    if (tx.type === "withdraw_request") return "Withdraw";
    if (tx.type === "withdraw_refund") return "Withdraw Reject Refund";

    return tx.title || tx.type || "Wallet Entry";
  }

  function txStyle(tx: WalletTx) {
    if (tx.direction === "minus") {
      return {
        dotClass: "bg-red-400",
        amountClass: "text-red-400",
        borderClass: "border-red-500/25",
      };
    }

    if (tx.direction === "zero" || Number(tx.amount || 0) === 0) {
      return {
        dotClass: "bg-zinc-400",
        amountClass: "text-zinc-300",
        borderClass: "border-zinc-700",
      };
    }

    return {
      dotClass: "bg-emerald-400",
      amountClass: "text-emerald-400",
      borderClass: "border-emerald-500/25",
    };
  }

  function formatAmount(amount: number, direction: string) {
    const formattedAmount = Math.abs(Number(amount || 0)).toLocaleString(
      "en-IN"
    );

    if (direction === "plus") return `+₹${formattedAmount}`;
    if (direction === "minus") return `-₹${formattedAmount}`;

    return "₹0";
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-sm font-bold text-yellow-400">
          Loading Wallet History...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-3 pb-20 pt-3 text-white">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="DeshiLudo"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full"
              priority
            />

            <div className="min-w-0">
              <h1 className="text-xl font-black text-yellow-400">
                Wallet History
              </h1>

              <p className="truncate text-[9px] text-zinc-600">
                UID: {uid}
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            className="rounded-lg bg-zinc-800 px-3 py-2 text-[11px] font-bold"
          >
            Back
          </Link>
        </header>

        {loadError && (
          <div className="mb-3 rounded-2xl border border-red-500/30 bg-red-950/30 p-3">
            <p className="text-xs font-black text-red-400">
              Wallet History Error
            </p>

            <p className="mt-1 break-all text-[10px] text-red-300">
              {loadError}
            </p>

            <button
              type="button"
              onClick={() => loadHistory(true)}
              disabled={refreshing}
              className="mt-3 rounded-lg bg-red-500 px-3 py-2 text-[11px] font-black text-white"
            >
              {refreshing ? "Loading..." : "Try Again"}
            </button>
          </div>
        )}

        {!loadError && history.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center">
            <p className="text-sm text-zinc-400">
              Abhi koi wallet history nahi hai.
            </p>
          </div>
        )}

        {!loadError && history.length > 0 && (
          <div className="space-y-2">
            {history.map((tx) => {
              const style = txStyle(tx);

              return (
                <article
                  key={tx.id}
                  className={`rounded-2xl border ${style.borderClass} bg-zinc-950 px-3 py-2.5`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className={`mt-1.5 h-3 w-3 rounded-full ${style.dotClass}`}
                      />

                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black text-white">
                          {cleanTitle(tx)}
                        </p>

                        <p className="mt-0.5 text-[10px] text-zinc-500">
                          {formatDate(tx.created_at)}
                          {tx.balance_type
                            ? ` • ${tx.balance_type}`
                            : " • wallet"}
                        </p>

                        {tx.reference_id !== null && (
                          <p className="mt-0.5 text-[9px] text-zinc-600">
                            Ref ID: {tx.reference_id}
                          </p>
                        )}
                      </div>
                    </div>

                    <p
                      className={`shrink-0 text-[15px] font-black ${style.amountClass}`}
                    >
                      {formatAmount(tx.amount, tx.direction)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}