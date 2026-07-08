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
      setLoading(false);

      const channel = supabase
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

      return () => {
        supabase.removeChannel(channel);
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

      if (!file) return;

      if (type === "aadhaar") setUploadingAadhaar(true);
      if (type === "pan") setUploadingPan(true);

      const ext = file.name.split(".").pop();
      const filePath = `${uid}/${type}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const { data: publicData } = supabase.storage
        .from("kyc-documents")
        .getPublicUrl(filePath);

      const url = publicData.publicUrl;

      const updateData =
        type === "aadhaar"
          ? { aadhaar_url: url, kyc_status: "pending" }
          : { pan_url: url, kyc_status: "pending" };

      const { error: updateError } = await supabase
        .from("users")
        .update(updateData)
        .eq("firebase_uid", uid);

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      if (type === "aadhaar") setAadhaarUrl(url);
      if (type === "pan") setPanUrl(url);

      setKycStatus("pending");
      toast.success(
        type === "aadhaar"
          ? "Aadhaar upload ho gaya"
          : "PAN card upload ho gaya"
      );
    } catch (err: any) {
      console.error(err);
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
            <button className="bg-zinc-800 px-3 py-2 rounded-lg text-xs font-bold">
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
            Friend first deposit karega to aapko 5% bonus Deposit Balance me
            milega.
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-black text-white">KYC Documents</h2>
              <p className="text-[11px] text-zinc-500">
                Aadhaar aur PAN card upload karo.
              </p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${kycClass()}`}
            >
              {kycStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="bg-black border border-zinc-800 rounded-xl p-3">
              <p className="text-sm font-bold text-zinc-300 mb-2">
                Aadhaar Card
              </p>

              {aadhaarUrl ? (
                <a
                  href={aadhaarUrl}
                  target="_blank"
                  className="text-xs text-blue-400 underline"
                >
                  View uploaded Aadhaar
                </a>
              ) : (
                <p className="text-xs text-zinc-500 mb-2">
                  Aadhaar upload nahi hai.
                </p>
              )}

              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadKycDoc("aadhaar", file);
                }}
                className="mt-3 w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-3 file:py-2 file:text-xs file:font-black file:text-black"
              />

              {uploadingAadhaar && (
                <p className="text-xs text-yellow-400 mt-2">Uploading...</p>
              )}
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-3">
              <p className="text-sm font-bold text-zinc-300 mb-2">PAN Card</p>

              {panUrl ? (
                <a
                  href={panUrl}
                  target="_blank"
                  className="text-xs text-blue-400 underline"
                >
                  View uploaded PAN
                </a>
              ) : (
                <p className="text-xs text-zinc-500 mb-2">
                  PAN card upload nahi hai.
                </p>
              )}

              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadKycDoc("pan", file);
                }}
                className="mt-3 w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-3 file:py-2 file:text-xs file:font-black file:text-black"
              />

              {uploadingPan && (
                <p className="text-xs text-yellow-400 mt-2">Uploading...</p>
              )}
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

          <Link href="/history">
            <button className="w-full bg-zinc-800 text-white rounded-lg py-3 font-bold text-sm">
              History
            </button>
          </Link>

          <Link href="/dashboard">
            <button className="w-full bg-zinc-800 text-white rounded-lg py-3 font-bold text-sm">
              Dashboard
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