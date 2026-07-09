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

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
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
      unsub();
      if (historyChannel) supabase.removeChannel(historyChannel);
    };
  }, [router]);

  async function loadHistory(userId: string) {
    const { data, error } = await supabase
      .from("wallet_history")
      .select("id,type,title,amount,direction,balance_type,reference_id,created_at")
      .eq("uid", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Wallet history load nahi hui");
      return;
    }

    setHistory((data || []) as WalletTx[]);
  }

  function cleanTitle(tx: WalletTx) {
    if (tx.type === "battle_cancel_refund") return "Cancel Refund";
    if (tx.type === "battle_create") return "Join Battle";
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
        icon: "🔴",
        amountClass: "text-red-400",
        border: "border-red-500/20",
      };
    }

    if (tx.direction === "zero" || Number(tx.amount || 0) === 0) {
      return {
        icon: "⚪",
        amountClass: "text-zinc-300",
        border: "border-zinc-700",
      };
    }

    return {
      icon: "🟢",
      amountClass: "text-green-400",
      border: "border-green-500/20",
    };
  }

  function formatAmount(amount: number, direction: string) {
    if (direction === "plus") return `+₹${Math.abs(amount)}`;
    if (direction === "minus") return `-₹${Math.abs(amount)}`;
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
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-yellow-400 font-bold">Loading Wallet History...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-3 pb-24">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="DeshiLudo"
              width={46}
              height={46}
              className="rounded-full border border-yellow-400/40 object-cover"
              priority
            />

            <div>
              <h1 className="text-2xl font-black text-yellow-400">
                Wallet History
              </h1>
              <p className="text-[11px] text-zinc-500 break-all">UID: {uid}</p>
            </div>
          </div>

          <Link href="/profile">
            <button className="bg-zinc-800 px-3 py-2 rounded-lg text-xs">
              Back
            </button>
          </Link>
        </div>

        {history.length === 0 ? (
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-center">
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
                <div
                  key={tx.id}
                  className={`bg-zinc-950 border ${style.border} rounded-xl p-3`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">
                        {style.icon} {cleanTitle(tx)}
                      </p>

                      <p className="text-[11px] text-zinc-500 mt-1">
                        {formatDate(tx.created_at)} •{" "}
                        {tx.balance_type || "wallet"}
                      </p>

                      {tx.reference_id && (
                        <p className="text-[10px] text-zinc-600 mt-1">
                          Ref ID: {tx.reference_id}
                        </p>
                      )}
                    </div>

                    <p
                      className={`text-lg font-black whitespace-nowrap ${style.amountClass}`}
                    >
                      {formatAmount(amount, tx.direction)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}