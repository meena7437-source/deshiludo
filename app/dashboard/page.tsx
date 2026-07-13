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

export default function DashboardPage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [balance, setBalance] = useState(0);
  const [playerDisplay, setPlayerDisplay] = useState("");

  const [announcement, setAnnouncement] =
    useState<Announcement | null>(null);

  const [allBattles, setAllBattles] = useState<Battle[]>([]);

  const [playerProfiles, setPlayerProfiles] = useState<
    Record<string, PlayerProfile>
  >({});

  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const myBattles = allBattles.filter(
    (battle) =>
      battle.creator_uid === uid || battle.joiner_uid === uid
  );

  const openBattles = allBattles.filter(
    (battle) =>
      battle.status === "open" &&
      battle.creator_uid !== uid &&
      battle.joiner_uid !== uid
  );

  const liveBattles = allBattles.filter(
    (battle) =>
      (battle.status === "matched" || battle.status === "running") &&
      battle.creator_uid !== uid &&
      battle.joiner_uid !== uid
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
          }
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
          }
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
          }
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
          creator_uid,
          joiner_uid,
          creator_name,
          joiner_name,
          creator_phone,
          joiner_phone,
          created_at
        `
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

    const currentProfile = currentUserId
      ? profiles[currentUserId]
      : undefined;

    setPlayerDisplay(
      formatPlayerDisplay(
        currentProfile,
        "",
        auth.currentUser?.phoneNumber || ""
      )
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

      await Promise.all([
        loadBattles(user.uid),
        loadWallet(user.uid),
      ]);

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

      const { data, error } = await supabase.rpc(
        "cancel_battle_safe",
        {
          battle_id_input: battleId,
          uid_input: user.uid,
        }
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      if (
        data === "cancelled_refunded" ||
        data === "cancelled"
      ) {
        toast.success("Battle cancel ho gayi, refund done ✅");
      } else if (data === "already_closed") {
        toast.error("Battle pehle hi close ho chuki hai");
      } else {
        toast.success("Battle cancel request done ✅");
      }

      await Promise.all([
        loadBattles(user.uid),
        loadWallet(user.uid),
      ]);
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
    fallbackPhone?: string | null
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

    return (
      maskPhone(profile?.phone) ||
      maskPhone(fallbackPhone) ||
      "Player"
    );
  }

  function getCreatorDisplayName(battle: Battle) {
    return formatPlayerDisplay(
      playerProfiles[battle.creator_uid],
      battle.creator_name,
      battle.creator_phone
    );
  }

  function getJoinerDisplayName(battle: Battle) {
    if (!battle.joiner_uid) {
      return "Waiting";
    }

    return formatPlayerDisplay(
      playerProfiles[battle.joiner_uid],
      battle.joiner_name,
      battle.joiner_phone
    );
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
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="font-bold text-yellow-400">
          Loading DeshiLudo...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black pb-20 text-white">
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

      <header className="sticky top-0 z-20 border-b border-yellow-500/30 bg-black/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Image
              src="/logo.png"
              alt="DeshiLudo Logo"
              width={52}
              height={52}
              className="h-[52px] w-[52px] shrink-0 rounded-full border border-yellow-500/40 object-contain"
              priority
            />

            <div className="min-w-0">
              <h1 className="truncate text-xl font-black leading-none text-yellow-400">
                DeshiLudo
              </h1>

              <p className="mt-1 truncate text-[10px] text-zinc-400">
                {playerDisplay || maskPhone(phone) || "Player"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="text-[9px] text-zinc-400 sm:text-[10px]">
                Wallet Balance
              </p>

              <p className="text-sm font-black text-green-400 sm:text-base">
                ₹{balance}
              </p>
            </div>

            <Link href="/profile">
              <button
                type="button"
                className="rounded-lg bg-yellow-400 px-3 py-2 text-[11px] font-black text-black sm:text-xs"
              >
                Profile
              </button>
            </Link>
          </div>
        </div>
      </header>

      {announcement?.is_active && announcement.message && (
        <section className="border-b border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10">
          <div className="mx-auto flex max-w-3xl items-stretch overflow-hidden">
            <div className="z-10 flex shrink-0 items-center border-r border-yellow-500/30 bg-yellow-400 px-3 py-2 text-[11px] font-black text-black">
              📢 सूचना
            </div>

            <div className="min-w-0 flex-1 overflow-hidden py-2">
              <div className="deshiludo-announcement-track whitespace-nowrap text-xs font-bold text-yellow-200">
                {announcement.message}
                <span className="px-10 text-yellow-500">◆</span>
                {announcement.message}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-3 pt-3">
        <div className="mb-3 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/15 via-zinc-950 to-black p-4">
          <p className="text-xs font-bold text-green-300">
            Available Balance
          </p>

          <div className="mt-1 flex items-center justify-between">
            <p className="text-3xl font-black text-green-400">
              ₹{balance}
            </p>

            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] font-bold text-green-400">
              SINGLE WALLET
            </span>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <Link href="/create-battle">
            <button
              type="button"
              className="w-full rounded-xl bg-yellow-400 py-3 text-xs font-black text-black"
            >
              Create Battle
            </button>
          </Link>

          <Link href="/deposit">
            <button
              type="button"
              className="w-full rounded-xl border border-green-700/50 bg-zinc-900 py-3 text-xs font-bold text-green-400"
            >
              Deposit
            </button>
          </Link>

          <Link href="/withdraw">
            <button
              type="button"
              className="w-full rounded-xl border border-red-700/50 bg-zinc-900 py-3 text-xs font-bold text-red-400"
            >
              Withdraw
            </button>
          </Link>
        </div>

        <div className="mb-3 rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-zinc-950 to-zinc-900 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">
                Open Battles
              </p>

              <h2 className="text-lg font-black text-white">
                Join Battle Room
              </h2>
            </div>

            <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1">
              <p className="text-[11px] font-bold text-green-400">
                {openBattles.length} Open
              </p>
            </div>
          </div>
        </div>

        {openBattles.length === 0 ? (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center">
            <p className="text-sm text-zinc-400">
              Abhi koi dusri open battle nahi hai.
            </p>

            <Link href="/create-battle">
              <button
                type="button"
                className="mt-4 rounded-xl bg-yellow-400 px-5 py-2 text-sm font-black text-black"
              >
                Battle Create Karo
              </button>
            </Link>
          </div>
        ) : (
          <div className="mb-5 space-y-2">
            {openBattles.map((battle) => (
              <div
                key={battle.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 shadow-lg"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-black text-yellow-400">
                        ₹{battle.amount}
                      </p>

                      <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
                        OPEN
                      </span>
                    </div>

                    <p className="mt-1 truncate text-xs text-zinc-400">
                      {getCreatorDisplayName(battle)} waiting for
                      opponent
                    </p>

                    <p className="mt-1 text-[11px] text-zinc-500">
                      Battle ID #{battle.id}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => joinBattle(battle.id)}
                    disabled={
                      joiningId === battle.id ||
                      joiningId !== null
                    }
                    className="shrink-0 rounded-xl bg-yellow-400 px-5 py-2 text-xs font-black text-black disabled:opacity-60"
                  >
                    {joiningId === battle.id
                      ? "Joining..."
                      : "Join"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-3 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-zinc-950 to-zinc-900 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">
                Live Battles
              </p>

              <h2 className="text-lg font-black text-white">
                Your Bets & Running Battles
              </h2>
            </div>

            <div className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1">
              <p className="text-[11px] font-bold text-blue-400">
                {myBattles.length + liveBattles.length} Active
              </p>
            </div>
          </div>
        </div>

        {myBattles.length === 0 && liveBattles.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center">
            <p className="text-sm text-zinc-500">
              Abhi koi active ya live battle nahi hai.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {myBattles.map((battle) => {
              const isCreator = battle.creator_uid === uid;
              const isOpen = battle.status === "open";

              const creatorDisplayName =
                getCreatorDisplayName(battle);

              const joinerDisplayName =
                getJoinerDisplayName(battle);

              return (
                <div
                  key={`my-${battle.id}`}
                  className="rounded-2xl border border-purple-500/30 bg-zinc-950 p-3 shadow-lg"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-black text-yellow-400">
                          ₹{battle.amount}
                        </p>

                        <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-400">
                          {battle.status}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-xs text-zinc-300">
                        {isOpen
                          ? `${creatorDisplayName} waiting for player`
                          : `${creatorDisplayName} vs ${joinerDisplayName}`}
                      </p>

                      <p className="mt-1 text-[11px] text-zinc-500">
                        Your Battle • {getBattleStatusText(battle)} • Battle ID #
                        {battle.id}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/battle/${battle.id}`)
                        }
                        className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-black text-purple-300"
                      >
                        Open Battle
                      </button>

                      {isOpen && isCreator && (
                        <button
                          type="button"
                          onClick={() =>
                            cancelOpenBattle(battle.id)
                          }
                          disabled={cancellingId === battle.id}
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-400 disabled:opacity-60"
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

            {liveBattles.map((battle) => {
              const canOpenBattle =
                battle.creator_uid === uid ||
                battle.joiner_uid === uid;

              return (
                <div
                  key={`live-${battle.id}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 shadow-lg"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-black text-yellow-400">
                          ₹{battle.amount}
                        </p>

                        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] uppercase text-blue-400">
                          {battle.status}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-xs text-zinc-400">
                        {getCreatorDisplayName(battle)} vs{" "}
                        {getJoinerDisplayName(battle)}
                      </p>

                      <p className="mt-1 text-[11px] text-zinc-500">
                        Battle ID #{battle.id}
                      </p>
                    </div>

                    {canOpenBattle && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/battle/${battle.id}`)
                        }
                        className="shrink-0 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-black text-blue-300"
                      >
                        Open Battle
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Link href="/battle-history">
            <button
              type="button"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-[11px] font-bold text-white sm:text-xs"
            >
              My Battles
            </button>
          </Link>

          <Link href="/rules">
            <button
              type="button"
              className="w-full rounded-xl border border-yellow-500/30 bg-yellow-500/10 py-3 text-[11px] font-bold text-yellow-400 sm:text-xs"
            >
              Rules
            </button>
          </Link>

          <button
            type="button"
            onClick={logout}
            className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-[11px] font-bold text-red-400 sm:text-xs"
          >
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}