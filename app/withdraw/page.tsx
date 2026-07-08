"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function WithdrawPage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [depositBalance, setDepositBalance] = useState(0);
  const [winningBalance, setWinningBalance] = useState(0);
  const [kycStatus, setKycStatus] = useState("not_submitted");
  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setUid(user.uid);
      setPhone(user.phoneNumber || "");

      await Promise.all([loadWallet(user.uid), loadKyc(user.uid)]);

      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  async function loadWallet(userId: string) {
    const { data, error } = await supabase
      .from("wallets")
      .select("deposit_balance, winning_balance")
      .eq("uid", userId)
      .single();

    if (error) {
      toast.error("Wallet load nahi hua");
      return;
    }

    setDepositBalance(Number(data?.deposit_balance || 0));
    setWinningBalance(Number(data?.winning_balance || 0));
  }

  async function loadKyc(userId: string) {
    const { data, error } = await supabase
      .from("kyc")
      .select("status")
      .eq("uid", userId)
      .maybeSingle();

    if (error) {
      setKycStatus("not_submitted");
      return;
    }

    setKycStatus(data?.status || "not_submitted");
  }

  async function submitWithdraw() {
    const withdrawAmount = Number(amount);

    if (kycStatus !== "approved") {
      toast.error("Withdraw ke liye KYC approved hona jaruri hai");
      return;
    }

    if (!withdrawAmount || withdrawAmount <= 0) {
      toast.error("Amount daalo");
      return;
    }

    if (withdrawAmount < 100) {
      toast.error("Minimum withdraw ₹100 hai");
      return;
    }

    if (withdrawAmount > winningBalance) {
      toast.error("Sirf Winning Balance withdraw ho sakta hai");
      return;
    }

    if (!upiId.trim()) {
      toast.error("UPI ID daalo");
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.rpc("request_withdraw_safe", {
      uid_input: uid,
      phone_input: phone,
      amount_input: withdrawAmount,
      upi_input: upiId.trim(),
    });

    setSubmitting(false);

    if (error) {
      toast.error("Withdraw request failed");
      return;
    }

    if (!data?.success) {
      toast.error(data?.message || "Withdraw failed");
      return;
    }

    toast.success(data.message || "Withdraw request submit ho gayi");
    setAmount("");
    setUpiId("");
    await loadWallet(uid);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-yellow-400 font-bold">Loading Withdraw...</p>
      </main>
    );
  }

  const kycApproved = kycStatus === "approved";

  return (
    <main className="min-h-screen bg-black text-white p-3">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black text-yellow-400">Withdraw</h1>

          <Link href="/dashboard">
            <button className="bg-zinc-800 px-3 py-2 rounded-lg text-xs">
              Back
            </button>
          </Link>
        </div>

        <div
          className={`mb-3 rounded-xl border p-3 ${
            kycApproved
              ? "bg-green-950/30 border-green-500/40"
              : "bg-red-950/30 border-red-500/40"
          }`}
        >
          <p
            className={`text-sm font-black ${
              kycApproved ? "text-green-400" : "text-red-400"
            }`}
          >
            KYC Status: {kycStatus.toUpperCase()}
          </p>

          <p className="text-[11px] text-zinc-400 mt-1">
            {kycApproved
              ? "Aapka withdraw enabled hai."
              : "Withdraw ke liye pehle KYC approved hona jaruri hai."}
          </p>

          {!kycApproved && (
            <Link href="/kyc">
              <button className="mt-2 bg-yellow-400 text-black px-3 py-2 rounded-lg text-xs font-black">
                Complete KYC
              </button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-zinc-950 border border-red-500/30 rounded-xl p-3">
            <p className="text-zinc-400 text-xs">Deposit Balance</p>
            <p className="text-xl font-black text-red-400">
              ₹{depositBalance}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              Withdraw blocked
            </p>
          </div>

          <div className="bg-zinc-950 border border-green-500/30 rounded-xl p-3">
            <p className="text-zinc-400 text-xs">Winning Balance</p>
            <p className="text-xl font-black text-green-400">
              ₹{winningBalance}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              {kycApproved ? "Withdraw allowed" : "KYC required"}
            </p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
          <label className="text-xs text-zinc-400">Withdraw Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Minimum ₹100"
            disabled={!kycApproved}
            className="w-full mt-1 mb-3 p-2.5 rounded-lg bg-black border border-zinc-700 text-white outline-none text-sm disabled:opacity-50"
          />

          <label className="text-xs text-zinc-400">UPI ID</label>
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="example@upi"
            disabled={!kycApproved}
            className="w-full mt-1 mb-3 p-2.5 rounded-lg bg-black border border-zinc-700 text-white outline-none text-sm disabled:opacity-50"
          />

          <button
            onClick={submitWithdraw}
            disabled={submitting || !kycApproved}
            className="w-full bg-yellow-400 text-black py-2.5 rounded-lg font-black text-sm disabled:opacity-50"
          >
            {submitting
              ? "Submitting..."
              : kycApproved
              ? "Submit Withdraw"
              : "KYC Required"}
          </button>

          <p className="text-[11px] text-zinc-500 mt-3 text-center">
            Minimum ₹100 • Sirf Winning Balance withdraw hoga • KYC mandatory
          </p>
        </div>
      </div>
    </main>
  );
}