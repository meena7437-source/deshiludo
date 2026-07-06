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
          <p className="font-bold">Loading deposit page...</p>
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
          <div className="mb-5">
            <h1 className="text-3xl font-extrabold text-yellow-400">
              Add Money
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              UPI payment karo aur screenshot upload karo.
            </p>
          </div>

          <div className="bg-zinc-950 border border-yellow-400/30 rounded-2xl p-4 mb-5">
            <p className="text-sm text-zinc-400">Payment Details</p>
            <p className="text-xl font-extrabold text-yellow-400 mt-1">
              UPI ID: yourupi@upi
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Is UPI ID par payment karne ke baad screenshot upload karo. Admin
              approve karega to wallet me balance add ho jayega.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-5">
            <label className="block text-sm font-semibold mb-2">
              Deposit Amount
            </label>

            <input
              type="number"
              placeholder="Amount enter karo"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl mb-4 outline-none focus:border-yellow-400"
            />

            <div className="grid grid-cols-3 gap-3">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  onClick={() => setAmount(String(value))}
                  className={`py-3 rounded-xl font-bold border ${
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
            <label className="block text-sm font-semibold mb-2">
              Payment Screenshot
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl"
            />

            {file && (
              <p className="text-xs text-green-400 mt-2">
                Selected: {file.name}
              </p>
            )}
          </div>

          <button
            onClick={submitDeposit}
            disabled={loading}
            className="w-full bg-green-500 text-white font-extrabold py-4 rounded-2xl disabled:bg-zinc-700 disabled:text-zinc-400 active:scale-[0.99]"
          >
            {loading ? "Submitting..." : "Submit Deposit Request"}
          </button>

          <p className="text-xs text-zinc-500 text-center mt-4">
            Minimum deposit ₹100 hai. Approval ke baad balance wallet me add
            hoga.
          </p>

          <div className="mt-8">
            <h2 className="text-2xl font-extrabold text-yellow-400 mb-4">
              Deposit History
            </h2>

            {deposits.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-center">
                <p className="font-bold">No deposit request</p>
                <p className="text-zinc-400 text-sm mt-1">
                  Abhi koi deposit request nahi hai.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {deposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-xs text-zinc-500">
                          Deposit #{deposit.id}
                        </p>
                        <p className="text-2xl font-extrabold text-green-400 mt-1">
                          ₹{deposit.amount}
                        </p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${getStatusStyle(
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
                        className="mt-4 block w-full text-center bg-zinc-900 border border-zinc-800 text-blue-400 font-bold py-3 rounded-xl"
                      >
                        View Screenshot
                      </a>
                    )}
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