"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";


type Announcement = {
  id: number;
  message: string;
  is_active: boolean;
  updated_at?: string | null;
};

type AnnouncementResponse = {
  success: boolean;
  message?: string;
  announcement?: Announcement | null;
};

export default function DashboardPage() {
  const router = useRouter();

  const [balance, setBalance] = useState(0);
  const [playerDisplay, setPlayerDisplay] = useState("");
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const [announcementActive, setAnnouncementActive] = useState(false);

  useEffect(() => {
    async function loadAnnouncement() {
      try {
        const response = await fetch("/api/admin/announcement", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const result = (await response.json()) as AnnouncementResponse;

        if (
          response.ok &&
          result.success &&
          result.announcement?.is_active === true &&
          result.announcement.message?.trim()
        ) {
          setAnnouncement(result.announcement.message.trim());
          setAnnouncementActive(true);
        } else {
          setAnnouncement("");
          setAnnouncementActive(false);
        }
      } catch (error) {
        console.error("Dashboard announcement load error:", error);
        setAnnouncement("");
        setAnnouncementActive(false);
      }
    }

    loadAnnouncement();
  }, []);

  useEffect(() => {
    let walletChannel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const [{ data: walletData }, { data: userData }] = await Promise.all([
        supabase
          .from("wallets")
          .select("balance")
          .eq("uid", user.uid)
          .maybeSingle(),
        supabase
          .from("users")
          .select("username,name,phone")
          .eq("firebase_uid", user.uid)
          .maybeSingle(),
      ]);

      setBalance(Number(walletData?.balance || 0));

      const username = String(userData?.username || "").trim();
      const name = String(userData?.name || "").trim();
      const phone = String(
        userData?.phone || user.phoneNumber || ""
      ).replace(/\D/g, "");

      if (username) {
        setPlayerDisplay(`@${username}`);
      } else if (name) {
        setPlayerDisplay(name);
      } else if (phone) {
        setPlayerDisplay(`XXXXXX${phone.slice(-4)}`);
      } else {
        setPlayerDisplay("Player");
      }

      walletChannel = supabase
        .channel(`dashboard-mode-wallet-${user.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallets",
            filter: `uid=eq.${user.uid}`,
          },
          (payload: any) => {
            setBalance(Number(payload.new?.balance || 0));
          }
        )
        .subscribe();

      setLoading(false);
    });

    return () => {
      unsubscribe();

      if (walletChannel) {
        supabase.removeChannel(walletChannel);
      }
    };
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#010611] text-white">
        <p className="font-black text-yellow-400">Loading DeshiLudo...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#071426_0%,#020813_38%,#01040b_100%)] pb-28 text-white">
      <header className="sticky top-0 z-40 border-b border-yellow-500/25 bg-[#010611]/95 px-3 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.png"
              alt="DeshiLudo Logo"
              width={58}
              height={58}
              className="h-12 w-12 shrink-0 rounded-full object-contain sm:h-14 sm:w-14"
              priority
            />

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black leading-none text-[#f6b82f] sm:text-3xl">
                DeshiLudo
              </h1>
              <p className="mt-1 truncate text-[10px] text-zinc-400 sm:text-sm">
                Khelo • Jeeto • Kamao
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            className="rounded-2xl border border-yellow-500/35 bg-black/30 px-3 py-2 text-right sm:px-5"
          >
            <p className="text-[9px] text-zinc-400 sm:text-xs">
              Total Wallet
            </p>
            <p className="text-base font-black text-green-400 sm:text-xl">
              ₹{balance}
            </p>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-3 pt-3 sm:px-5">
        <div className="overflow-hidden rounded-xl border border-yellow-400/30 bg-yellow-500/10">
          <div className="flex items-center">
            <div className="shrink-0 border-r border-yellow-400/30 bg-yellow-400 px-3 py-2.5 text-xs font-black text-black">
              📢 सूचना
            </div>

            <div className="min-w-0 flex-1 overflow-hidden px-3 py-2.5">
              {announcementActive ? (
                <div className="dashboard-marquee whitespace-nowrap text-xs font-bold text-yellow-200 sm:text-sm">
                  {announcement}
                </div>
              ) : (
                <p className="truncate text-xs text-zinc-500">
                  अभी कोई सूचना उपलब्ध नहीं है।
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-3 pt-3 sm:px-5">
        <div className="mb-5 rounded-2xl border border-white/10 bg-[#07101d] p-4">
          <p className="text-xs text-zinc-500">Welcome</p>
          <p className="mt-1 text-lg font-black text-white">
            {playerDisplay}
          </p>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <span className="text-yellow-400">➜</span>
          <h2 className="text-base font-black tracking-wide sm:text-xl">
            CHOOSE GAME MODE
          </h2>
          <span className="h-px w-10 bg-gradient-to-r from-yellow-400 to-transparent" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/classic" className="group block">
            <article className="relative min-h-[405px] overflow-hidden rounded-[24px] border-2 border-cyan-300 bg-[linear-gradient(155deg,#071932_0%,#041020_55%,#02050b_100%)] p-5 shadow-[0_0_38px_rgba(34,211,238,0.48),inset_0_0_35px_rgba(14,165,233,0.12)] transition group-hover:-translate-y-1">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_37%,rgba(14,165,233,0.20),transparent_38%)]" />

              <div className="relative flex h-full flex-col">
                <div>
                  <p className="text-center text-4xl font-black italic leading-none text-white">
                    LUDO
                  </p>
                  <p className="mt-1 text-center text-3xl font-black italic text-cyan-400">
                    CLASSIC
                  </p>
                </div>

                <div className="my-8 flex justify-center">
                  <div className="flex h-40 w-48 items-center justify-center rounded-3xl border-2 border-cyan-400/60 bg-cyan-500/10 text-7xl shadow-[0_18px_45px_rgba(6,182,212,0.36)]">
                    🎲
                  </div>
                </div>

                <div className="mt-auto">
                  <p className="text-sm font-bold">2 Players</p>
                  <p className="mt-1 text-sm text-zinc-200">
                    Minimum ₹100
                  </p>

                  <div className="mt-4 flex items-center justify-between rounded-xl border border-blue-300/30 bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-3 text-base font-black shadow-[0_8px_22px_rgba(37,99,235,0.35)]">
                    <span>OPEN CLASSIC</span>
                    <span>›</span>
                  </div>
                </div>
              </div>
            </article>
          </Link>

          <Link href="/ulta" className="group block">
            <article className="relative min-h-[405px] overflow-hidden rounded-[24px] border-2 border-red-300 bg-[linear-gradient(155deg,#26080d_0%,#140509_55%,#02050b_100%)] p-5 shadow-[0_0_40px_rgba(239,68,68,0.50),inset_0_0_35px_rgba(239,68,68,0.12)] transition group-hover:-translate-y-1">
              <span className="absolute right-0 top-0 rounded-bl-xl border-b border-l border-yellow-400/40 bg-red-700 px-3 py-2 text-xs font-black text-yellow-300">
                NEW
              </span>

              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_37%,rgba(239,68,68,0.22),transparent_40%)]" />

              <div className="relative flex h-full flex-col">
                <div>
                  <p className="text-center text-4xl font-black italic leading-none text-white">
                    ULTA
                  </p>
                  <p className="mt-1 text-center text-3xl font-black italic text-red-400">
                    LUDO
                  </p>
                </div>

                <div className="my-8 flex justify-center">
                  <div className="flex h-40 w-48 items-center justify-center rounded-3xl border-2 border-red-400/60 bg-red-500/10 text-7xl shadow-[0_18px_45px_rgba(239,68,68,0.38)]">
                    🔄
                  </div>
                </div>

                <div className="mt-auto">
                  <p className="text-sm font-bold">2 Players</p>
                  <p className="mt-1 text-sm text-zinc-200">
                    Minimum ₹100
                  </p>

                  <div className="mt-4 flex items-center justify-between rounded-xl border border-red-300/30 bg-gradient-to-r from-red-700 to-red-500 px-5 py-3 text-base font-black shadow-[0_8px_22px_rgba(220,38,38,0.35)]">
                    <span>OPEN ULTA</span>
                    <span>›</span>
                  </div>
                </div>
              </div>
            </article>
          </Link>

          <Link href="/teamup" className="group block">
            <article className="relative min-h-[405px] overflow-hidden rounded-[24px] border-2 border-yellow-300 bg-[linear-gradient(155deg,#241803_0%,#100b02_55%,#02050b_100%)] p-5 shadow-[0_0_40px_rgba(234,179,8,0.46),inset_0_0_35px_rgba(234,179,8,0.12)] transition group-hover:-translate-y-1">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_37%,rgba(234,179,8,0.20),transparent_40%)]" />

              <div className="relative flex h-full flex-col">
                <div>
                  <div className="text-center text-4xl">🤝</div>
                  <p className="text-center text-4xl font-black italic leading-none text-white">
                    TEAM UP
                  </p>
                  <p className="mt-1 text-center text-3xl font-black italic text-yellow-400">
                    LUDO
                  </p>
                </div>

                <div className="my-8 flex justify-center">
                  <div className="flex h-40 w-48 items-center justify-center rounded-3xl border-2 border-yellow-400/60 bg-yellow-500/10 text-7xl shadow-[0_18px_45px_rgba(234,179,8,0.32)]">
                    👥
                  </div>
                </div>

                <div className="mt-auto">
                  <p className="text-sm font-bold">2 vs 2 Team Battle</p>
                  <p className="mt-1 text-sm text-zinc-200">
                    Coming Soon
                  </p>

                  <div className="mt-4 rounded-xl border border-yellow-400/60 bg-yellow-500/10 px-5 py-3 text-center text-base font-black text-yellow-100">
                    COMING SOON
                  </div>
                </div>
              </div>
            </article>
          </Link>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-[#010611]/95 backdrop-blur-xl">
          <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2 p-3">
            <Link
              href="/deposit"
              className="rounded-xl border border-green-500/30 bg-green-500/10 py-3 text-center text-[11px] font-black text-green-400"
            >
              Deposit
            </Link>

            <Link
              href="/withdraw"
              className="rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-center text-[11px] font-black text-red-400"
            >
              Withdraw
            </Link>

            <Link
              href="/rules"
              className="rounded-xl border border-blue-500/30 bg-blue-500/10 py-3 text-center text-[11px] font-black text-blue-400"
            >
              Rules
            </Link>

            <Link
              href="/profile"
              className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 py-3 text-center text-[11px] font-black text-yellow-400"
            >
              Profile
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        .dashboard-marquee {
          display: inline-block;
          min-width: 100%;
          padding-left: 100%;
          animation: dashboardMarquee 18s linear infinite;
        }

        @keyframes dashboardMarquee {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </main>
  );
}
