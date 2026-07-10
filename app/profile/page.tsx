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

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [savedName, setSavedName] = useState("");
  const [savedUsername, setSavedUsername] = useState("");

  const [referralCode, setReferralCode] = useState("");
  const [kycStatus, setKycStatus] = useState("pending");
  const [aadhaarUrl, setAadhaarUrl] = useState("");
  const [panUrl, setPanUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
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
      console.error("Wallet load error:", error);
      toast.error("Wallet load nahi hua");
      return;
    }

    setBalance(Number(data?.balance || 0));
  }

  async function loadProfile(userId: string, userPhone: string) {
    await loadWallet(userId);

    const { data, error } = await supabase
      .from("users")
      .select(
        "name,username,referral_code,aadhaar_url,pan_url,kyc_status"
      )
      .eq("firebase_uid", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile load error:", error);
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
        console.error("Referral save error:", referralError);
        toast.error("Referral code save nahi hua");
      }
    }

    const loadedName = data?.name || "";
    const loadedUsername = data?.username || "";

    setName(loadedName);
    setUsername(loadedUsername);
    setSavedName(loadedName);
    setSavedUsername(loadedUsername);

    setReferralCode(code || "");
    setAadhaarUrl(data?.aadhaar_url || "");
    setPanUrl(data?.pan_url || "");
    setKycStatus(data?.kyc_status || "pending");
  }

  async function saveBasicProfile() {
    if (!uid) {
      toast.error("Login session missing");
      return;
    }

    const cleanName = name.trim().replace(/\s+/g, " ");
    const cleanUsername = username.trim().toLowerCase();

    if (cleanName.length < 2) {
      toast.error("Name kam se kam 2 letters ka hona chahiye");
      return;
    }

    if (cleanName.length > 50) {
      toast.error("Name 50 letters se chhota rakho");
      return;
    }

    if (cleanUsername.length < 4 || cleanUsername.length > 20) {
      toast.error("Username 4 se 20 characters ka hona chahiye");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      toast.error(
        "Username me sirf small letters, numbers aur underscore use karo"
      );
      return;
    }

    setSavingProfile(true);

    try {
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("firebase_uid")
        .eq("username", cleanUsername)
        .neq("firebase_uid", uid)
        .maybeSingle();

      if (checkError) {
        console.error("Username check error:", checkError);
        toast.error("Username check nahi hua");
        return;
      }

      if (existingUser) {
        toast.error("Ye username pehle se use ho raha hai");
        return;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: cleanName,
          username: cleanUsername,
        })
        .eq("firebase_uid", uid);

      if (updateError) {
        console.error("Profile update error:", updateError);

        if (
          updateError.code === "23505" ||
          updateError.message.toLowerCase().includes("duplicate")
        ) {
          toast.error("Ye username pehle se use ho raha hai");
          return;
        }

        toast.error(updateError.message || "Profile save nahi hua");
        return;
      }

      setName(cleanName);
      setUsername(cleanUsername);
      setSavedName(cleanName);
      setSavedUsername(cleanUsername);

      toast.success("Name aur username save ho gaya ✅");
    } catch (error: any) {
      console.error("Profile save error:", error);
      toast.error(error?.message || "Profile save nahi hua");
    } finally {
      setSavingProfile(false);
    }
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
      console.error("KYC upload error:", error);
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
      return "border border-green-500/30 bg-green-500/10 text-green-400";
    }

    if (kycStatus === "rejected") {
      return "border border-red-500/30 bg-red-500/10 text-red-400";
    }

    return "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
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

  const profileChanged =
    name.trim().replace(/\s+/g, " ") !== savedName ||
    username.trim().toLowerCase() !== savedUsername;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="DeshiLudo Logo"
            width={64}
            height={64}
            className="rounded-full border border-yellow-400/50 object-cover"
            priority
          />

          <p className="text-sm font-bold text-yellow-400">
            Loading Profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-3 pb-20 pt-3 text-white">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="DeshiLudo"
              width={42}
              height={42}
              className="h-[42px] w-[42px] shrink-0 rounded-full border border-yellow-400/40 object-cover"
              priority
            />

            <div className="min-w-0">
              <h1 className="text-xl font-black leading-tight text-yellow-400">
                Profile
              </h1>

              <p className="truncate text-[10px] text-zinc-500">
                {savedUsername
                  ? `@${savedUsername}`
                  : savedName || "DeshiLudo Player"}
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="shrink-0 rounded-lg bg-zinc-800 px-3 py-2 text-[11px] font-bold text-white"
          >
            Back
          </Link>
        </header>

        <section className="mb-3 rounded-2xl border border-yellow-500/20 bg-zinc-950 p-3">
          <div className="mb-2.5">
            <h2 className="text-sm font-black text-white">
              Player Details
            </h2>

            <p className="mt-0.5 text-[10px] text-zinc-500">
              Battle me username dikhaya jayega.
            </p>
          </div>

          <label className="text-[10px] font-bold text-zinc-400">
            Name
          </label>

          <input
            type="text"
            value={name}
            maxLength={50}
            onChange={(event) => setName(event.target.value)}
            placeholder="Apna naam daalo"
            disabled={savingProfile}
            className="mb-2.5 mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-60"
          />

          <label className="text-[10px] font-bold text-zinc-400">
            Unique Username
          </label>

          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
              @
            </span>

            <input
              type="text"
              value={username}
              maxLength={20}
              onChange={(event) =>
                setUsername(
                  event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "")
                )
              }
              placeholder="sher123"
              disabled={savingProfile}
              className="w-full rounded-xl border border-zinc-800 bg-black py-2.5 pl-7 pr-3 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-60"
            />
          </div>

          <p className="mt-1 text-[9px] text-zinc-600">
            4–20 characters • small letters, numbers aur underscore
          </p>

          <button
            type="button"
            onClick={saveBasicProfile}
            disabled={savingProfile || !profileChanged}
            className="mt-3 w-full rounded-xl bg-yellow-400 py-2.5 text-sm font-black text-black disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {savingProfile ? "Saving..." : "Save Name & Username"}
          </button>
        </section>

        <section className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-[10px] text-zinc-400">
            Mobile Number
          </p>

          <p className="mt-0.5 text-base font-black text-white">
            {phone || "User"}
          </p>

          <p className="mt-1 truncate text-[9px] text-zinc-600">
            UID: {uid}
          </p>
        </section>

        <section className="mb-3 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/15 via-zinc-950 to-black p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold text-green-300">
                Wallet Balance
              </p>

              <p className="mt-0.5 text-2xl font-black text-green-400">
                ₹{balance.toLocaleString("en-IN")}
              </p>
            </div>

            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[9px] font-black text-green-400">
              SINGLE WALLET
            </span>
          </div>
        </section>

        <Link
          href="/wallet-history"
          className="mb-3 block w-full rounded-xl border border-yellow-500/30 bg-zinc-950 py-2.5 text-center text-sm font-black text-yellow-400"
        >
          Wallet History →
        </Link>

        <section className="mb-3 rounded-xl border border-yellow-500/30 bg-yellow-400/10 p-3">
          <p className="text-[10px] text-zinc-400">
            Referral Code
          </p>

          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-lg font-black text-yellow-400">
              {referralCode || "Generating..."}
            </p>

            <button
              type="button"
              onClick={copyReferral}
              className="shrink-0 rounded-lg bg-yellow-400 px-3 py-2 text-[11px] font-black text-black"
            >
              Copy
            </button>
          </div>

          <p className="mt-1.5 text-[10px] text-zinc-500">
            Friend first deposit karega to aapko 5% bonus milega.
          </p>
        </section>

        <section className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-white">
                KYC Documents
              </h2>

              <p className="text-[10px] text-zinc-500">
                Aadhaar aur PAN upload karo.
              </p>
            </div>

            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${kycClass()}`}
            >
              {kycStatus}
            </span>
          </div>

          <div className="mb-2.5 rounded-lg border border-zinc-800 bg-black p-2">
            <p className="text-[10px] text-zinc-400">
              {kycMessage()}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="rounded-xl border border-zinc-800 bg-black p-2.5">
              <p className="text-xs font-bold text-zinc-300">
                Aadhaar Card
              </p>

              <p
                className={`mt-1 text-[10px] ${
                  aadhaarUrl ? "text-green-400" : "text-zinc-500"
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
                  className="mt-2.5 w-full text-[10px] text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-3 file:py-2 file:text-[10px] file:font-black file:text-black disabled:opacity-60"
                />
              )}

              {uploadingAadhaar && (
                <p className="mt-1.5 text-[10px] text-yellow-400">
                  Uploading Aadhaar...
                </p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black p-2.5">
              <p className="text-xs font-bold text-zinc-300">
                PAN Card
              </p>

              <p
                className={`mt-1 text-[10px] ${
                  panUrl ? "text-green-400" : "text-zinc-500"
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
                  className="mt-2.5 w-full text-[10px] text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-3 file:py-2 file:text-[10px] file:font-black file:text-black disabled:opacity-60"
                />
              )}

              {uploadingPan && (
                <p className="mt-1.5 text-[10px] text-yellow-400">
                  Uploading PAN...
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/deposit"
            className="rounded-lg bg-yellow-400 py-2.5 text-center text-xs font-black text-black"
          >
            Deposit
          </Link>

          <Link
            href="/withdraw"
            className="rounded-lg bg-green-500 py-2.5 text-center text-xs font-black text-black"
          >
            Withdraw
          </Link>

          <Link
            href="/support"
            className="rounded-lg bg-blue-600 py-2.5 text-center text-xs font-black text-white"
          >
            Help & Support
          </Link>

          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-red-600 py-2.5 text-xs font-black text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}
