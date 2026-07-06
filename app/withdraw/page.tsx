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
      return "bg-green-500/10 text-green-400 border-green-500/30";
    }

    if (status === "rejected") {
      return "bg-red-500/10 text-red-400 border-red-500/30";
    }

    return "bg-yellow-400/10 text-yellow-400 border-yellow-400/30";
  }

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-black text-white px-4 py-6">
        <div className="max-w-xl mx-auto bg-zinc-900 rounded-3xl p-6 border border-zinc-800">
          <p className="font-bold">Loading withdraw page...</p>
          <p className="text-zinc-500 text-sm mt-1">Please wait.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 text-sm text-zinc-400 hover:text-white"
        >
          ← Back to Dashboard
        </button>

        <div className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-5 border border-zinc-800 shadow-xl">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-3xl font-extrabold text-yellow-400">
                Withdraw
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Wallet se UPI par withdraw request bhejo.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-right">
              <p className="text-xs text-zinc-500">Wallet</p>
              <p className="text-xl font-bold text-green-400">₹{wallet}</p>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-5">
            <label className="block text-sm font-semibold mb-2">
              Withdraw Amount
            </label>

            <input
              type="number"
              placeholder="Enter Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800 mb-4 outline-none focus:border-yellow-400"
            />

            <div className="grid grid-cols-3 gap-3">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  onClick={() => setAmount(String(value))}
                  disabled={value > wallet}
                  className={`py-3 rounded-xl font-bold border disabled:opacity-40 ${
                    Number(amount) === value
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "bg-zinc-900 text-white border-zinc-800"
                  }`}
                >
                  ₹{value}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-5">
            <label className="block text-sm font-semibold mb-2">UPI ID</label>

            <input
              type="text"
              placeholder="example@upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800 outline-none focus:border-yellow-400"
            />

            <p className="text-xs text-zinc-500 mt-2">
              Isi UPI ID par admin payment karega.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Withdraw Amount</span>
              <span className="font-bold">₹{Number(amount || 0)}</span>
            </div>

            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Wallet Balance</span>
              <span className="font-bold text-green-400">₹{wallet}</span>
            </div>

            <div className="border-t border-zinc-800 pt-3 mt-3 flex justify-between">
              <span className="text-zinc-400">After Withdraw</span>
              <span
                className={`font-bold ${
                  wallet - Number(amount || 0) < 0
                    ? "text-red-400"
                    : "text-yellow-400"
                }`}
              >
                ₹{wallet - Number(amount || 0)}
              </span>
            </div>
          </div>

          <button
            onClick={submitWithdraw}
            disabled={loading}
            className="w-full bg-yellow-400 text-black py-4 rounded-2xl font-extrabold disabled:bg-zinc-700 disabled:text-zinc-400 active:scale-[0.99]"
          >
            {loading ? "Submitting..." : "Submit Withdraw"}
          </button>

          <p className="text-xs text-zinc-500 text-center mt-4">
            Minimum withdraw ₹100 hai. Request submit hote hi wallet se balance
            deduct ho jayega.
          </p>

          <div className="mt-8">
            <h2 className="text-2xl font-extrabold text-yellow-400 mb-4">
              Withdraw History
            </h2>

            {withdraws.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-center">
                <p className="font-bold">No withdraw request</p>
                <p className="text-zinc-400 text-sm mt-1">
                  Abhi koi withdraw request nahi hai.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {withdraws.map((withdraw) => (
                  <div
                    key={withdraw.id}
                    className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-xs text-zinc-500">
                          Withdraw #{withdraw.id}
                        </p>
                        <p className="text-2xl font-extrabold text-yellow-400 mt-1">
                          ₹{withdraw.amount}
                        </p>
                        <p className="text-sm text-zinc-400 mt-1">
                          UPI: {withdraw.upi_id}
                        </p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${getStatusStyle(
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
          </div>
        </div>
      </div>
    </main>
  );
}