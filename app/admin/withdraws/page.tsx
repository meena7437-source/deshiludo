"use client";

import { useEffect, useMemo, useState } from "react";
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

  async function approveWithdraw(withdraw: Withdraw) {
    if (withdraw.status !== "pending") {
      toast.error("Ye request already processed hai");
      return;
    }

    setLoadingId(withdraw.id);

    try {
      const res = await fetch("/api/admin/withdraws/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          withdrawId: withdraw.id,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        toast.error(result.message || "Approve failed");
        await loadWithdraws(false);
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
      const res = await fetch("/api/admin/withdraws/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          withdrawId: withdraw.id,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        toast.error(result.message || "Reject failed");
        await loadWithdraws(false);
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

  const stats = useMemo(() => {
    return {
      all: withdraws.length,
      pending: withdraws.filter((w) => w.status === "pending").length,
      approved: withdraws.filter((w) => w.status === "approved").length,
      rejected: withdraws.filter((w) => w.status === "rejected").length,
      approvedAmount: withdraws
        .filter((w) => w.status === "approved")
        .reduce((sum, w) => sum + Number(w.amount || 0), 0),
      pendingAmount: withdraws
        .filter((w) => w.status === "pending")
        .reduce((sum, w) => sum + Number(w.amount || 0), 0),
    };
  }, [withdraws]);

  const filteredWithdraws =
    filter === "all"
      ? withdraws
      : withdraws.filter((w) => w.status === filter);

  function statusClass(status: string) {
    if (status === "approved")
      return "border-green-500/30 bg-green-500/10 text-green-300";
    if (status === "rejected")
      return "border-red-500/30 bg-red-500/10 text-red-300";

    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  }

  function formatDate(dateValue: string) {
    if (!dateValue) return "No date";

    return new Date(dateValue).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const filters = [
    { key: "all", label: "All", count: stats.all },
    { key: "pending", label: "Pending", count: stats.pending },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "rejected", label: "Rejected", count: stats.rejected },
  ];

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <section className="mb-6 rounded-[28px] border border-red-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-400">
                Admin Payments
              </p>

              <h1 className="mt-2 text-3xl font-black text-white">
                Withdraw Requests
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                User withdraws approve ya reject karo.
              </p>
            </div>

            <button
              onClick={() => loadWithdraws()}
              className="rounded-2xl bg-yellow-400 px-5 py-3 font-black text-black active:scale-95"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
              <p className="text-xs text-zinc-500">Total Requests</p>
              <p className="mt-1 text-2xl font-black text-yellow-400">
                {stats.all}
              </p>
            </div>

            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
              <p className="text-xs text-yellow-300">Pending</p>
              <p className="mt-1 text-2xl font-black text-yellow-400">
                {stats.pending}
              </p>
            </div>

            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-xs text-green-300">Approved Amount</p>
              <p className="mt-1 text-2xl font-black text-green-400">
                ₹{stats.approvedAmount}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-xs text-blue-300">Pending Amount</p>
              <p className="mt-1 text-2xl font-black text-blue-400">
                ₹{stats.pendingAmount}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black ${
                filter === item.key
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400"
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
            <p className="font-bold text-zinc-300">Loading withdraws...</p>
          </div>
        ) : filteredWithdraws.length === 0 ? (
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="font-black text-zinc-300">
              Koi withdraw request nahi hai.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWithdraws.map((w) => (
              <div
                key={w.id}
                className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/30"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-3xl font-black text-yellow-400">
                        ₹{w.amount}
                      </p>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(
                          w.status
                        )}`}
                      >
                        {w.status}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <p className="text-zinc-400">ID: #{w.id}</p>
                      <p className="text-zinc-400">Phone: {w.phone}</p>
                      <p className="break-all text-zinc-300">
                        UPI:{" "}
                        <span className="font-black text-green-300">
                          {w.upi_id}
                        </span>
                      </p>
                      <p className="break-all text-zinc-500">UID: {w.uid}</p>
                      <p className="text-zinc-500">
                        Date: {formatDate(w.created_at)}
                      </p>
                    </div>
                  </div>

                  {w.status === "pending" && (
                    <div className="grid grid-cols-2 gap-3 sm:w-64">
                      <button
                        onClick={() => approveWithdraw(w)}
                        disabled={loadingId === w.id}
                        className="rounded-2xl bg-green-500 py-4 font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-95"
                      >
                        {loadingId === w.id ? "..." : "Approve"}
                      </button>

                      <button
                        onClick={() => rejectWithdraw(w)}
                        disabled={loadingId === w.id}
                        className="rounded-2xl bg-red-500 py-4 font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-95"
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
          className="mt-6 w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-4 font-black text-zinc-300 active:scale-95"
        >
          Back to Admin
        </button>
      </div>
    </main>
  );
}