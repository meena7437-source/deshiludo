"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function DepositPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

  useEffect(() => {
    let channel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);
      await loadDeposits(currentUser.uid);
      setPageLoading(false);

      channel = supabase
        .channel(`deposit-history-realtime-${currentUser.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "deposits",
            filter: `uid=eq.${currentUser.uid}`,
          },
          async () => {
            await loadDeposits(currentUser.uid);
          }
        )
        .subscribe();
    });

    return () => {
      unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  async function loadDeposits(uid: string) {
    const { data, error } = await supabase
      .from("deposits")
      .select("*")
      .eq("uid", uid)
      .order("id", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    setDeposits(data || []);
  }

  async function submitDeposit() {
    if (!user) {
      router.push("/login");
      return;
    }

    const depositAmount = Number(amount);

    if (!amount || depositAmount <= 0) {
      toast.error("Amount sahi bharo");
      return;
    }

    if (depositAmount < 100) {
      toast.error("Minimum deposit ₹100 hai");
      return;
    }

    if (!file) {
      toast.error("Payment screenshot select karo");
      return;
    }

    setLoading(true);

    try {
      const fileName = `deposit-${user.uid}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("battle-screenshots")
        .upload(fileName, file);

      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("battle-screenshots")
        .getPublicUrl(fileName);

      const { error } = await supabase.from("deposits").insert({
        uid: user.uid,
        amount: depositAmount,
        screenshot: publicUrlData.publicUrl,
        status: "pending",
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setAmount("");
      setFile(null);

      toast.success("Deposit request submit ho gayi ✅");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Deposit submit failed");
    } finally {
      setLoading(false);
    }
  }

  function getStatusStyle(status: string) {
    if (status === "approved") {
      return "bg-green-500/10 text-green-300 border-green-500/30";
    }

    if (status === "rejected") {
      return "bg-red-500/10 text-red-300 border-red-500/30";
    }

    return "bg-yellow-400/10 text-yellow-300 border-yellow-400/30";
  }

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-5">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          <p className="font-bold text-zinc-300">Loading deposit page...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-xl px-4 py-5">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300"
        >
          ← Dashboard
        </button>

        <section className="mb-5 rounded-[28px] border border-green-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-green-400">
            Wallet Recharge
          </p>

          <h1 className="mt-2 text-3xl font-black text-white">Add Money</h1>

          <p className="mt-1 text-sm text-zinc-500">
            UPI payment karo aur screenshot upload karo.
          </p>

          <div className="mt-5 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-300">
              Payment Details
            </p>

            <div className="mt-3 rounded-2xl border border-yellow-400/20 bg-black/60 p-4">
              <p className="text-sm text-zinc-400">UPI ID</p>
              <p className="mt-1 break-all text-2xl font-black text-yellow-400">
                yourupi@upi
              </p>
            </div>

            <p className="mt-3 text-xs leading-5 text-zinc-400">
              Is UPI ID par payment karne ke baad screenshot upload karo.
              Admin approve karega to wallet me balance add ho jayega.
            </p>
          </div>
        </section>

        <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black text-yellow-400">
            Deposit Amount
          </h2>

          <input
            type="number"
            placeholder="Amount enter karo"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 text-white outline-none focus:border-yellow-400"
          />

          <div className="mt-4 grid grid-cols-3 gap-3">
            {quickAmounts.map((value) => (
              <button
                key={value}
                onClick={() => setAmount(String(value))}
                className={`rounded-2xl border py-4 font-black ${
                  Number(amount) === value
                    ? "border-yellow-400 bg-yellow-400 text-black"
                    : "border-zinc-800 bg-black text-zinc-300"
                }`}
              >
                ₹{value}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black text-yellow-400">
            Payment Screenshot
          </h2>

          <label className="mt-4 block rounded-2xl border border-dashed border-zinc-700 bg-black p-5 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            <p className="font-black text-zinc-200">
              {file ? file.name : "Tap to select screenshot"}
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              Payment proof required
            </p>
          </label>
        </section>

        <button
          onClick={submitDeposit}
          disabled={loading}
          className="w-full rounded-2xl bg-green-500 py-4 font-black text-white shadow-lg shadow-green-500/20 disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-[0.99]"
        >
          {loading ? "Submitting..." : "Submit Deposit Request"}
        </button>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Minimum deposit ₹100 hai. Approval ke baad balance wallet me add hoga.
        </p>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
                Realtime
              </p>
              <h2 className="mt-1 text-2xl font-black">Deposit History</h2>
            </div>

            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-400">
              {deposits.length} Requests
            </span>
          </div>

          {deposits.length === 0 ? (
            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 text-center">
              <p className="font-black">No deposit request</p>
              <p className="mt-1 text-sm text-zinc-500">
                Abhi koi deposit request nahi hai.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-zinc-500">
                        Deposit #{deposit.id}
                      </p>
                      <p className="mt-1 text-3xl font-black text-green-400">
                        ₹{deposit.amount}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusStyle(
                        deposit.status
                      )}`}
                    >
                      {deposit.status}
                    </span>
                  </div>

                  {deposit.screenshot && (
                    <a
                      href={deposit.screenshot}
                      target="_blank"
                      className="mt-4 block w-full rounded-2xl border border-zinc-800 bg-black py-3 text-center font-black text-blue-400"
                    >
                      View Screenshot
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}