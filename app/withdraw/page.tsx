"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function WithdrawPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState(0);
  const [withdraws, setWithdraws] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

  useEffect(() => {
    let walletChannel: any = null;
    let withdrawChannel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);
      await loadWallet(currentUser.uid);
      await loadWithdraws(currentUser.uid);
      setPageLoading(false);

      walletChannel = supabase
        .channel(`withdraw-wallet-realtime-${currentUser.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallets",
            filter: `uid=eq.${currentUser.uid}`,
          },
          async () => {
            await loadWallet(currentUser.uid);
          }
        )
        .subscribe();

      withdrawChannel = supabase
        .channel(`withdraw-history-realtime-${currentUser.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "withdraws",
            filter: `uid=eq.${currentUser.uid}`,
          },
          async () => {
            await loadWithdraws(currentUser.uid);
          }
        )
        .subscribe();
    });

    return () => {
      unsubscribe();
      if (walletChannel) supabase.removeChannel(walletChannel);
      if (withdrawChannel) supabase.removeChannel(withdrawChannel);
    };
  }, [router]);

  async function loadWallet(uid: string) {
    const { data, error } = await supabase
      .from("wallets")
      .select("balance")
      .eq("uid", uid)
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setWallet(Number(data?.balance || 0));
  }

  async function loadWithdraws(uid: string) {
    const { data, error } = await supabase
      .from("withdraws")
      .select("*")
      .eq("uid", uid)
      .order("id", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    setWithdraws(data || []);
  }

  async function submitWithdraw() {
    if (!user) {
      router.push("/login");
      return;
    }

    const withdrawAmount = Number(amount);

    if (!amount || withdrawAmount <= 0) {
      toast.error("Enter valid amount");
      return;
    }

    if (withdrawAmount < 100) {
      toast.error("Minimum withdraw ₹100 hai");
      return;
    }

    if (!upiId.trim()) {
      toast.error("Enter UPI ID");
      return;
    }

    if (!upiId.includes("@")) {
      toast.error("Valid UPI ID enter karo");
      return;
    }

    if (withdrawAmount > wallet) {
      toast.error("Insufficient Balance");
      return;
    }

    setLoading(true);

    try {
      const newBalance = wallet - withdrawAmount;

      const { error: walletError } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("uid", user.uid);

      if (walletError) {
        toast.error(walletError.message);
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("phone")
        .eq("firebase_uid", user.uid)
        .single();

      const { error: withdrawError } = await supabase.from("withdraws").insert({
        uid: user.uid,
        phone: userData?.phone || user.phoneNumber,
        amount: withdrawAmount,
        upi_id: upiId.trim(),
        status: "pending",
      });

      if (withdrawError) {
        await supabase
          .from("wallets")
          .update({ balance: wallet })
          .eq("uid", user.uid);

        toast.error(withdrawError.message);
        return;
      }

      toast.success("Withdraw Request Submitted ✅");
      setAmount("");
      setUpiId("");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Withdraw submit failed");
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
          <p className="font-bold text-zinc-300">Loading withdraw page...</p>
        </div>
      </main>
    );
  }

  const withdrawAmount = Number(amount || 0);
  const afterWithdraw = wallet - withdrawAmount;

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-xl px-4 py-5">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300"
        >
          ← Dashboard
        </button>

        <section className="mb-5 rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            Wallet Payout
          </p>

          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-white">Withdraw</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Wallet se UPI par request bhejo.
              </p>
            </div>

            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-right">
              <p className="text-xs text-green-300">Wallet</p>
              <p className="text-2xl font-black text-green-400">₹{wallet}</p>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black text-yellow-400">
            Withdraw Amount
          </h2>

          <input
            type="number"
            placeholder="Enter Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 text-white outline-none focus:border-yellow-400"
          />

          <div className="mt-4 grid grid-cols-3 gap-3">
            {quickAmounts.map((value) => (
              <button
                key={value}
                onClick={() => setAmount(String(value))}
                disabled={value > wallet}
                className={`rounded-2xl border py-4 font-black disabled:opacity-40 ${
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
          <h2 className="text-xl font-black text-yellow-400">UPI ID</h2>

          <input
            type="text"
            placeholder="example@upi"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 text-white outline-none focus:border-yellow-400"
          />

          <p className="mt-2 text-xs text-zinc-500">
            Isi UPI ID par admin payment karega.
          </p>
        </section>

        <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="mb-4 text-xl font-black text-yellow-400">
            Withdraw Summary
          </h2>

          <div className="space-y-3">
            <div className="flex justify-between rounded-2xl border border-zinc-800 bg-black p-4">
              <span className="text-zinc-400">Withdraw Amount</span>
              <span className="font-black">₹{withdrawAmount}</span>
            </div>

            <div className="flex justify-between rounded-2xl border border-zinc-800 bg-black p-4">
              <span className="text-zinc-400">Wallet Balance</span>
              <span className="font-black text-green-400">₹{wallet}</span>
            </div>

            <div className="flex justify-between rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
              <span className="text-zinc-300">After Withdraw</span>
              <span
                className={`font-black ${
                  afterWithdraw < 0 ? "text-red-400" : "text-yellow-400"
                }`}
              >
                ₹{afterWithdraw}
              </span>
            </div>
          </div>
        </section>

        <button
          onClick={submitWithdraw}
          disabled={loading}
          className="w-full rounded-2xl bg-yellow-400 py-4 font-black text-black shadow-lg shadow-yellow-400/20 disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-[0.99]"
        >
          {loading ? "Submitting..." : "Submit Withdraw"}
        </button>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Minimum withdraw ₹100 hai. Request submit hote hi wallet se balance
          deduct ho jayega.
        </p>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
                Realtime
              </p>
              <h2 className="mt-1 text-2xl font-black">Withdraw History</h2>
            </div>

            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-400">
              {withdraws.length} Requests
            </span>
          </div>

          {withdraws.length === 0 ? (
            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 text-center">
              <p className="font-black">No withdraw request</p>
              <p className="mt-1 text-sm text-zinc-500">
                Abhi koi withdraw request nahi hai.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdraws.map((withdraw) => (
                <div
                  key={withdraw.id}
                  className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-zinc-500">
                        Withdraw #{withdraw.id}
                      </p>

                      <p className="mt-1 text-3xl font-black text-yellow-400">
                        ₹{withdraw.amount}
                      </p>

                      <p className="mt-1 break-all text-sm text-zinc-400">
                        UPI: {withdraw.upi_id}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusStyle(
                        withdraw.status
                      )}`}
                    >
                      {withdraw.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}