"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function ProfilePage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [depositBalance, setDepositBalance] = useState(0);
  const [winningBalance, setWinningBalance] = useState(0);
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setUid(user.uid);
      setPhone(user.phoneNumber || "");
      await loadProfile(user.uid, user.phoneNumber || "");
      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  function makeReferralCode(userPhone: string, userId: string) {
    const cleanPhone = userPhone.replace(/\D/g, "");
    const last4 = cleanPhone.slice(-4) || userId.slice(0, 4).toUpperCase();
    return `DL${last4}`;
  }

  async function loadProfile(userId: string, userPhone: string) {
    const { data, error } = await supabase
      .from("users")
      .select("deposit_balance, winning_balance, referral_code")
      .eq("uid", userId)
      .single();

    if (error) {
      toast.error("Profile load nahi hua");
      return;
    }

    let code = data?.referral_code;

    if (!code) {
      code = makeReferralCode(userPhone, userId);

      await supabase
        .from("users")
        .update({ referral_code: code })
        .eq("uid", userId);
    }

    setDepositBalance(Number(data?.deposit_balance || 0));
    setWinningBalance(Number(data?.winning_balance || 0));
    setReferralCode(code);
  }

  async function copyReferral() {
    await navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied");
  }

  async function logout() {
    await signOut(auth);
    localStorage.removeItem("deshiludo_admin");
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-yellow-400 font-bold">Loading Profile...</p>
      </main>
    );
  }

  const totalBalance = depositBalance + winningBalance;

  return (
    <main className="min-h-screen bg-black text-white p-3">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black text-yellow-400">Profile</h1>

          <Link href="/dashboard">
            <button className="bg-zinc-800 px-3 py-2 rounded-lg text-xs">
              Back
            </button>
          </Link>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 mb-3">
          <p className="text-xs text-zinc-400">Mobile Number</p>
          <p className="text-lg font-black text-white">{phone || "User"}</p>

          <p className="text-[10px] text-zinc-600 mt-1 break-all">
            UID: {uid}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-zinc-950 border border-yellow-500/30 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400">Deposit</p>
            <p className="text-lg font-black text-yellow-400">
              ₹{depositBalance}
            </p>
          </div>

          <div className="bg-zinc-950 border border-green-500/30 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400">Winning</p>
            <p className="text-lg font-black text-green-400">
              ₹{winningBalance}
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400">Total</p>
            <p className="text-lg font-black text-white">₹{totalBalance}</p>
          </div>
        </div>

        <div className="bg-yellow-400/10 border border-yellow-500/30 rounded-xl p-3 mb-3">
          <p className="text-xs text-zinc-400">Referral Code</p>

          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xl font-black text-yellow-400">
              {referralCode}
            </p>

            <button
              onClick={copyReferral}
              className="bg-yellow-400 text-black px-3 py-1 rounded-lg text-xs font-black"
            >
              Copy
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 mt-2">
            Friends ko invite karo aur reward earn karo.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <Link href="/deposit">
            <button className="w-full bg-yellow-400 text-black rounded-lg font-black text-sm">
              Deposit
            </button>
          </Link>

          <Link href="/withdraw">
            <button className="w-full bg-green-500 text-black rounded-lg font-black text-sm">
              Withdraw
            </button>
          </Link>

          <Link href="/history">
            <button className="w-full bg-zinc-800 text-white rounded-lg font-bold text-sm">
              History
            </button>
          </Link>

          <Link href="/dashboard">
            <button className="w-full bg-zinc-800 text-white rounded-lg font-bold text-sm">
              Dashboard
            </button>
          </Link>
        </div>

        <button
          onClick={logout}
          className="w-full bg-red-600 text-white rounded-lg font-black text-sm"
        >
          Logout
        </button>
      </div>
    </main>
  );
}