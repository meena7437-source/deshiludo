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
  const [balance, setBalance] = useState(0);
  const [kycStatus, setKycStatus] = useState("pending");

  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setUid(user.uid);
      setPhone(user.phoneNumber || "");

      await Promise.all([loadWallet(user.uid), loadKyc(user.uid)]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  async function loadWallet(userId: string) {
    const { data, error } = await supabase
      .from("wallets")
      .select("balance")
      .eq("uid", userId)
      .maybeSingle();

    if (error) {
      console.error("Wallet load error:", error);
      toast.error("Wallet load nahi hua");
      return;
    }

    setBalance(Number(data?.balance || 0));
  }

  async function loadKyc(userId: string) {
    const { data, error } = await supabase
      .from("users")
      .select("kyc_status")
      .eq("firebase_uid", userId)
      .maybeSingle();

    if (error) {
      console.error("KYC load error:", error);
      setKycStatus("pending");
      return;
    }

    setKycStatus(data?.kyc_status || "pending");
  }

  async function submitWithdraw() {
    const withdrawAmount = Number(amount);
    const cleanUpiId = upiId.trim();

    if (!uid) {
      toast.error("Login session missing");
      return;
    }

    if (kycStatus !== "approved") {
      toast.error("Withdraw ke liye KYC approved hona jaruri hai");
      return;
    }

    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
      toast.error("Valid amount daalo");
      return;
    }

    if (!Number.isInteger(withdrawAmount)) {
      toast.error("Withdraw amount poore rupaye me daalo");
      return;
    }

    if (withdrawAmount < 100) {
      toast.error("Minimum withdraw ₹100 hai");
      return;
    }

    if (withdrawAmount > balance) {
      toast.error("Wallet balance kam hai");
      return;
    }

    if (!cleanUpiId) {
      toast.error("UPI ID daalo");
      return;
    }

    if (
      cleanUpiId.length < 5 ||
      !cleanUpiId.includes("@") ||
      cleanUpiId.startsWith("@") ||
      cleanUpiId.endsWith("@")
    ) {
      toast.error("Valid UPI ID daalo");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("request_withdraw_safe", {
        uid_input: uid,
        phone_input: phone,
        amount_input: withdrawAmount,
        upi_input: cleanUpiId,
      });

      if (error) {
        console.error("Withdraw RPC error:", error);
        toast.error(error.message || "Withdraw request failed");
        return;
      }

      if (!data?.success) {
        toast.error(data?.message || "Withdraw failed");
        return;
      }

      toast.success(data.message || "Withdraw request submit ho gayi ✅");

      setAmount("");
      setUpiId("");

      await loadWallet(uid);
    } catch (error: any) {
      console.error("Withdraw submit error:", error);
      toast.error(error?.message || "Withdraw request failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          <p className="font-bold text-yellow-400">Loading Withdraw...</p>
        </div>
      </main>
    );
  }

  const kycApproved = kycStatus === "approved";

  return (
    <main className="min-h-screen bg-black p-3 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-black text-yellow-400">Withdraw</h1>

          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold"
          >
            Back
          </Link>
        </div>

        <div
          className={`mb-3 rounded-xl border p-3 ${
            kycApproved
              ? "border-green-500/40 bg-green-950/30"
              : "border-red-500/40 bg-red-950/30"
          }`}
        >
          <p
            className={`text-sm font-black ${
              kycApproved ? "text-green-400" : "text-red-400"
            }`}
          >
            KYC Status: {kycStatus.toUpperCase()}
          </p>

          <p className="mt-1 text-[11px] text-zinc-400">
            {kycApproved
              ? "Aapka withdraw enabled hai."
              : "Withdraw ke liye pehle KYC approved hona jaruri hai."}
          </p>

          {!kycApproved && (
            <Link
              href="/profile"
              className="mt-2 inline-block rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-black"
            >
              Complete KYC
            </Link>
          )}
        </div>

        <div className="mb-3 rounded-xl border border-green-500/30 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-400">Available Wallet Balance</p>
          <p className="mt-1 text-2xl font-black text-green-400">
            ₹{balance.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {kycApproved ? "Withdraw allowed" : "KYC required"}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <label className="text-xs text-zinc-400">Withdraw Amount</label>

          <input
            type="number"
            min="100"
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Minimum ₹100"
            disabled={!kycApproved || submitting}
            className="mb-3 mt-1 w-full rounded-lg border border-zinc-700 bg-black p-2.5 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-50"
          />

          <label className="text-xs text-zinc-400">UPI ID</label>

          <input
            type="text"
            value={upiId}
            onChange={(event) => setUpiId(event.target.value.replace(/\s/g, ""))}
            placeholder="example@upi"
            disabled={!kycApproved || submitting}
            className="mb-3 mt-1 w-full rounded-lg border border-zinc-700 bg-black p-2.5 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-50"
          />

          <button
            type="button"
            onClick={submitWithdraw}
            disabled={submitting || !kycApproved}
            className="w-full rounded-lg bg-yellow-400 py-2.5 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Submitting..."
              : kycApproved
              ? "Submit Withdraw"
              : "KYC Required"}
          </button>

          <p className="mt-3 text-center text-[11px] text-zinc-500">
            Minimum ₹100 • Wallet balance se withdraw hoga • KYC mandatory
          </p>
        </div>
      </div>
    </main>
  );
}
