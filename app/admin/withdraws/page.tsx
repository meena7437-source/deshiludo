"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";

type Withdraw = {
  id: number;
  uid: string;
  phone: string;
  amount: number;
  upi_id: string;
  status: string;
  created_at: string;
};

export default function AdminWithdrawsPage() {
  const router = useRouter();

  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadWithdraws();

    const channel = supabase
      .channel("admin-withdraws-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdraws" },
        async () => {
          await loadWithdraws(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadWithdraws(showLoader = true) {
    if (showLoader) setLoading(true);

    const { data, error } = await supabase
      .from("withdraws")
      .select("*")
      .order("created_at", { ascending: false });

    if (showLoader) setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setWithdraws(data || []);
  }

  const filteredWithdraws =
    filter === "all"
      ? withdraws
      : withdraws.filter((w) => w.status === filter);

  function statusClass(status: string) {
    if (status === "approved") return "bg-green-500/20 text-green-400";
    if (status === "rejected") return "bg-red-500/20 text-red-400";
    return "bg-yellow-500/20 text-yellow-400";
  }

  async function approveWithdraw(withdraw: Withdraw) {
    if (withdraw.status !== "pending") {
      toast.error("Ye request already processed hai");
      return;
    }

    setLoadingId(withdraw.id);

    try {
      const { error } = await supabase
        .from("withdraws")
        .update({ status: "approved" })
        .eq("id", withdraw.id)
        .eq("status", "pending");

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Withdraw Approved ✅");
      await loadWithdraws(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Approve failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function rejectWithdraw(withdraw: Withdraw) {
    if (withdraw.status !== "pending") {
      toast.error("Ye request already processed hai");
      return;
    }

    setLoadingId(withdraw.id);

    try {
      const { error: refundError } = await supabase.rpc("add_wallet_balance", {
        user_id_input: withdraw.uid,
        amount_input: Number(withdraw.amount),
      });

      if (refundError) {
        toast.error(refundError.message);
        return;
      }

      const { error: withdrawError } = await supabase
        .from("withdraws")
        .update({ status: "rejected" })
        .eq("id", withdraw.id)
        .eq("status", "pending");

      if (withdrawError) {
        toast.error(withdrawError.message);
        return;
      }

      toast.success("Withdraw Rejected ✅ Refund Done");
      await loadWithdraws(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Reject failed");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 sm:p-5">
      <div className="max-w-4xl mx-auto">
        <div className="bg-zinc-900 rounded-2xl p-5 sm:p-6 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h1 className="text-3xl font-bold text-yellow-400">
                Withdraw Requests
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                User withdraws approve ya reject karo.
              </p>
            </div>

            <button
              onClick={() => loadWithdraws()}
              className="bg-yellow-400 text-black font-bold px-5 py-2 rounded-xl active:scale-95 transition"
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {["all", "pending", "approved"].map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-xl p-3 font-bold capitalize ${
                  filter === item
                    ? "bg-yellow-400 text-black"
                    : "bg-zinc-800 text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="bg-zinc-800 rounded-xl p-6 text-center">
              Loading withdraws...
            </div>
          ) : filteredWithdraws.length === 0 ? (
            <div className="bg-zinc-800 rounded-xl p-6 text-center text-zinc-400">
              Koi withdraw request nahi hai.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredWithdraws.map((w) => (
                <div
                  key={w.id}
                  className="bg-zinc-800 rounded-xl p-4 border border-zinc-700"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-bold text-2xl">₹{w.amount}</p>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${statusClass(
                            w.status
                          )}`}
                        >
                          {w.status}
                        </span>
                      </div>

                      <p className="text-sm text-zinc-400">ID: #{w.id}</p>
                      <p className="text-sm text-zinc-400">Phone: {w.phone}</p>
                      <p className="text-sm text-zinc-400 break-all">
                        UPI: {w.upi_id}
                      </p>
                      <p className="text-sm text-zinc-500 break-all">
                        UID: {w.uid}
                      </p>
                    </div>

                    {w.status === "pending" && (
                      <div className="grid grid-cols-2 sm:w-56 gap-3">
                        <button
                          onClick={() => approveWithdraw(w)}
                          disabled={loadingId === w.id}
                          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl disabled:bg-zinc-700 active:scale-95 transition"
                        >
                          {loadingId === w.id ? "..." : "Approve"}
                        </button>

                        <button
                          onClick={() => rejectWithdraw(w)}
                          disabled={loadingId === w.id}
                          className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl disabled:bg-zinc-700 active:scale-95 transition"
                        >
                          {loadingId === w.id ? "..." : "Reject"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => router.push("/admin")}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl mt-6 active:scale-95 transition"
          >
            Back to Admin
          </button>
        </div>
      </div>
    </main>
  );
}