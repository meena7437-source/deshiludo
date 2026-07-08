"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function DepositPage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [depositBalance, setDepositBalance] = useState(0);
  const [winningBalance, setWinningBalance] = useState(0);

  const [amount, setAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const upiId = "Q65123373@ybl";
  const upiName = "Sher Singh Meena";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setUid(user.uid);
      setPhone(user.phoneNumber || "");
      await loadWallet(user.uid);
      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  async function loadWallet(userId: string) {
    const { data, error } = await supabase
      .from("wallets")
      .select("deposit_balance, winning_balance")
      .eq("uid", userId)
      .maybeSingle();

    if (error) {
      toast.error("Wallet load nahi hua");
      return;
    }

    setDepositBalance(Number(data?.deposit_balance || 0));
    setWinningBalance(Number(data?.winning_balance || 0));
  }

  async function copyUpi() {
    await navigator.clipboard.writeText(upiId);
    toast.success("UPI ID copied");
  }

  async function submitDeposit() {
    const depositAmount = Number(amount);

    if (!depositAmount || depositAmount < 10) {
      toast.error("Minimum deposit ₹10 hai");
      return;
    }

    if (!utr.trim()) {
      toast.error("UTR number daalo");
      return;
    }

    if (!screenshot) {
      toast.error("Payment screenshot upload karo");
      return;
    }

    setSubmitting(true);

    const fileName = `deposit-${uid}-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("screenshots")
      .upload(fileName, screenshot);

    if (uploadError) {
      setSubmitting(false);
      toast.error("Screenshot upload failed");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("screenshots")
      .getPublicUrl(fileName);

    const { error } = await supabase.from("deposits").insert({
      uid,
      phone,
      amount: depositAmount,
      utr: utr.trim(),
      screenshot_url: urlData.publicUrl,
      status: "pending",
    });

    setSubmitting(false);

    if (error) {
      toast.error("Deposit request failed");
      return;
    }

    toast.success("Deposit request submit ho gayi");
    setAmount("");
    setUtr("");
    setScreenshot(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-yellow-400 font-bold">Loading Deposit...</p>
      </main>
    );
  }

  const totalBalance = depositBalance + winningBalance;

  return (
    <main className="min-h-screen bg-black text-white p-3">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black text-yellow-400">Deposit</h1>

          <Link href="/dashboard">
            <button className="bg-zinc-800 px-3 py-2 rounded-lg text-xs">
              Back
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-zinc-950 border border-yellow-500/30 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400">Deposit</p>
            <p className="text-lg font-black text-yellow-400">
              ₹{depositBalance}
            </p>
          </div>

          <div className="bg-zinc-950 border border-green-500/30 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400">Winning</p>
            <p className="text-lg font-black text-green-400">
              ₹{winningBalance}
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400">Total</p>
            <p className="text-lg font-black text-white">₹{totalBalance}</p>
          </div>
        </div>

        <div className="bg-yellow-400/10 border border-yellow-500/30 rounded-xl p-3 mb-3">
          <p className="text-sm font-bold text-yellow-400">
            🎁 First Deposit Bonus 5%
          </p>
          <p className="text-[11px] text-zinc-400">
            First deposit par hi bonus milega.
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
          <label className="text-xs text-zinc-400">Amount</label>

          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount daalo"
            className="w-full mt-1 mb-2 p-2.5 rounded-lg bg-black border border-zinc-700 text-white outline-none text-sm"
          />

          <div className="grid grid-cols-5 gap-2 mb-3">
            {[100, 200, 500, 1000, 2000].map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(String(amt))}
                className="bg-zinc-800 text-yellow-400 rounded-lg text-xs font-bold py-2"
              >
                ₹{amt}
              </button>
            ))}
          </div>

          <div className="bg-black border border-zinc-800 rounded-xl p-3 mb-3">
            <p className="text-xs text-zinc-400 mb-2">
              Pay using any UPI App
            </p>

            <div className="mb-2">
              <p className="text-[11px] text-zinc-500">UPI ID</p>

              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-sm font-bold text-white break-all">
                  {upiId}
                </p>

                <button
                  onClick={copyUpi}
                  className="bg-yellow-400 text-black px-3 py-1 rounded-lg text-xs font-black"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-zinc-500">Account Holder</p>
              <p className="text-sm font-bold text-green-400">{upiName}</p>
            </div>

            <p className="text-[11px] text-zinc-500 mt-3">
              Payment complete karne ke baad UTR Number aur Screenshot upload
              karke Deposit Request submit karein.
            </p>
          </div>

          <label className="text-xs text-zinc-400">UTR Number</label>
          <input
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            placeholder="12 digit UTR"
            className="w-full mt-1 mb-3 p-2.5 rounded-lg bg-black border border-zinc-700 text-white outline-none text-sm"
          />

          <label className="text-xs text-zinc-400">Payment Screenshot</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
            className="w-full mt-1 mb-3 p-2 rounded-lg bg-black border border-zinc-700 text-white text-xs"
          />

          <button
            onClick={submitDeposit}
            disabled={submitting}
            className="w-full bg-yellow-400 text-black py-2.5 rounded-lg font-black text-sm disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Deposit"}
          </button>
        </div>
      </div>
    </main>
  );
}