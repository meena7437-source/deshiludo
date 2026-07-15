"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

type WalletTx = {
  id: number;
  type: string;
  title: string;
  amount: number;
  direction: string;
  balance_type: string | null;
  reference_id: number | null;
  created_at: string;
};

export default function WalletHistoryPage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [history, setHistory] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let historyChannel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setUid(user.uid);
      await loadHistory(user.uid);

      historyChannel = supabase
        .channel(`wallet-history-${user.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallet_history",
            filter: `uid=eq.${user.uid}`,
          },
          async () => {
            await loadHistory(user.uid);
          }
        )
        .subscribe();

      setLoading(false);
    });

    return () => {
      unsubscribe();

      if (historyChannel) {
        supabase.removeChannel(historyChannel);
      }
    };
  }, [router]);

  async function loadHistory(userId: string) {
    const { data, error } = await supabase
      .from("wallet_history")
      .select(
        "id,type,title,amount,direction,balance_type,reference_id,created_at"
      )
      .eq("uid", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Wallet history load error:", error);
      toast.error("Wallet history load nahi hui");
      return;
    }

    setHistory((data || []) as WalletTx[]);
  }

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
        dotClass: "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.6)]",
        amountClass: "text-red-400",
        borderClass: "border-red-500/25",
      };
    }

    if (tx.direction === "zero" || Number(tx.amount || 0) === 0) {
      return {
        dotClass: "bg-zinc-400 shadow-[0_0_10px_rgba(161,161,170,0.5)]",
        amountClass: "text-zinc-300",
        borderClass: "border-zinc-700",
      };
    }

    return {
      dotClass: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]",
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
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          <p className="text-sm font-bold text-yellow-400">
            Loading Wallet History...
          </p>
        </div>
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
              className="h-10 w-10 shrink-0 rounded-full border border-yellow-400/40 object-cover"
              priority
            />

            <div className="min-w-0">
              <h1 className="text-xl font-black leading-tight text-yellow-400">
                Wallet History
              </h1>
              <p className="mt-0.5 truncate text-[9px] text-zinc-600">
                UID: {uid}
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            className="shrink-0 rounded-lg bg-zinc-800 px-3 py-2 text-[11px] font-bold"
          >
            Back
          </Link>
        </header>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center">
            <p className="text-sm text-zinc-400">
              Abhi koi wallet history nahi hai.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((tx) => {
              const amount = Number(tx.amount || 0);
              const style = txStyle(tx);

              return (
                <article
                  key={tx.id}
                  className={`rounded-2xl border ${style.borderClass} bg-zinc-950 px-3 py-2.5`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${style.dotClass}`}
                      />

                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black leading-5 text-white">
                          {cleanTitle(tx)}
                        </p>

                        <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">
                          {formatDate(tx.created_at)}
                          {tx.balance_type
                            ? ` • ${tx.balance_type}`
                            : " • wallet"}
                        </p>

                        {tx.reference_id !== null && (
                          <p className="mt-0.5 text-[9px] leading-4 text-zinc-600">
                            Ref ID: {tx.reference_id}
                          </p>
                        )}
                      </div>
                    </div>

                    <p
                      className={`shrink-0 pt-0.5 text-[15px] font-black leading-5 ${style.amountClass}`}
                    >
                      {formatAmount(amount, tx.direction)}
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
