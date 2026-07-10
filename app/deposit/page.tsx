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
  const [balance, setBalance] = useState(0);

  const [amount, setAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const upiId = "Q65123373@ybl";
  const upiName = "Sher Singh Meena";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setUid(user.uid);
      await loadWallet(user.uid);
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

  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(upiId);
      toast.success("UPI ID copied");
    } catch (error) {
      console.error("UPI copy error:", error);
      toast.error("UPI ID copy nahi hui");
    }
  }

  async function submitDeposit() {
    const depositAmount = Number(amount);
    const cleanUtr = utr.trim();

    if (!uid) {
      toast.error("Login session missing");
      return;
    }

    if (!Number.isFinite(depositAmount) || depositAmount < 100) {
      toast.error("Minimum deposit ₹100 hai");
      return;
    }

    if (!Number.isInteger(depositAmount)) {
      toast.error("Deposit amount poore rupaye me daalo");
      return;
    }

    if (!cleanUtr) {
      toast.error("UTR number daalo");
      return;
    }

    if (cleanUtr.length < 6) {
      toast.error("Valid UTR number daalo");
      return;
    }

    if (!screenshot) {
      toast.error("Payment screenshot upload karo");
      return;
    }

    if (!screenshot.type.startsWith("image/")) {
      toast.error("Sirf image screenshot upload karo");
      return;
    }

    if (screenshot.size > 5 * 1024 * 1024) {
      toast.error("Screenshot 5 MB se chhota hona chahiye");
      return;
    }

    setSubmitting(true);

    let uploadedFilePath = "";

    try {
      const safeExtension =
        screenshot.name.split(".").pop()?.toLowerCase() || "jpg";

      const safeFileName = `deposit-${uid}-${Date.now()}.${safeExtension}`;
      uploadedFilePath = `${uid}/${safeFileName}`;

      const { error: duplicateError, data: existingDeposit } = await supabase
        .from("deposits")
        .select("id")
        .eq("utr", cleanUtr)
        .maybeSingle();

      if (duplicateError) {
        console.error("UTR check error:", duplicateError);
        toast.error("UTR verify nahi hua");
        return;
      }

      if (existingDeposit) {
        toast.error("Ye UTR pehle use ho chuka hai");
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from("deposits")
        .upload(uploadedFilePath, screenshot, {
          cacheControl: "3600",
          upsert: false,
          contentType: screenshot.type,
        });

      if (uploadError) {
        console.error("Screenshot upload error:", uploadError);
        toast.error(uploadError.message || "Screenshot upload failed");
        return;
      }

      const { error: insertError } = await supabase.from("deposits").insert({
        uid,
        amount: depositAmount,
        utr: cleanUtr,
        screenshot: uploadedFilePath,
        status: "pending",
      });

      if (insertError) {
        console.error("Deposit insert error:", insertError);

        await supabase.storage
          .from("deposits")
          .remove([uploadedFilePath]);

        toast.error(insertError.message || "Deposit request failed");
        return;
      }

      toast.success("Deposit request submit ho gayi ✅");

      setAmount("");
      setUtr("");
      setScreenshot(null);

      const fileInput = document.getElementById(
        "deposit-screenshot"
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      await loadWallet(uid);
    } catch (error: any) {
      console.error("Deposit submit error:", error);

      if (uploadedFilePath) {
        await supabase.storage
          .from("deposits")
          .remove([uploadedFilePath]);
      }

      toast.error(error?.message || "Deposit request failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          <p className="font-bold text-yellow-400">Loading Deposit...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-3 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-black text-yellow-400">Deposit</h1>

          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold"
          >
            Back
          </Link>
        </div>

        <div className="mb-3 rounded-xl border border-yellow-500/30 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-400">Wallet Balance</p>
          <p className="mt-1 text-2xl font-black text-yellow-400">
            ₹{balance.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="mb-3 rounded-xl border border-yellow-500/30 bg-yellow-400/10 p-3">
          <p className="text-sm font-bold text-yellow-400">
            🎁 First Deposit Bonus 5%
          </p>
          <p className="text-[11px] text-zinc-400">
            Bonus sirf pehle approved deposit par milega.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <label className="text-xs text-zinc-400">Amount</label>

          <input
            type="number"
            min="100"
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Amount daalo"
            className="mb-2 mt-1 w-full rounded-lg border border-zinc-700 bg-black p-2.5 text-sm text-white outline-none focus:border-yellow-400"
          />

          <div className="mb-3 grid grid-cols-5 gap-2">
            {[100, 200, 500, 1000, 2000].map((depositValue) => (
              <button
                key={depositValue}
                type="button"
                onClick={() => setAmount(String(depositValue))}
                disabled={submitting}
                className="rounded-lg bg-zinc-800 py-2 text-xs font-bold text-yellow-400 disabled:opacity-50"
              >
                ₹{depositValue}
              </button>
            ))}
          </div>

          <div className="mb-3 rounded-xl border border-zinc-800 bg-black p-3">
            <p className="mb-2 text-xs text-zinc-400">
              Pay using any UPI App
            </p>

            <div className="mb-2">
              <p className="text-[11px] text-zinc-500">UPI ID</p>

              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="break-all text-sm font-bold text-white">
                  {upiId}
                </p>

                <button
                  type="button"
                  onClick={copyUpi}
                  className="rounded-lg bg-yellow-400 px-3 py-1 text-xs font-black text-black"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-zinc-500">Account Holder</p>
              <p className="text-sm font-bold text-green-400">{upiName}</p>
            </div>

            <p className="mt-3 text-[11px] text-zinc-500">
              Payment complete karne ke baad UTR number aur screenshot upload
              karke deposit request submit karein.
            </p>
          </div>

          <label className="text-xs text-zinc-400">UTR Number</label>

          <input
            type="text"
            inputMode="numeric"
            value={utr}
            onChange={(event) =>
              setUtr(event.target.value.replace(/\s/g, ""))
            }
            placeholder="UTR number"
            className="mb-3 mt-1 w-full rounded-lg border border-zinc-700 bg-black p-2.5 text-sm text-white outline-none focus:border-yellow-400"
          />

          <label className="text-xs text-zinc-400">
            Payment Screenshot
          </label>

          <input
            id="deposit-screenshot"
            type="file"
            accept="image/*"
            onChange={(event) =>
              setScreenshot(event.target.files?.[0] || null)
            }
            className="mb-2 mt-1 w-full rounded-lg border border-zinc-700 bg-black p-2 text-xs text-white"
          />

          {screenshot && (
            <p className="mb-3 break-all text-[11px] text-green-400">
              Selected: {screenshot.name}
            </p>
          )}

          <button
            type="button"
            onClick={submitDeposit}
            disabled={submitting}
            className="w-full rounded-lg bg-yellow-400 py-2.5 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Deposit"}
          </button>
        </div>
      </div>
    </main>
  );
}
