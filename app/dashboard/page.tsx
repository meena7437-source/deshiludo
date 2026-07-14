"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

type Battle = {
  id: number;
  amount: number;
  status: string;
  room_code?: string | null;
  game_type?: "classic" | "ulta" | "teamup" | null;

  creator_uid: string;
  joiner_uid?: string | null;

  creator_name?: string | null;
  joiner_name?: string | null;

  creator_phone?: string | null;
  joiner_phone?: string | null;

  created_at: string;
};

type PlayerProfile = {
  username: string;
  name: string;
  phone: string;
};

type Announcement = {
  id: number;
  message: string;
  is_active: boolean;
  updated_at?: string | null;
};

function MiniLudoBoard({
  tone = "classic",
}: {
  tone?: "classic" | "ulta" | "team";
}) {
  const frame =
    tone === "ulta"
      ? "border-red-400/70 shadow-[0_18px_45px_rgba(239,68,68,0.38)]"
      : tone === "team"
        ? "border-yellow-400/70 shadow-[0_18px_45px_rgba(234,179,8,0.32)]"
        : "border-cyan-400/70 shadow-[0_18px_45px_rgba(6,182,212,0.36)]";

  return (
    <div
      className={`relative mx-auto h-36 w-44 [perspective:700px] sm:h-44 sm:w-52 ${tone === "ulta" ? "mt-1" : ""}`}
    >
      {tone === "ulta" && (
        <>
          <span className="absolute -left-5 top-4 z-20 text-5xl font-black text-red-400 drop-shadow-[0_0_14px_rgba(248,113,113,0.8)]">
            ↶
          </span>
          <span className="absolute -right-4 bottom-1 z-20 text-5xl font-black text-red-400 drop-shadow-[0_0_14px_rgba(248,113,113,0.8)]">
            ↷
          </span>
        </>
      )}

      <div
        className={`absolute inset-x-3 bottom-2 top-5 rotate-x-[58deg] rotate-z-[-2deg] overflow-hidden rounded-xl border-2 bg-white ${frame}`}
      >
        <div className="grid h-full grid-cols-3 grid-rows-3 gap-[2px] bg-zinc-200 p-[3px]">
          <div className="relative bg-blue-500">
            <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200 ring-2 ring-white/80" />
          </div>
          <div className="grid grid-cols-3 gap-[1px] bg-white p-[2px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={`t${i}`}
                className={i % 3 === 1 ? "bg-green-400" : "bg-zinc-200"}
              />
            ))}
          </div>
          <div className="relative bg-red-500">
            <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-200 ring-2 ring-white/80" />
          </div>
          <div className="grid grid-cols-3 gap-[1px] bg-white p-[2px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={`l${i}`}
                className={i % 3 === 1 ? "bg-blue-400" : "bg-zinc-200"}
              />
            ))}
          </div>
          <div className="relative overflow-hidden bg-white">
            <div className="absolute inset-0 bg-[conic-gradient(#ef4444_0_25%,#22c55e_0_50%,#eab308_0_75%,#3b82f6_0)]" />
          </div>
          <div className="grid grid-cols-3 gap-[1px] bg-white p-[2px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={`r${i}`}
                className={i % 3 === 1 ? "bg-red-400" : "bg-zinc-200"}
              />
            ))}
          </div>
          <div className="relative bg-green-500">
            <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-200 ring-2 ring-white/80" />
          </div>
          <div className="grid grid-cols-3 gap-[1px] bg-white p-[2px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={`b${i}`}
                className={i % 3 === 1 ? "bg-yellow-400" : "bg-zinc-200"}
              />
            ))}
          </div>
          <div className="relative bg-yellow-400">
            <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-100 ring-2 ring-white/80" />
          </div>
        </div>
      </div>

      <div className="absolute left-3 top-12 z-10 h-9 w-7 rounded-t-full rounded-b-[45%] border border-white/30 bg-blue-500 shadow-[0_7px_14px_rgba(37,99,235,0.65)]" />
      <div className="absolute right-3 top-12 z-10 h-9 w-7 rounded-t-full rounded-b-[45%] border border-white/30 bg-red-500 shadow-[0_7px_14px_rgba(220,38,38,0.65)]" />
      <div className="absolute bottom-4 left-[42%] z-10 h-9 w-7 rounded-t-full rounded-b-[45%] border border-white/30 bg-green-500 shadow-[0_7px_14px_rgba(22,163,74,0.65)]" />
      <div className="absolute bottom-4 right-[30%] z-10 h-9 w-7 rounded-t-full rounded-b-[45%] border border-white/30 bg-yellow-400 shadow-[0_7px_14px_rgba(202,138,4,0.65)]" />
      <div className="absolute left-1/2 top-[43%] z-20 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] items-center justify-center rounded-lg border border-zinc-300 bg-white text-2xl text-black shadow-xl">
        ⚄
      </div>
    </div>
  );
}

