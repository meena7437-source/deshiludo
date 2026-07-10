"use client";

import Image from "next/image";
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
  const [balance, setBalance] = useState(0);

  const [referralCode, setReferralCode] = useState("");
  const [kycStatus, setKycStatus] = useState("pending");
  const [aadhaarUrl, setAadhaarUrl] = useState("");
  const [panUrl, setPanUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [uploadingAadhaar, setUploadingAadhaar] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);

  useEffect(() => {
    let walletChannel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const userPhone = user.phoneNumber || "";

      setUid(user.uid);
      setPhone(userPhone);

      await loadProfile(user.uid, userPhone);

      walletChannel = supabase
        .channel(`profile-wallet-${user.uid}`)
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

  function makeReferralCode(userPhone: string, userId: string) {
    const cleanPhone = userPhone.replace(/\D/g, "");
    const last4 =
      cleanPhone.slice(-4) || userId.slice(0, 4).toUpperCase();

    const random = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();

    return `DL${last4}${random}`;
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

  async function loadProfile(
    userId: string,
    userPhone: string
  ) {
    await loadWallet(userId);

    const { data, error } = await supabase
      .from("users")
      .select(
        "referral_code, aadhaar_url, pan_url, kyc_status"
      )
      .eq("firebase_uid", userId)
      .maybeSingle();

    if (error) {
      toast.error("Profile load nahi hua");
      return;
    }

    let code = data?.referral_code;

    if (!code) {
      code = makeReferralCode(userPhone, userId);

      const { error: referralError } = await supabase
        .from("users")
        .update({
          referral_code: code,
        })
        .eq("firebase_uid", userId);

      if (referralError) {
        toast.error("Referral code save nahi hua");
      }
    }

    setReferralCode(code || "");
    setAadhaarUrl(data?.aadhaar_url || "");
    setPanUrl(data?.pan_url || "");
    setKycStatus(data?.kyc_status || "pending");
  }

  async function uploadKycDoc(
    type: "aadhaar" | "pan",
    file: File
  ) {
    try {
      if (!uid) {
        toast.error("User login nahi hai");
        return;
      }

      if (type === "aadhaar") {
        setUploadingAadhaar(true);
      }

      if (type === "pan") {
        setUploadingPan(true);
      }

      const formData = new FormData();

      formData.append("uid", uid);
      formData.append("type", type);
      formData.append("file", file);

      const response = await fetch("/api/kyc/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.message || "Upload failed");
        return;
      }

      if (type === "aadhaar") {
        setAadhaarUrl(result.path || "");
      }

      if (type === "pan") {
        setPanUrl(result.path || "");
      }

      setKycStatus("pending");

      toast.success(
        type === "aadhaar"
          ? "Aadhaar upload ho gaya"
          : "PAN upload ho gaya"
      );
    } catch (error: any) {
      toast.error(error?.message || "Upload failed");
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

    try {
      await navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied");
    } catch {
      toast.error("Referral code copy nahi hua");
    }
  }

  async function logout() {
    await signOut(auth);
    localStorage.removeItem("deshiludo_admin");
    router.replace("/login");
  }

  function kycClass() {
    if (kycStatus === "approved") {
      return "text-green-400 bg-green-500/10 border border-green-500/30";
    }

    if (kycStatus === "rejected") {
      return "text-red-400 bg-red-500/10 border border-red-500/30";
    }

    return "text-yellow-400 bg-yellow-500/10 border border-yellow-500/30";
  }

  function kycMessage() {
    if (kycStatus === "approved") {
      return "KYC approved hai.";
    }

    if (kycStatus === "rejected") {
      return "KYC reject hui hai. Documents dubara upload karo.";
    }

    return "KYC verification pending hai.";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="DeshiLudo Logo"
            width={76}
            height={76}
            className="rounded-full border border-yellow-400/50 object-cover"
            priority
          />

          <p className="font-bold text-yellow-400">
            Loading Profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-3 pb-24 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-3 flex items-center justify-between">
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
              <h1 className="text-2xl font-black text-yellow-400">
                Profile
              </h1>

              <p className="text-[11px] text-zinc-500">
                DeshiLudo Player
              </p>
            </div>
          </div>

          <Link href="/dashboard">
            <button className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-white">
              Back
            </button>
          </Link>
        </div>

        <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-400">
            Mobile Number
          </p>

          <p className="text-lg font-black text-white">
            {phone || "User"}
          </p>

          <p className="mt-1 break-all text-[10px] text-zinc-600">
            UID: {uid}
          </p>
        </div>

        <div className="mb-3 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/15 via-zinc-950 to-black p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-green-300">
                Wallet Balance
              </p>

              <p className="mt-1 text-3xl font-black text-green-400">
                ₹{balance}
              </p>
            </div>

            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] font-black text-green-400">
              SINGLE WALLET
            </span>
          </div>
        </div>

        <Link href="/wallet-history">
          <button className="mb-3 w-full rounded-xl border border-yellow-500/30 bg-zinc-950 py-3 text-sm font-black text-yellow-400">
            Wallet History →
          </button>
        </Link>

        <div className="mb-3 rounded-xl border border-yellow-500/30 bg-yellow-400/10 p-3">
          <p className="text-xs text-zinc-400">
            Referral Code
          </p>

          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="break-all text-xl font-black text-yellow-400">
              {referralCode || "Generating..."}
            </p>

            <button
              onClick={copyReferral}
              className="rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-black"
            >
              Copy
            </button>
          </div>

          <p className="mt-2 text-[11px] text-zinc-500">
            Friend first deposit karega to aapko 5% bonus milega.
          </p>
        </div>

        <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">
                KYC Documents
              </h2>

              <p className="text-[11px] text-zinc-500">
                Aadhaar aur PAN upload karo.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${kycClass()}`}
            >
              {kycStatus}
            </span>
          </div>

          <div className="mb-3 rounded-lg border border-zinc-800 bg-black p-2">
            <p className="text-[11px] text-zinc-400">
              {kycMessage()}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-black p-3">
              <p className="mb-2 text-sm font-bold text-zinc-300">
                Aadhaar Card
              </p>

              <p
                className={`text-xs ${
                  aadhaarUrl
                    ? "text-green-400"
                    : "text-zinc-500"
                }`}
              >
                {aadhaarUrl
                  ? "Aadhaar uploaded ✅"
                  : "Aadhaar upload nahi hai."}
              </p>

              {kycStatus !== "approved" && (
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={uploadingAadhaar}
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                      uploadKycDoc("aadhaar", file);
                    }

                    event.target.value = "";
                  }}
                  className="mt-3 w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-3 file:py-2 file:text-xs file:font-black file:text-black disabled:opacity-60"
                />
              )}

              {uploadingAadhaar && (
                <p className="mt-2 text-xs text-yellow-400">
                  Uploading Aadhaar...
                </p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black p-3">
              <p className="mb-2 text-sm font-bold text-zinc-300">
                PAN Card
              </p>

              <p
                className={`text-xs ${
                  panUrl
                    ? "text-green-400"
                    : "text-zinc-500"
                }`}
              >
                {panUrl
                  ? "PAN uploaded ✅"
                  : "PAN card upload nahi hai."}
              </p>

              {kycStatus !== "approved" && (
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={uploadingPan}
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                      uploadKycDoc("pan", file);
                    }

                    event.target.value = "";
                  }}
                  className="mt-3 w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-3 file:py-2 file:text-xs file:font-black file:text-black disabled:opacity-60"
                />
              )}

              {uploadingPan && (
                <p className="mt-2 text-xs text-yellow-400">
                  Uploading PAN...
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <Link href="/deposit">
            <button className="w-full rounded-lg bg-yellow-400 py-3 text-sm font-black text-black">
              Deposit
            </button>
          </Link>

          <Link href="/withdraw">
            <button className="w-full rounded-lg bg-green-500 py-3 text-sm font-black text-black">
              Withdraw
            </button>
          </Link>

          <Link href="/support">
            <button className="w-full rounded-lg bg-blue-600 py-3 text-sm font-black text-white">
              Help & Support
            </button>
          </Link>

          <button
            onClick={logout}
            className="w-full rounded-lg bg-red-600 py-3 text-sm font-black text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}