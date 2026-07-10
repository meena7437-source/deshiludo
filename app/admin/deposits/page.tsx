"use client";

import { useEffect, useMemo, useState } from "react";
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
        {
          event: "*",
          schema: "public",
          table: "deposits",
        },
        async () => {
          await loadDeposits(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function getSignedScreenshot(path: string) {
    if (!path) {
      return "";
    }

    // Agar database me purana full URL saved hai
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    const cleanPath = path.replace(/^\/+/, "");

    const { data, error } = await supabase.storage
      .from("deposits")
      .createSignedUrl(cleanPath, 60 * 60);

    if (error) {
      console.error("Deposit screenshot signed URL error:", error);
      return "";
    }

    return data?.signedUrl || "";
  }

  async function loadDeposits(showLoader = true) {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from("deposits")
        .select("*")
        .order("id", { ascending: false });

      if (error) {
        console.error("Deposit load error:", error);
        toast.error(error.message || "Deposit requests load nahi hui");
        return;
      }

      const depositsWithUrls = await Promise.all(
        (data || []).map(async (deposit) => {
          let screenshotUrl = "";

          if (deposit.screenshot) {
            screenshotUrl = await getSignedScreenshot(deposit.screenshot);
          }

          return {
            ...deposit,
            screenshot_url: screenshotUrl,
          };
        })
      );

      setDeposits(depositsWithUrls);
    } catch (error: any) {
      console.error("Deposit load failed:", error);
      toast.error(error?.message || "Deposit requests load nahi hui");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  async function approveDeposit(deposit: any) {
    if (deposit.status !== "pending") {
      toast.error("Ye request already processed hai");
      return;
    }

    setActionId(deposit.id);

    try {
      const response = await fetch("/api/admin/deposits/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          depositId: deposit.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.message || "Deposit approve nahi hua");
        await loadDeposits(false);
        return;
      }

      toast.success("Deposit approved ✅ Wallet credit ho gaya");
      await loadDeposits(false);
    } catch (error: any) {
      console.error("Deposit approve error:", error);
      toast.error(error?.message || "Deposit approve nahi hua");
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
      const response = await fetch("/api/admin/deposits/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          depositId: deposit.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.message || "Deposit reject nahi hua");
        await loadDeposits(false);
        return;
      }

      toast.success("Deposit rejected");
      await loadDeposits(false);
    } catch (error: any) {
      console.error("Deposit reject error:", error);
      toast.error(error?.message || "Deposit reject nahi hua");
    } finally {
      setActionId(null);
    }
  }

  async function openScreenshot(deposit: any) {
    if (!deposit.screenshot) {
      toast.error("Screenshot available nahi hai");
      return;
    }

    let screenshotUrl = deposit.screenshot_url;

    // Signed URL expire hone par naya URL banao
    if (!screenshotUrl) {
      screenshotUrl = await getSignedScreenshot(deposit.screenshot);
    }

    if (!screenshotUrl) {
      toast.error(
        "Screenshot nahi mila. Ye request purane ya galat bucket me ho sakti hai."
      );
      return;
    }

    window.open(screenshotUrl, "_blank", "noopener,noreferrer");
  }

  const stats = useMemo(() => {
    return {
      all: deposits.length,

      pending: deposits.filter(
        (deposit) => deposit.status === "pending"
      ).length,

      approved: deposits.filter(
        (deposit) => deposit.status === "approved"
      ).length,

      rejected: deposits.filter(
        (deposit) => deposit.status === "rejected"
      ).length,

      approvedAmount: deposits
        .filter((deposit) => deposit.status === "approved")
        .reduce(
          (total, deposit) => total + Number(deposit.amount || 0),
          0
        ),

      pendingAmount: deposits
        .filter((deposit) => deposit.status === "pending")
        .reduce(
          (total, deposit) => total + Number(deposit.amount || 0),
          0
        ),
    };
  }, [deposits]);

  const filteredDeposits =
    filter === "all"
      ? deposits
      : deposits.filter((deposit) => deposit.status === filter);

  function statusClass(status: string) {
    if (status === "approved") {
      return "border-green-500/30 bg-green-500/10 text-green-300";
    }

    if (status === "rejected") {
      return "border-red-500/30 bg-red-500/10 text-red-300";
    }

    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  }

  const filters = [
    {
      key: "all",
      label: "All",
      count: stats.all,
    },
    {
      key: "pending",
      label: "Pending",
      count: stats.pending,
    },
    {
      key: "approved",
      label: "Approved",
      count: stats.approved,
    },
    {
      key: "rejected",
      label: "Rejected",
      count: stats.rejected,
    },
  ];

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <section className="mb-6 rounded-[28px] border border-green-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-green-400">
                Admin Payments
              </p>

              <h1 className="mt-2 text-3xl font-black text-white">
                Deposit Requests
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                User deposits approve ya reject karo.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadDeposits()}
              disabled={loading}
              className="rounded-2xl bg-yellow-400 px-5 py-3 font-black text-black active:scale-95 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
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
                ₹{stats.approvedAmount.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-xs text-blue-300">Pending Amount</p>

              <p className="mt-1 text-2xl font-black text-blue-400">
                ₹{stats.pendingAmount.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              type="button"
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

            <p className="font-bold text-zinc-300">
              Loading deposits...
            </p>
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="font-black text-zinc-300">
              Koi deposit request nahi hai.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDeposits.map((deposit) => (
              <div
                key={deposit.id}
                className="rounded-[26px] border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/30"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-3xl font-black text-green-400">
                        ₹
                        {Number(deposit.amount || 0).toLocaleString(
                          "en-IN"
                        )}
                      </p>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(
                          deposit.status
                        )}`}
                      >
                        {deposit.status || "pending"}
                      </span>
                    </div>

                    <p className="mt-3 break-all text-sm text-zinc-400">
                      UID: {deposit.uid || "Not available"}
                    </p>

                    {deposit.phone && (
                      <p className="mt-2 break-all text-sm text-zinc-400">
                        Phone: {deposit.phone}
                      </p>
                    )}

                    {deposit.utr && (
                      <p className="mt-2 break-all text-sm text-zinc-400">
                        UTR: {deposit.utr}
                      </p>
                    )}

                    {deposit.created_at && (
                      <p className="mt-2 text-xs text-zinc-500">
                        Date:{" "}
                        {new Date(
                          deposit.created_at
                        ).toLocaleString("en-IN")}
                      </p>
                    )}

                    {deposit.screenshot ? (
                      <button
                        type="button"
                        onClick={() => openScreenshot(deposit)}
                        className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-300 active:scale-95"
                      >
                        View Screenshot
                      </button>
                    ) : (
                      <p className="mt-4 text-sm font-bold text-red-400">
                        Screenshot not available
                      </p>
                    )}
                  </div>

                  {deposit.status === "pending" && (
                    <div className="grid grid-cols-2 gap-3 sm:w-64">
                      <button
                        type="button"
                        onClick={() => approveDeposit(deposit)}
                        disabled={actionId === deposit.id}
                        className="rounded-2xl bg-green-500 py-4 font-black text-white active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                      >
                        {actionId === deposit.id
                          ? "Processing..."
                          : "Approve"}
                      </button>

                      <button
                        type="button"
                        onClick={() => rejectDeposit(deposit)}
                        disabled={actionId === deposit.id}
                        className="rounded-2xl bg-red-500 py-4 font-black text-white active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                      >
                        {actionId === deposit.id
                          ? "Processing..."
                          : "Reject"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="mt-6 w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-4 font-black text-zinc-300 active:scale-95"
        >
          Back to Admin
        </button>
      </div>
    </main>
  );
}