function RoundAvatar({ active = false }: { active?: boolean }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-gradient-to-b from-blue-400 to-blue-800 text-xl ${active ? "border-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.45)]" : "border-white/15"}`}
    >
      👤
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [balance, setBalance] = useState(0);
  const [playerDisplay, setPlayerDisplay] = useState("");

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const [allBattles, setAllBattles] = useState<Battle[]>([]);

  const [playerProfiles, setPlayerProfiles] = useState<
    Record<string, PlayerProfile>
  >({});

  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [selectedGame, setSelectedGame] = useState<
    "classic" | "ulta" | "teamup"
  >("classic");

  const selectedGameBattles = allBattles.filter(
    (battle) => getGameType(battle) === selectedGame,
  );

  const myBattles = selectedGameBattles.filter(
    (battle) => battle.creator_uid === uid || battle.joiner_uid === uid,
  );

  const openBattles = selectedGameBattles.filter(
    (battle) =>
      battle.status === "open" &&
      battle.creator_uid !== uid &&
      battle.joiner_uid !== uid,
  );

  const liveBattles = selectedGameBattles.filter(
    (battle) =>
      (battle.status === "matched" || battle.status === "running") &&
      battle.creator_uid !== uid &&
      battle.joiner_uid !== uid,
  );

  useEffect(() => {
    let battleChannel: any = null;
    let walletChannel: any = null;
    let announcementChannel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setUid(user.uid);
      setPhone(user.phoneNumber || "");

      await Promise.all([
        loadWallet(user.uid),
        loadBattles(user.uid),
        loadAnnouncement(),
      ]);

      battleChannel = supabase
        .channel("dashboard-battles-live")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "battles",
          },
          () => {
            loadBattles(user.uid);
          },
        )
        .subscribe();

      walletChannel = supabase
        .channel(`dashboard-wallet-live-${user.uid}`)
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
          },
        )
        .subscribe();

      announcementChannel = supabase
        .channel("dashboard-announcement-live")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "site_announcements",
          },
          () => {
            loadAnnouncement();
          },
        )
        .subscribe();

      setLoading(false);
    });

    return () => {
      unsubscribe();

      if (battleChannel) {
        supabase.removeChannel(battleChannel);
      }

      if (walletChannel) {
        supabase.removeChannel(walletChannel);
      }

      if (announcementChannel) {
        supabase.removeChannel(announcementChannel);
      }
    };
  }, [router]);

  async function loadAnnouncement() {
    const { data, error } = await supabase
      .from("site_announcements")
      .select("id,message,is_active,updated_at")
      .eq("is_active", true)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Announcement load error:", error);
      setAnnouncement(null);
      return;
    }

    if (!data || !String(data.message || "").trim()) {
      setAnnouncement(null);
      return;
    }

    setAnnouncement({
      id: Number(data.id),
      message: String(data.message || "").trim(),
      is_active: data.is_active === true,
      updated_at: data.updated_at || null,
    });
  }

  async function loadWallet(userId: string) {
    const { data, error } = await supabase
      .from("wallets")
      .select("balance")
      .eq("uid", userId)
      .maybeSingle();

    if (error) {
      toast.error("Wallet load nahi hua");
      return;
    }

    setBalance(Number(data?.balance || 0));
  }

  async function loadBattles(currentUserId?: string) {
    const { data, error } = await supabase
      .from("battles")
      .select(
        `
          id,
          amount,
          status,
          room_code,
          game_type,
          creator_uid,
          joiner_uid,
          creator_name,
          joiner_name,
          creator_phone,
          joiner_phone,
          created_at
        `,
      )
      .in("status", ["open", "matched", "running"])
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    const battleRows = (data || []) as Battle[];
    setAllBattles(battleRows);

    const ids = new Set<string>();

    if (currentUserId) {
      ids.add(currentUserId);
    }

    battleRows.forEach((battle) => {
      if (battle.creator_uid) {
        ids.add(battle.creator_uid);
      }

      if (battle.joiner_uid) {
        ids.add(battle.joiner_uid);
      }
    });

    if (ids.size === 0) {
      setPlayerProfiles({});
      return;
    }

    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("firebase_uid,username,name,phone")
      .in("firebase_uid", Array.from(ids));

    if (usersError) {
      console.error("Player profiles load error:", usersError);
      return;
    }

    const profiles: Record<string, PlayerProfile> = {};

    (usersData || []).forEach((item: any) => {
      profiles[item.firebase_uid] = {
        username: String(item.username || "").trim(),
        name: String(item.name || "").trim(),
        phone: String(item.phone || "").trim(),
      };
    });

    setPlayerProfiles(profiles);

    const currentProfile = currentUserId ? profiles[currentUserId] : undefined;

    setPlayerDisplay(
      formatPlayerDisplay(
        currentProfile,
        "",
        auth.currentUser?.phoneNumber || "",
      ),
    );
  }

  async function joinBattle(battleId: number) {
    if (joiningId !== null) {
      return;
    }

    try {
      const user = auth.currentUser;

      if (!user) {
        router.replace("/login");
        return;
      }

      setJoiningId(battleId);

      const response = await fetch("/api/battles/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          battleId,
          uid: user.uid,
          phone: user.phoneNumber || "",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.message || "Battle join nahi hui");
        return;
      }

      toast.success("Battle joined successfully");

      await Promise.all([loadBattles(user.uid), loadWallet(user.uid)]);

      router.push(`/battle/${battleId}`);
    } catch (error: any) {
      toast.error(error?.message || "Something went wrong");
    } finally {
      setJoiningId(null);
    }
  }

  async function cancelOpenBattle(battleId: number) {
    const user = auth.currentUser;

    if (!user) {
      router.replace("/login");
      return;
    }

    try {
      setCancellingId(battleId);

      const { data, error } = await supabase.rpc("cancel_battle_safe", {
        battle_id_input: battleId,
        uid_input: user.uid,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data === "cancelled_refunded" || data === "cancelled") {
        toast.success("Battle cancel ho gayi, refund done ✅");
      } else if (data === "already_closed") {
        toast.error("Battle pehle hi close ho chuki hai");
      } else {
        toast.success("Battle cancel request done ✅");
      }

      await Promise.all([loadBattles(user.uid), loadWallet(user.uid)]);
    } catch (error: any) {
      toast.error(error?.message || "Battle cancel nahi hui");
    } finally {
      setCancellingId(null);
    }
  }

  async function logout() {
    await signOut(auth);
    router.replace("/login");
  }

  function maskPhone(value?: string | null) {
    const digits = String(value || "").replace(/\D/g, "");
    const last4 = digits.slice(-4);

    return last4 ? `XXXXXX${last4}` : "";
  }

  function formatPlayerDisplay(
    profile?: PlayerProfile,
    fallbackName?: string | null,
    fallbackPhone?: string | null,
  ) {
    if (profile?.username) {
      return `@${profile.username}`;
    }

    if (profile?.name) {
      return profile.name;
    }

    if (fallbackName?.trim()) {
      return fallbackName.trim();
    }

    return maskPhone(profile?.phone) || maskPhone(fallbackPhone) || "Player";
  }

  function getCreatorDisplayName(battle: Battle) {
    return formatPlayerDisplay(
      playerProfiles[battle.creator_uid],
      battle.creator_name,
      battle.creator_phone,
    );
  }

  function getJoinerDisplayName(battle: Battle) {
    if (!battle.joiner_uid) {
      return "Waiting";
    }

    return formatPlayerDisplay(
      playerProfiles[battle.joiner_uid],
      battle.joiner_name,
      battle.joiner_phone,
    );
  }

  function getGameType(battle: Battle) {
    return battle.game_type === "ulta" ? "ulta" : "classic";
  }

  function getGameTypeLabel(battle: Battle) {
    return getGameType(battle) === "ulta" ? "ULTA LUDO" : "CLASSIC";
  }

  function getGameTypeBadgeClass(battle: Battle) {
    return getGameType(battle) === "ulta"
      ? "border-red-500/30 bg-red-500/10 text-red-400"
      : "border-blue-500/30 bg-blue-500/10 text-blue-400";
  }

  function getBattleStatusText(battle: Battle) {
    if (battle.status === "open") {
      return "Waiting for Player";
    }

    if (battle.status === "matched") {
      return "Player Joined";
    }

    return "Battle Running";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#010611] text-white">
        <p className="font-black text-yellow-400">Loading DeshiLudo...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#071426_0%,#020813_38%,#01040b_100%)] pb-24 text-white">
      <style jsx global>{`
        @keyframes deshiludoAnnouncementMove {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .deshiludo-announcement-track {
          display: inline-block;
          min-width: max-content;
          padding-left: 100%;
          animation: deshiludoAnnouncementMove 18s linear infinite;
          will-change: transform;
        }
        .deshiludo-announcement-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .deshiludo-announcement-track {
            padding-left: 0;
            animation: none;
          }
        }
      `}</style>

      <header className="sticky top-0 z-40 border-b border-yellow-500/25 bg-[#010611]/95 px-3 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="hidden text-3xl text-white/90 sm:block"
            >
              ☰
            </button>
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

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="rounded-2xl border border-yellow-500/35 bg-black/30 px-3 py-2 sm:px-5">
              <p className="text-[9px] text-zinc-400 sm:text-xs">
                Total Wallet
              </p>
              <div className="flex items-center gap-2">
                <span className="text-green-400">▣</span>
                <p className="text-base font-black text-green-400 sm:text-xl">
                  ₹{balance}
                </p>
                <Link
                  href="/deposit"
                  className="ml-1 hidden rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-lg font-black text-yellow-400 sm:block"
                >
                  +
                </Link>
              </div>
            </div>
            <span className="hidden text-2xl sm:inline">🔔</span>
            <Link href="/profile" className="flex items-center gap-2">
              <RoundAvatar />
              <div className="hidden text-left md:block">
                <p className="max-w-28 truncate text-sm font-black">
                  {playerDisplay || "Player"}
                </p>
                <p className="text-[10px] text-zinc-400">{maskPhone(phone)}</p>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {announcement?.is_active && announcement.message && (
        <section className="border-b border-yellow-500/20 bg-yellow-500/10">
          <div className="mx-auto flex max-w-6xl overflow-hidden">
            <div className="z-10 shrink-0 border-r border-yellow-500/30 bg-yellow-400 px-3 py-2 text-[11px] font-black text-black">
              📢 सूचना
            </div>
            <div className="min-w-0 flex-1 overflow-hidden py-2">
              <div className="deshiludo-announcement-track whitespace-nowrap text-xs font-bold text-yellow-100">
                {announcement.message}
                <span className="px-10 text-yellow-500">◆</span>
                {announcement.message}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-3 pt-5 sm:px-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-yellow-400">➜</span>
          <h2 className="text-base font-black tracking-wide sm:text-xl">
            CHOOSE GAME MODE
          </h2>
          <span className="h-px w-10 bg-gradient-to-r from-yellow-400 to-transparent" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setSelectedGame("classic")}
            onKeyDown={(event) => {
              if (event.key === "Enter") setSelectedGame("classic");
            }}
            className="group block cursor-pointer"
          >
            <article
              className={`relative min-h-[405px] overflow-hidden rounded-[24px] border-2 bg-[linear-gradient(155deg,#071932_0%,#041020_55%,#02050b_100%)] p-5 transition hover:-translate-y-1 ${
                selectedGame === "classic"
                  ? "border-cyan-300 shadow-[0_0_38px_rgba(34,211,238,0.48),inset_0_0_35px_rgba(14,165,233,0.12)]"
                  : "border-cyan-400/55 shadow-[0_0_20px_rgba(34,211,238,0.18)]"
              }`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_37%,rgba(14,165,233,0.20),transparent_38%)]" />
              <div className="relative flex h-full flex-col">
                <div>
                  <p className="text-center text-4xl font-black italic leading-none text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.35)]">
                    LUDO
                  </p>
                  <p className="mt-1 text-center text-3xl font-black italic text-cyan-400">
                    CLASSIC
                  </p>
                </div>
                <MiniLudoBoard tone="classic" />
                <div className="mt-auto">
                  <p className="text-sm font-bold">2 Players</p>
                  <p className="mt-1 text-sm text-zinc-200">Minimum ₹100</p>
                  <Link
                    href="/create-battle?game=classic"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-4 flex items-center justify-between rounded-xl border border-blue-300/30 bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-3 text-base font-black shadow-[0_8px_22px_rgba(37,99,235,0.35)]"
                  >
                    <span>PLAY NOW</span>
                    <span>›</span>
                  </Link>
                </div>
              </div>
            </article>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => setSelectedGame("ulta")}
            onKeyDown={(event) => {
              if (event.key === "Enter") setSelectedGame("ulta");
            }}
            className="group block cursor-pointer"
          >
            <article
              className={`relative min-h-[405px] overflow-hidden rounded-[24px] border-2 bg-[linear-gradient(155deg,#26080d_0%,#140509_55%,#02050b_100%)] p-5 transition hover:-translate-y-1 ${
                selectedGame === "ulta"
                  ? "border-red-300 shadow-[0_0_40px_rgba(239,68,68,0.50),inset_0_0_35px_rgba(239,68,68,0.12)]"
                  : "border-red-400/55 shadow-[0_0_20px_rgba(239,68,68,0.18)]"
              }`}
            >
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
                <MiniLudoBoard tone="ulta" />
                <div className="mt-auto">
                  <p className="text-sm font-bold">2 Players</p>
                  <p className="mt-1 text-sm text-zinc-200">Minimum ₹100</p>
                  <Link
                    href="/create-battle?game=ulta"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-4 flex items-center justify-between rounded-xl border border-red-300/30 bg-gradient-to-r from-red-700 to-red-500 px-5 py-3 text-base font-black shadow-[0_8px_22px_rgba(220,38,38,0.35)]"
                  >
                    <span>PLAY NOW</span>
                    <span>›</span>
                  </Link>
                </div>
              </div>
            </article>
          </div>

          <article
            onClick={() => setSelectedGame("teamup")}
            className={`relative min-h-[405px] cursor-pointer overflow-hidden rounded-[24px] border-2 bg-[linear-gradient(155deg,#241803_0%,#100b02_55%,#02050b_100%)] p-5 ${
              selectedGame === "teamup"
                ? "border-yellow-300 shadow-[0_0_40px_rgba(234,179,8,0.46),inset_0_0_35px_rgba(234,179,8,0.12)]"
                : "border-yellow-400/55 shadow-[0_0_20px_rgba(234,179,8,0.18)]"
            }`}
          >
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
              <MiniLudoBoard tone="team" />
              <div className="relative mx-auto -mt-3 mb-2 w-[88%] bg-gradient-to-r from-yellow-700 via-yellow-400 to-yellow-700 px-4 py-2 text-center text-sm font-black text-black shadow-xl before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:border-y-[15px] before:border-r-[12px] before:border-y-transparent before:border-r-yellow-700 after:absolute after:-right-3 after:top-1/2 after:-translate-y-1/2 after:border-y-[15px] after:border-l-[12px] after:border-y-transparent after:border-l-yellow-700">
                COMING SOON
              </div>
              <div className="mt-auto">
                <p className="text-sm text-zinc-200">2 vs 2 Team Battle</p>
                <button
                  type="button"
                  disabled
                  className="mt-4 w-full rounded-xl border border-yellow-400/60 bg-yellow-500/10 px-5 py-3 text-base font-black text-yellow-100"
                >
                  COMING SOON
                </button>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-7 rounded-2xl border border-white/10 bg-[#07101d] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
            Showing battles for
          </p>
          <p
            className={`mt-1 text-lg font-black ${
              selectedGame === "ulta"
                ? "text-red-400"
                : selectedGame === "teamup"
                  ? "text-yellow-400"
                  : "text-cyan-400"
            }`}
          >
            {selectedGame === "ulta"
              ? "Ulta Ludo"
              : selectedGame === "teamup"
                ? "Team Up Ludo — Coming Soon"
                : "Ludo Classic"}
          </p>
        </div>

        <div className="mt-5 mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black sm:text-xl">⚔ OPEN BATTLES</h2>
          <span className="text-sm font-bold text-yellow-400">View All ›</span>
        </div>

        {openBattles.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#07101d] p-6 text-center text-sm text-zinc-400">
            Abhi koi dusri open battle nahi hai.
          </div>
        ) : (
          <div className="space-y-3">
            {openBattles.map((battle) => {
              const isUlta = getGameType(battle) === "ulta";
              return (
                <div
                  key={battle.id}
                  className={`relative overflow-hidden rounded-2xl border bg-[#07101d] px-3 py-3 ${isUlta ? "border-red-500/30" : "border-blue-500/30"}`}
                >
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${isUlta ? "bg-red-500" : "bg-blue-500"}`}
                  />
                  <div className="grid grid-cols-[72px_1fr_auto] items-center gap-3 sm:grid-cols-[95px_130px_1fr_90px_110px]">
                    <div>
                      <p className="text-2xl font-black text-[#ffbd2e]">
                        ₹{battle.amount}
                      </p>
                      <p className="text-[10px] text-zinc-400">Entry Fee</p>
                    </div>
                    <div className="hidden sm:block">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${isUlta ? "bg-red-800/80 text-red-100" : "bg-blue-800/80 text-blue-200"}`}
                      >
                        {getGameTypeLabel(battle)}
                      </span>
                      <p className="mt-2 text-[10px] text-zinc-400">
                        Battle ID: #{battle.id}
                      </p>
                    </div>
                    <div className="flex min-w-0 items-center justify-center gap-3">
                      <RoundAvatar />
                      <div className="min-w-0 text-center">
                        <p className="truncate text-sm font-black">
                          {getCreatorDisplayName(battle)}
                        </p>
                        <p className="text-xl font-black text-yellow-400">VS</p>
                        <p className="text-[10px] text-zinc-400">
                          Waiting for opponent...
                        </p>
                      </div>
                      <RoundAvatar />
                    </div>
                    <div className="hidden rounded-xl border border-white/10 px-3 py-2 text-center sm:block">
                      <p className="font-black">1 / 2</p>
                      <p className="text-[10px] text-zinc-400">Players</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => joinBattle(battle.id)}
                      disabled={joiningId === battle.id || joiningId !== null}
                      className={`rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-60 ${isUlta ? "bg-red-600" : "bg-blue-600"}`}
                    >
                      {joiningId === battle.id ? "Joining..." : "JOIN"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black sm:text-xl">🟢 LIVE BATTLES</h2>
          <span className="text-sm font-bold text-yellow-400">View All ›</span>
        </div>
        {liveBattles.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#07101d] p-5 text-center text-sm text-zinc-500">
            Abhi koi public live battle nahi hai.
          </div>
        ) : (
          <div className="space-y-3">
            {liveBattles.map((battle) => (
              <div
                key={`live-${battle.id}`}
                className="relative overflow-hidden rounded-2xl border border-green-500/25 bg-[#07101d] px-3 py-3"
              >
                <span className="absolute inset-y-0 left-0 w-1 bg-green-500" />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black text-[#ffbd2e]">
                      ₹{battle.amount}
                    </p>
                    <p className="text-[10px] text-zinc-400">Entry Fee</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-black ${getGameType(battle) === "ulta" ? "bg-red-800/80 text-red-100" : "bg-blue-800/80 text-blue-200"}`}
                  >
                    {getGameTypeLabel(battle)}
                  </span>
                  <div className="min-w-0 text-center">
                    <p className="truncate text-sm font-black">
                      {getCreatorDisplayName(battle)}{" "}
                      <span className="px-2 text-yellow-400">VS</span>{" "}
                      {getJoinerDisplayName(battle)}
                    </p>
                    <p className="mt-1 text-[10px] text-green-400">
                      Battle in progress...
                    </p>
                  </div>
                  <div className="hidden rounded-xl border border-white/10 px-3 py-2 text-center sm:block">
                    <p className="font-black">2 / 2</p>
                    <p className="text-[10px] text-zinc-400">Players</p>
                  </div>
                  <span className="rounded-xl border border-green-500/50 bg-green-500/10 px-4 py-2 text-xs font-black text-green-300">
                    LIVE
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black sm:text-xl">♟ MY BATTLES</h2>
          <Link
            href="/battle-history"
            className="text-sm font-bold text-yellow-400"
          >
            View All ›
          </Link>
        </div>
        {myBattles.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#07101d] p-5 text-center text-sm text-zinc-500">
            Abhi koi active battle nahi hai.
          </div>
        ) : (
          <div className="space-y-3">
            {myBattles.map((battle) => {
              const isOpen = battle.status === "open";
              const isCreator = battle.creator_uid === uid;
              const isUlta = getGameType(battle) === "ulta";
              return (
                <div
                  key={`my-${battle.id}`}
                  className={`relative overflow-hidden rounded-2xl border bg-[#07101d] px-3 py-3 ${isUlta ? "border-red-500/30" : "border-blue-500/30"}`}
                >
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${isUlta ? "bg-red-500" : "bg-blue-500"}`}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-2xl font-black text-[#ffbd2e]">
                        ₹{battle.amount}
                      </p>
                      <p className="text-[10px] text-zinc-400">Entry Fee</p>
                    </div>
                    <div className="hidden sm:block">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${isUlta ? "bg-red-800/80 text-red-100" : "bg-blue-800/80 text-blue-200"}`}
                      >
                        {getGameTypeLabel(battle)}
                      </span>
                      <p className="mt-2 text-[10px] text-zinc-400">
                        Battle ID: #{battle.id}
                      </p>
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <RoundAvatar active />
                      <div className="min-w-0 text-center">
                        <p className="truncate text-sm font-black">
                          You <span className="px-2 text-yellow-400">VS</span>{" "}
                          {isOpen ? "Waiting" : getJoinerDisplayName(battle)}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-400">
                          {getBattleStatusText(battle)}
                        </p>
                      </div>
                      <RoundAvatar />
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/battle/${battle.id}`)}
                        className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-xs font-black text-yellow-300"
                      >
                        OPEN
                      </button>
                      {isOpen && isCreator && (
                        <button
                          type="button"
                          onClick={() => cancelOpenBattle(battle.id)}
                          disabled={cancellingId === battle.id}
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[10px] font-black text-red-400 disabled:opacity-60"
                        >
                          {cancellingId === battle.id
                            ? "Cancelling..."
                            : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 grid grid-cols-3 gap-2 sm:hidden">
          <Link
            href="/deposit"
            className="rounded-xl border border-green-500/30 bg-green-500/10 py-3 text-center text-xs font-black text-green-400"
          >
            Deposit
          </Link>
          <Link
            href="/withdraw"
            className="rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-center text-xs font-black text-red-400"
          >
            Withdraw
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-xs font-black"
          >
            Logout
          </button>
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#020711]/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-4xl grid-cols-5">
          <Link
            href="/dashboard"
            className="border-t-2 border-yellow-400 py-3 text-center text-yellow-400"
          >
            <div className="text-xl">⌂</div>
            <p className="text-[11px] font-bold">Home</p>
          </Link>
          <Link
            href="/dashboard#open-battles"
            className="py-3 text-center text-zinc-300"
          >
            <div className="text-xl">⚔</div>
            <p className="text-[11px]">Battles</p>
          </Link>
          <Link href="/deposit" className="py-3 text-center text-zinc-300">
            <div className="text-xl">▣</div>
            <p className="text-[11px]">Wallet</p>
          </Link>
          <Link
            href="/battle-history"
            className="py-3 text-center text-zinc-300"
          >
            <div className="text-xl">↶</div>
            <p className="text-[11px]">History</p>
          </Link>
          <Link href="/profile" className="py-3 text-center text-zinc-300">
            <div className="text-xl">●</div>
            <p className="text-[11px]">Profile</p>
          </Link>
        </div>
      </nav>
    </main>
  );
}
