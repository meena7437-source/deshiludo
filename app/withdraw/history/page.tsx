"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { supabase } from "../../../lib/supabase";

type Withdraw = {
  id: number;
  uid: string;
  amount: number;
  upi_id: string;
  status: string;
  created_at: string;
};

export default function WithdrawHistoryPage() {
  const router = useRouter();
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("withdraws")
        .select("*")
        .eq("uid", user.uid)
        .order("created_at", { ascending: false });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      setWithdraws(data || []);
      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white p-5">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-yellow-400 mb-6">
          Withdraw History
        </h1>

        {loading && <p className="text-zinc-400">Loading...</p>}

        {!loading && withdraws.length === 0 && (
          <p className="text-zinc-400">No withdraw request found.</p>
        )}

        <div className="space-y-4">
          {withdraws.map((w) => (
            <div
              key={w.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
            >
              <p><b>Request ID:</b> #{w.id}</p>
              <p><b>Amount:</b> ₹{w.amount}</p>
              <p><b>UPI:</b> {w.upi_id}</p>
              <p>
                <b>Status:</b>{" "}
                <span
                  className={
                    w.status === "approved"
                      ? "text-green-400"
                      : w.status === "rejected"
                      ? "text-red-400"
                      : "text-yellow-400"
                  }
                >
                  {w.status}
                </span>
              </p>
              <p className="text-zinc-400 text-sm mt-2">
                {new Date(w.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push("/withdraw")}
          className="mt-6 bg-yellow-400 text-black font-bold px-5 py-3 rounded-lg"
        >
          Back to Withdraw
        </button>
      </div>
    </main>
  );
}