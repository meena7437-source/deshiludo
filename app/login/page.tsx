"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] =
    useState<ConfirmationResult | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "normal",
        }
      );

      recaptchaRef.current.render();
    }
  }, []);

  const sendOTP = async () => {
    try {
      if (phone.length !== 10) {
        toast.error("10 digit mobile number enter karo");
        return;
      }

      if (!recaptchaRef.current) {
        toast.error("Captcha load nahi hua, page refresh karo");
        return;
      }

      setSending(true);

      const result = await signInWithPhoneNumber(
        auth,
        "+91" + phone,
        recaptchaRef.current
      );

      setConfirmation(result);
      toast.success("OTP sent successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "OTP send failed");
    } finally {
      setSending(false);
    }
  };

  const verifyOTP = async () => {
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

      const userCredential = await confirmation.confirm(otp);

      const { error } = await supabase.from("users").upsert(
        {
          firebase_uid: userCredential.user.uid,
          phone: userCredential.user.phoneNumber,
        },
        {
          onConflict: "firebase_uid",
        }
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Login successful");
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Login failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-sm border border-zinc-800">
        <h1 className="text-3xl font-bold text-yellow-400 mb-6 text-center">
          Login
        </h1>

        <input
          type="tel"
          placeholder="Enter Mobile Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={10}
          className="w-full p-3 rounded-lg bg-zinc-800 text-white mb-4 outline-none"
        />

        <div id="recaptcha-container" className="mb-4"></div>

        <button
          onClick={sendOTP}
          disabled={sending}
          className="w-full bg-yellow-400 disabled:opacity-60 text-black font-bold py-3 rounded-lg mb-4"
        >
          {sending ? "Sending..." : "Send OTP"}
        </button>

        <input
          type="text"
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength={6}
          className="w-full p-3 rounded-lg bg-zinc-800 text-white mb-4 outline-none"
        />

        <button
          onClick={verifyOTP}
          disabled={verifying}
          className="w-full bg-green-500 disabled:opacity-60 text-white font-bold py-3 rounded-lg"
        >
          {verifying ? "Verifying..." : "Verify OTP"}
        </button>
      </div>
    </main>
  );
}