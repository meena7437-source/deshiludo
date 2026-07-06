"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";

export default function AdminDepositPage() {
  const router = useRouter();

  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadDeposits();

    const channel = supabase
      .channel("admin-deposit-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deposits" },
        async () => {
          await loadDeposits(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadDeposits(showLoader = true) {
    if (showLoader) setLoading(true);

    const { data, error } = await supabase
      .from("deposits")
      .select("*")
      .order("id", { ascending: false });

    if (showLoader) setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setDeposits(data || []);
  }

  const filteredDeposits =
    filter === "all"
      ? deposits
      : deposits.filter((deposit) => deposit.status === filter);

  function statusClass(status: string) {
    if (status === "approved") return "bg-green-500/20 text-green-400";
    if (status === "rejected") return "bg-red-500/20 text-red-400";
    return "bg-yellow-500/20 text-yellow-400";
  }

  async function approveDeposit(deposit: any) {
    if (deposit.status !== "pending") {
      toast.error("Ye request already processed hai");
      return;
    }

    setActionId(deposit.id);

    try {
      const { error: walletError } = await supabase.rpc("add_wallet_balance", {
        user_id_input: deposit.uid,
        amount_input: Number(deposit.amount),
      });

      if (walletError) {
        toast.error(walletError.message);
        return;
      }

      const { error } = await supabase
        .from("deposits")
        .update({ status: "approved" })
        .eq("id", deposit.id)
        .eq("status", "pending");

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Deposit approved ✅ Wallet credit ho gaya");
      await loadDeposits(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Approve failed");
    } finally {
      setActionId(null);
    }
  }

  async function rejectDeposit(deposit: any) {
    if (deposit.status !== "pending") {
      toast.error("Ye request already processed hai");
      return;
    }

    setActionId(deposit.id);

    try {
      const { error } = await supabase
        .from("deposits")
        .update({ status: "rejected" })
        .eq("id", deposit.id)
        .eq("status", "pending");

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Deposit rejected");
      await loadDeposits(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Reject failed");
    } finally {
      setActionId(null);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 sm:p-5">
      <div className="max-w-4xl mx-auto">
        <div className="bg-zinc-900 rounded-2xl p-5 sm:p-6 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h1 className="text-3xl font-bold text-yellow-400">
                Deposit Requests
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                User deposits approve ya reject karo.
              </p>
            </div>

            <button
              onClick={() => loadDeposits()}
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
              Loading deposits...
            </div>
          ) : filteredDeposits.length === 0 ? (
            <div className="bg-zinc-800 rounded-xl p-6 text-center text-zinc-400">
              Koi deposit request nahi hai.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDeposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="bg-zinc-800 rounded-xl p-4 border border-zinc-700"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-bold text-2xl text-white">
                          ₹{deposit.amount}
                        </p>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${statusClass(
                            deposit.status
                          )}`}
                        >
                          {deposit.status}
                        </span>
                      </div>

                      <p className="text-sm text-zinc-400 break-all">
                        UID: {deposit.uid}
                      </p>

                      {deposit.screenshot && (
                        <a
                          href={deposit.screenshot}
                          target="_blank"
                          className="text-blue-400 text-sm inline-block font-bold"
                        >
                          View Screenshot
                        </a>
                      )}
                    </div>

                    {deposit.status === "pending" && (
                      <div className="grid grid-cols-2 sm:w-56 gap-3">
                        <button
                          onClick={() => approveDeposit(deposit)}
                          disabled={actionId === deposit.id}
                          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl disabled:bg-zinc-700 active:scale-95 transition"
                        >
                          {actionId === deposit.id ? "..." : "Approve"}
                        </button>

                        <button
                          onClick={() => rejectDeposit(deposit)}
                          disabled={actionId === deposit.id}
                          className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl disabled:bg-zinc-700 active:scale-95 transition"
                        >
                          {actionId === deposit.id ? "..." : "Reject"}
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