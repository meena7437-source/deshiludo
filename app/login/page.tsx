"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ConfirmationResult,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import {
  auth,
  authPersistenceReady,
} from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

function makeReferralCode(phoneNumber: string) {
  const last4 = phoneNumber.slice(-4);
  const random = Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase();

  return `DL${last4}${random}`;
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) {
    return err.message;
  }

  return "Something went wrong";
}

export default function LoginPage() {
  const router = useRouter();

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const [confirmation, setConfirmation] =
    useState<ConfirmationResult | null>(null);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  /*
  |--------------------------------------------------------------------------
  | Existing Login Session
  |--------------------------------------------------------------------------
  | User पहले से login है तो OTP page दिखाने के बजाय dashboard खोलेगा।
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let active = true;

    async function checkExistingLogin() {
      await authPersistenceReady;

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!active) return;

        if (user) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        setCheckingSession(false);
      });

      return unsubscribe;
    }

    let unsubscribe: (() => void) | undefined;

    checkExistingLogin().then((result) => {
      unsubscribe = result;
    });

    return () => {
      active = false;

      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [router]);

  /*
  |--------------------------------------------------------------------------
  | Firebase Recaptcha
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (checkingSession) return;

    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "normal",
        }
      );

      recaptchaRef.current.render().catch((error) => {
        console.error("Recaptcha render error:", error);
      });
    }

    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, [checkingSession]);

  async function resetRecaptcha() {
    try {
      recaptchaRef.current?.clear();
    } catch (error) {
      console.error("Recaptcha clear error:", error);
    }

    recaptchaRef.current = null;

    const container = document.getElementById(
      "recaptcha-container"
    );

    if (container) {
      container.innerHTML = "";
    }

    recaptchaRef.current = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "normal",
      }
    );

    await recaptchaRef.current.render();
  }

  async function sendOTP() {
    try {
      const cleanPhone = phone
        .trim()
        .replace(/\D/g, "");

      if (cleanPhone.length !== 10) {
        toast.error("10 digit mobile number enter karo");
        return;
      }

      setSending(true);

      await authPersistenceReady;

      if (!recaptchaRef.current) {
        await resetRecaptcha();
      }

      if (!recaptchaRef.current) {
        toast.error("Captcha load nahi hua, page refresh karo");
        return;
      }

      const result = await signInWithPhoneNumber(
        auth,
        `+91${cleanPhone}`,
        recaptchaRef.current
      );

      setConfirmation(result);
      setOtp("");

      toast.success("OTP sent successfully");
    } catch (err: unknown) {
      console.error("OTP send error:", err);

      toast.error(getErrorMessage(err));

      try {
        await resetRecaptcha();
      } catch (resetError) {
        console.error(
          "Recaptcha reset error:",
          resetError
        );
      }
    } finally {
      setSending(false);
    }
  }

  async function verifyOTP() {
    try {
      if (!confirmation) {
        toast.error("Pehle OTP send karo");
        return;
      }

      if (otp.length !== 6) {
        toast.error("6 digit OTP enter karo");
        return;
      }

      setVerifying(true);

      await authPersistenceReady;

      const userCredential =
        await confirmation.confirm(otp);

      const uid = userCredential.user.uid;

      const mobile =
        userCredential.user.phoneNumber ||
        `+91${phone}`;

      const {
        data: existingUser,
        error: userCheckError,
      } = await supabase
        .from("users")
        .select(
          "id,firebase_uid,referral_code,referred_by"
        )
        .eq("firebase_uid", uid)
        .maybeSingle();

      if (userCheckError) {
        toast.error(userCheckError.message);
        return;
      }

      let finalReferralCode =
        existingUser?.referral_code;

      if (!finalReferralCode) {
        finalReferralCode =
          makeReferralCode(mobile);
      }

      let finalReferredBy =
        existingUser?.referred_by || null;

      if (!existingUser && referralCode.trim()) {
        const enteredCode = referralCode
          .trim()
          .toUpperCase();

        const {
          data: refUser,
          error: refError,
        } = await supabase
          .from("users")
          .select("referral_code")
          .eq("referral_code", enteredCode)
          .maybeSingle();

        if (refError) {
          toast.error(refError.message);
          return;
        }

        if (!refUser) {
          toast.error("Referral code galat hai");
          return;
        }

        finalReferredBy = enteredCode;
      }

      const { error: saveUserError } =
        await supabase.from("users").upsert(
          {
            firebase_uid: uid,
            phone: mobile,
            referral_code: finalReferralCode,
            referred_by: finalReferredBy,
          },
          {
            onConflict: "firebase_uid",
          }
        );

      if (saveUserError) {
        toast.error(saveUserError.message);
        return;
      }

      toast.success("Login successful");

      router.replace("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      console.error("OTP verify error:", err);
      toast.error(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050510] text-white">
        <div className="text-center">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-zinc-800 border-t-yellow-400" />

          <p className="mt-4 text-sm font-black text-yellow-400">
            Login check हो रहा है...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050510] px-3 py-5 text-white sm:px-4">
      <section className="w-full max-w-sm rounded-[26px] border border-yellow-400/15 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 px-4 py-5 shadow-[0_0_35px_rgba(250,204,21,0.08)] sm:px-6 sm:py-6">
        <div className="flex justify-center">
          <div className="relative h-20 w-20 overflow-hidden rounded-[22px] border border-yellow-400/20 bg-black shadow-[0_0_24px_rgba(250,204,21,0.16)] sm:h-24 sm:w-24">
            <Image
              src="/logo.png"
              alt="DeshiLudo Logo"
              fill
              priority
              sizes="96px"
              className="object-contain p-1"
            />
          </div>
        </div>

        <div className="mt-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
            Khelo • Jeeto • Kamao
          </p>

          <h1 className="mt-1 text-2xl font-black leading-tight text-white sm:text-3xl">
            DeshiLudo
          </h1>

          <p className="mt-1 text-xs font-medium text-zinc-400 sm:text-sm">
            Mobile number और OTP से Login करें
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-zinc-400">
              Mobile Number
            </label>

            <div className="flex overflow-hidden rounded-xl border border-white/10 bg-zinc-900 focus-within:border-yellow-400/40">
              <span className="flex items-center border-r border-white/10 px-3 text-sm font-bold text-zinc-300">
                +91
              </span>

              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10 digit mobile number"
                value={phone}
                onChange={(event) =>
                  setPhone(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10)
                  )
                }
                maxLength={10}
                disabled={Boolean(confirmation)}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-zinc-400">
              Referral Code

              <span className="ml-1 font-medium text-zinc-600">
                Optional
              </span>
            </label>

            <input
              type="text"
              autoCapitalize="characters"
              placeholder="Referral code enter करें"
              value={referralCode}
              onChange={(event) =>
                setReferralCode(
                  event.target.value
                    .replace(/\s/g, "")
                    .toUpperCase()
                    .slice(0, 20)
                )
              }
              disabled={Boolean(confirmation)}
              className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm uppercase text-white outline-none placeholder:normal-case placeholder:text-zinc-600 focus:border-yellow-400/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="overflow-x-auto rounded-xl">
            <div
              id="recaptcha-container"
              className="flex min-h-[78px] justify-center"
            />
          </div>

          <button
            type="button"
            onClick={sendOTP}
            disabled={
              sending ||
              phone.length !== 10
            }
            className="w-full rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-black shadow-[0_8px_25px_rgba(250,204,21,0.16)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending
              ? "OTP भेजा जा रहा है..."
              : confirmation
                ? "OTP दोबारा भेजें"
                : "Send OTP"}
          </button>

          {confirmation && (
            <div className="rounded-2xl border border-green-400/15 bg-green-500/[0.06] p-3">
              <label className="mb-1.5 block text-[11px] font-bold text-green-300">
                OTP Verification
              </label>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 digit OTP enter करें"
                value={otp}
                onChange={(event) =>
                  setOtp(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6)
                  )
                }
                maxLength={6}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-center text-lg font-black tracking-[0.35em] text-white outline-none placeholder:text-xs placeholder:font-medium placeholder:tracking-normal placeholder:text-zinc-600 focus:border-green-400/40"
              />

              <button
                type="button"
                onClick={verifyOTP}
                disabled={
                  verifying ||
                  otp.length !== 6
                }
                className="mt-3 w-full rounded-xl bg-green-500 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifying
                  ? "Verify हो रहा है..."
                  : "Verify OTP"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2.5 text-center">
          <p className="text-[11px] leading-5 text-zinc-500">
            Login करने पर आप DeshiLudo के{" "}
            <Link
              href="/rules"
              className="font-bold text-yellow-400 underline decoration-yellow-400/40 underline-offset-2"
            >
              Game Rules & Terms
            </Link>{" "}
            को स्वीकार करते हैं।
          </p>
        </div>

        <p className="mt-4 text-center text-[10px] text-zinc-700">
          केवल 18 वर्ष या उससे अधिक आयु के उपयोगकर्ताओं के लिए
        </p>
      </section>
    </main>
  );
}