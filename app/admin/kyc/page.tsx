"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";

export default function AdminKycPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    loadUsers();

    const channel = supabase
      .channel("admin-kyc-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kyc" },
        async () => {
          await loadUsers(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadUsers(showLoader = true) {
    if (showLoader) setLoading(true);

    try {
      const res = await fetch("/api/admin/kyc/list", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!data?.success) {
        toast.error(data?.message || "KYC load failed");
        return;
      }

      setUsers(data.users || []);
    } catch (err: any) {
      toast.error(err?.message || "KYC load failed");
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function openDocument(path: string, key: string) {
    if (!path) {
      toast.error("Document path missing");
      return;
    }

    setViewingId(key);

    try {
      const res = await fetch("/api/admin/kyc/signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path }),
      });

      const data = await res.json();

      if (!data?.success || !data?.url) {
        toast.error(data?.message || "Signed URL failed");
        return;
      }

      window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err?.message || "Document open failed");
    } finally {
      setViewingId(null);
    }
  }

  async function updateKyc(user: any, status: "approved" | "rejected") {
    if (!user?.uid) {
      toast.error("User UID missing");
      return;
    }

    setActionId(user.uid);

    try {
      const apiUrl =
        status === "approved"
          ? "/api/admin/kyc/approve"
          : "/api/admin/kyc/reject";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid: user.uid }),
      });

      const data = await res.json();

      if (!data?.success) {
        toast.error(data?.message || "KYC update failed");
        return;
      }

      toast.success(data.message);
      await loadUsers(false);
    } catch (err: any) {
      toast.error(err?.message || "KYC update failed");
    } finally {
      setActionId(null);
    }
  }

  const stats = useMemo(() => {
    return {
      all: users.length,
      pending: users.filter((u) => u.status === "pending").length,
      approved: users.filter((u) => u.status === "approved").length,
      rejected: users.filter((u) => u.status === "rejected").length,
    };
  }, [users]);

  const filteredUsers =
    filter === "all" ? users : users.filter((u) => u.status === filter);

  const filters = [
    { key: "pending", label: "Pending", count: stats.pending },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "rejected", label: "Rejected", count: stats.rejected },
    { key: "all", label: "All", count: stats.all },
  ];

  function statusClass(status: string) {
    if (status === "approved")
      return "border-green-500/30 bg-green-500/10 text-green-300";
    if (status === "rejected")
      return "border-red-500/30 bg-red-500/10 text-red-300";

    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  }

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-5xl px-3 py-4">
        <section className="mb-4 rounded-[24px] border border-purple-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-400">
                Admin Verification
              </p>
              <h1 className="mt-2 text-2xl font-black text-white">
                KYC Requests
              </h1>
              <p className="mt-1 text-xs text-zinc-500">
                Aadhaar aur PAN private signed URL se verify karo.
              </p>
            </div>

            <button
              onClick={() => loadUsers()}
              className="rounded-xl bg-yellow-400 px-4 py-2 text-xs font-black text-black"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3">
              <p className="text-[10px] text-yellow-300">Pending</p>
              <p className="mt-1 text-xl font-black text-yellow-400">
                {stats.pending}
              </p>
            </div>
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3">
              <p className="text-[10px] text-green-300">Approved</p>
              <p className="mt-1 text-xl font-black text-green-400">
                {stats.approved}
              </p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-[10px] text-red-300">Rejected</p>
              <p className="mt-1 text-xl font-black text-red-400">
                {stats.rejected}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/60 p-3">
              <p className="text-[10px] text-zinc-500">Total</p>
              <p className="mt-1 text-xl font-black text-white">
                {stats.all}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black ${
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
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="font-bold text-zinc-300">Loading KYC...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="font-black text-zinc-300">
              Koi KYC request nahi hai.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.uid || user.id}
                className="rounded-[22px] border border-zinc-800 bg-zinc-950 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black text-white">
                        {user.phone || "No Phone"}
                      </p>

                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass(
                          user.status
                        )}`}
                      >
                        {user.status || "pending"}
                      </span>
                    </div>

                    <p className="mt-2 break-all text-[11px] text-zinc-500">
                      UID: {user.uid}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {user.aadhaar_path ? (
                        <button
                          onClick={() =>
                            openDocument(
                              user.aadhaar_path,
                              `${user.uid}-aadhaar`
                            )
                          }
                          disabled={viewingId === `${user.uid}-aadhaar`}
                          className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-black text-blue-300 disabled:opacity-50"
                        >
                          {viewingId === `${user.uid}-aadhaar`
                            ? "Opening..."
                            : "View Aadhaar"}
                        </button>
                      ) : (
                        <span className="rounded-xl border border-zinc-800 bg-black px-4 py-2 text-xs font-bold text-zinc-500">
                          Aadhaar Missing
                        </span>
                      )}

                      {user.pan_path ? (
                        <button
                          onClick={() =>
                            openDocument(user.pan_path, `${user.uid}-pan`)
                          }
                          disabled={viewingId === `${user.uid}-pan`}
                          className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-black text-blue-300 disabled:opacity-50"
                        >
                          {viewingId === `${user.uid}-pan`
                            ? "Opening..."
                            : "View PAN"}
                        </button>
                      ) : (
                        <span className="rounded-xl border border-zinc-800 bg-black px-4 py-2 text-xs font-bold text-zinc-500">
                          PAN Missing
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:w-60">
                    <button
                      onClick={() => updateKyc(user, "approved")}
                      disabled={actionId === user.uid}
                      className="rounded-xl bg-green-500 py-3 text-sm font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                      {actionId === user.uid ? "..." : "Approve"}
                    </button>

                    <button
                      onClick={() => updateKyc(user, "rejected")}
                      disabled={actionId === user.uid}
                      className="rounded-xl bg-red-500 py-3 text-sm font-black text-white disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                      {actionId === user.uid ? "..." : "Reject"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link href="/admin">
          <button className="mt-5 w-full rounded-xl border border-zinc-800 bg-zinc-950 py-3 text-sm font-black text-zinc-300">
            Back to Admin
          </button>
        </Link>
      </div>
    </main>
  );
}