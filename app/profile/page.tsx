"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

type WalletTx = {
  id: number;
  type: string;
  title: string;
  description: string | null;
  amount: number;
  balance_after: number;
  status: string;
  created_at: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");

  const [depositBalance, setDepositBalance] = useState(0);
  const [winningBalance, setWinningBalance] = useState(0);
  const [history, setHistory] = useState<WalletTx[]>([]);

  const [referralCode, setReferralCode] = useState("");
  const [kycStatus, setKycStatus] = useState("pending");
  const [aadhaarUrl, setAadhaarUrl] = useState("");
  const [panUrl, setPanUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [uploadingAadhaar, setUploadingAadhaar] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const userPhone = user.phoneNumber || "";
      setUid(user.uid);
      setPhone(userPhone);

      await loadProfile(user.uid, userPhone);
      await loadHistory(user.uid);
      setLoading(false);

      const walletChannel = supabase
        .channel("profile-wallet-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallets",
            filter: `uid=eq.${user.uid}`,
          },
          async () => {
            await loadWallet(user.uid);
          }
        )
        .subscribe();

      const historyChannel = supabase
        .channel("profile-history-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallet_transactions",
            filter: `uid=eq.${user.uid}`,
          },
          async () => {
            await loadHistory(user.uid);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(walletChannel);
        supabase.removeChannel(historyChannel);
      };
    });

    return () => unsub();
  }, [router]);

  function makeReferralCode(userPhone: string, userId: string) {
    const cleanPhone = userPhone.replace(/\D/g, "");
    const last4 = cleanPhone.slice(-4) || userId.slice(0, 4).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `DL${last4}${random}`;
  }

  async function loadWallet(userId: string) {
    const { data, error } = await supabase
      .from("wallets")
      .select("deposit_balance, winning_balance")
      .eq("uid", userId)
      .maybeSingle();

    if (error) {
      toast.error("Wallet load nahi hua");
      return;
    }

    setDepositBalance(Number(data?.deposit_balance || 0));
    setWinningBalance(Number(data?.winning_balance || 0));
  }

  async function loadHistory(userId: string) {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("id,type,title,description,amount,balance_after,status,created_at")
      .eq("uid", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      toast.error("Wallet history load nahi hui");
      return;
    }

    setHistory((data || []) as WalletTx[]);
  }

  async function loadProfile(userId: string, userPhone: string) {
    await loadWallet(userId);

    const { data, error } = await supabase
      .from("users")
      .select("referral_code, aadhaar_url, pan_url, kyc_status")
      .eq("firebase_uid", userId)
      .maybeSingle();

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
        .eq("firebase_uid", userId);
    }

    setReferralCode(code || "");
    setAadhaarUrl(data?.aadhaar_url || "");
    setPanUrl(data?.pan_url || "");
    setKycStatus(data?.kyc_status || "pending");
  }

  async function uploadKycDoc(type: "aadhaar" | "pan", file: File) {
    try {
      if (!uid) {
        toast.error("User login nahi hai");
        return;
      }

      if (type === "aadhaar") setUploadingAadhaar(true);
      if (type === "pan") setUploadingPan(true);

      const formData = new FormData();
      formData.append("uid", uid);
      formData.append("type", type);
      formData.append("file", file);

      const res = await fetch("/api/kyc/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        toast.error(result.message || "Upload failed");
        return;
      }

      if (type === "aadhaar") setAadhaarUrl(result.path);
      if (type === "pan") setPanUrl(result.path);

      setKycStatus("pending");
      toast.success(type === "aadhaar" ? "Aadhaar upload ho gaya" : "PAN upload ho gaya");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploadingAadhaar(false);
      setUploadingPan(false);
    }
  }

  async function copyReferral() {
    if (!referralCode) {
      toast.error("Referral code nahi mila");
      return;
    }

    await navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied");
  }

  async function logout() {
    await signOut(auth);
    localStorage.removeItem("deshiludo_admin");
    router.push("/login");
  }

  function kycClass() {
    if (kycStatus === "approved") return "text-green-400 bg-green-500/10";
    if (kycStatus === "rejected") return "text-red-400 bg-red-500/10";
    return "text-yellow-400 bg-yellow-500/10";
  }

  function txStyle(type: string) {
    if (type === "battle_lost" || type === "withdraw") {
      return {
        icon: "🔴",
        amountClass: "text-red-400",
        border: "border-red-500/20",
      };
    }

    if (type === "battle_cancelled") {
      return {
        icon: "⚪",
        amountClass: "text-zinc-300",
        border: "border-zinc-700",
      };
    }

    return {
      icon: "🟢",
      amountClass: "text-green-400",
      border: "border-green-500/20",
    };
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatAmount(amount: number) {
    if (amount > 0) return `+₹${amount}`;
    if (amount < 0) return `-₹${Math.abs(amount)}`;
    return "₹0";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="DeshiLudo Logo"
            width={76}
            height={76}
            className="rounded-full border border-yellow-400/50 object-cover"
            priority
          />
          <p className="text-yellow-400 font-bold">Loading Profile...</p>
        </div>
      </main>
    );
  }

  const totalBalance = depositBalance + winningBalance;

  return (
    <main className="min-h-screen bg-black text-white p-3 pb-24">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="DeshiLudo"
              width={48}
              height={48}
              className="rounded-full border border-yellow-400/40 object-cover"
              priority
            />

            <div>
              <h1 className="text-2xl font-black text-yellow-400">Profile</h1>
              <p className="text-[11px] text-zinc-500">DeshiLudo Player</p>
            </div>
          </div>

          <Link href="/dashboard">
            <button className="bg-zinc-800 px-3 py-2 rounded-lg text-xs font-bold">
              Back
            </button>
          </Link>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 mb-3">
          <p className="text-xs text-zinc-400">Mobile Number</p>
          <p className="text-lg font-black text-white">{phone || "User"}</p>

          <p className="text-[10px] text-zinc-600 mt-1 break-all">UID: {uid}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-zinc-950 border border-yellow-500/30 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400">Deposit</p>
            <p className="text-lg font-black text-yellow-400">₹{depositBalance}</p>
          </div>

          <div className="bg-zinc-950 border border-green-500/30 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400">Winning</p>
            <p className="text-lg font-black text-green-400">₹{winningBalance}</p>
          </div>

          <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400">Total</p>
            <p className="text-lg font-black text-white">₹{totalBalance}</p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-yellow-500/20 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-black text-yellow-400">Wallet History</h2>
              <p className="text-[11px] text-zinc-500">Latest transactions</p>
            </div>

            <span className="text-[10px] bg-yellow-400/10 text-yellow-400 px-3 py-1 rounded-full font-black">
              LIVE
            </span>
          </div>

          {history.length === 0 ? (
            <div className="bg-black border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-sm text-zinc-400">Abhi koi wallet history nahi hai.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {history.map((tx) => {
                const style = txStyle(tx.type);

                return (
                  <div
                    key={tx.id}
                    className={`bg-black border ${style.border} rounded-xl p-3`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">
                          {style.icon} {tx.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          {formatDate(tx.created_at)} • {tx.status}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-1">
                          Balance After: ₹{Number(tx.balance_after || 0)}
                        </p>
                      </div>

                      <p className={`text-lg font-black ${style.amountClass}`}>
                        {formatAmount(Number(tx.amount || 0))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-yellow-400/10 border border-yellow-500/30 rounded-xl p-3 mb-3">
          <p className="text-xs text-zinc-400">Referral Code</p>

          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xl font-black text-yellow-400 break-all">
              {referralCode || "Generating..."}
            </p>

            <button
              onClick={copyReferral}
              className="bg-yellow-400 text-black px-3 py-2 rounded-lg text-xs font-black"
            >
              Copy
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 mt-2">
            Friend first deposit karega to aapko 5% bonus milega.
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-black text-white">KYC Documents</h2>
              <p className="text-[11px] text-zinc-500">Aadhaar aur PAN upload karo.</p>
            </div>

            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${kycClass()}`}>
              {kycStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="bg-black border border-zinc-800 rounded-xl p-3">
              <p className="text-sm font-bold text-zinc-300 mb-2">Aadhaar Card</p>
              <p className={`text-xs ${aadhaarUrl ? "text-green-400" : "text-zinc-500"}`}>
                {aadhaarUrl ? "Aadhaar uploaded ✅" : "Aadhaar upload nahi hai."}
              </p>

              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadKycDoc("aadhaar", file);
                }}
                className="mt-3 w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-3 file:py-2 file:text-xs file:font-black file:text-black"
              />

              {uploadingAadhaar && <p className="text-xs text-yellow-400 mt-2">Uploading...</p>}
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-3">
              <p className="text-sm font-bold text-zinc-300 mb-2">PAN Card</p>
              <p className={`text-xs ${panUrl ? "text-green-400" : "text-zinc-500"}`}>
                {panUrl ? "PAN uploaded ✅" : "PAN card upload nahi hai."}
              </p>

              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadKycDoc("pan", file);
                }}
                className="mt-3 w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-3 file:py-2 file:text-xs file:font-black file:text-black"
              />

              {uploadingPan && <p className="text-xs text-yellow-400 mt-2">Uploading...</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <Link href="/deposit">
            <button className="w-full bg-yellow-400 text-black rounded-lg py-3 font-black text-sm">
              Deposit
            </button>
          </Link>

          <Link href="/withdraw">
            <button className="w-full bg-green-500 text-black rounded-lg py-3 font-black text-sm">
              Withdraw
            </button>
          </Link>

          <Link href="/battle-history">
            <button className="w-full bg-zinc-800 text-white rounded-lg py-3 font-bold text-sm">
              Battle History
            </button>
          </Link>

          <Link href="/dashboard">
            <button className="w-full bg-zinc-800 text-white rounded-lg py-3 font-bold text-sm">
              Dashboard
            </button>
          </Link>

          <Link href="/support">
            <button className="w-full bg-blue-600 text-white rounded-lg py-3 font-black text-sm">
              Help & Support
            </button>
          </Link>
        </div>

        <button
          onClick={logout}
          className="w-full bg-red-600 text-white rounded-lg py-3 font-black text-sm"
        >
          Logout
        </button>
      </div>
    </main>
  );
}