"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

type Announcement = {
  id: number;
  message: string;
  is_active: boolean;
  updated_at: string | null;
};

type AnnouncementResponse = {
  success: boolean;
  message?: string;
  announcement?: Announcement | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "अभी तक update नहीं हुआ";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date उपलब्ध नहीं";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminAnnouncementPage() {
  const [message, setMessage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const maxLength = 300;
  const remainingCharacters = maxLength - message.length;

  useEffect(() => {
    loadAnnouncement();
  }, []);

  async function loadAnnouncement(showMainLoader = true) {
    try {
      if (showMainLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const response = await fetch("/api/admin/announcement", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = (await response.json()) as AnnouncementResponse;

      if (response.status === 401) {
        window.location.href = "/admin-login";
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Announcement load नहीं हो पाया"
        );
      }

      if (result.announcement) {
        setMessage(result.announcement.message || "");
        setIsActive(result.announcement.is_active === true);
        setUpdatedAt(result.announcement.updated_at || null);
      } else {
        setMessage("");
        setIsActive(false);
        setUpdatedAt(null);
      }
    } catch (error: unknown) {
      console.error("Announcement load error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Announcement load नहीं हो पाया"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function saveAnnouncement() {
    const cleanMessage = message.trim();

    if (isActive && !cleanMessage) {
      toast.error("Active announcement के लिए message लिखना जरूरी है");
      return;
    }

    if (cleanMessage.length > maxLength) {
      toast.error(`Message अधिकतम ${maxLength} अक्षर का हो सकता है`);
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/admin/announcement", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: cleanMessage,
          is_active: isActive,
        }),
      });

      const result = (await response.json()) as AnnouncementResponse;

      if (response.status === 401) {
        window.location.href = "/admin-login";
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Announcement save नहीं हुआ"
        );
      }

      if (result.announcement) {
        setMessage(result.announcement.message || "");
        setIsActive(result.announcement.is_active === true);
        setUpdatedAt(result.announcement.updated_at || null);
      }

      toast.success(
        isActive
          ? "Announcement सभी users के लिए चालू हो गया"
          : "Announcement बंद कर दिया गया"
      );
    } catch (error: unknown) {
      console.error("Announcement save error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Announcement save नहीं हुआ"
      );
    } finally {
      setSaving(false);
    }
  }

  function useExample(exampleMessage: string) {
    setMessage(exampleMessage);
    setIsActive(true);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07070b] text-white">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-10 text-center">
            <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-zinc-700 border-t-yellow-400" />

            <p className="mt-4 font-bold text-zinc-400">
              Announcement load हो रहा है...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-4xl px-4 py-5">
        <section className="mb-5 rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/50">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
                DeshiLudo Admin
              </p>

              <h1 className="mt-2 text-3xl font-black">
                Announcement Manager
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                Dashboard पर सभी users को दिखने वाला message नियंत्रित करें।
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => loadAnnouncement(false)}
                disabled={refreshing || saving}
                className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-black text-green-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/admin"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300"
              >
                ← Admin
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className={`rounded-2xl border p-4 ${
                isActive
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-red-500/30 bg-red-500/10"
              }`}
            >
              <p
                className={`text-xs font-bold ${
                  isActive ? "text-green-300" : "text-red-300"
                }`}
              >
                Current Status
              </p>

              <p
                className={`mt-1 text-2xl font-black ${
                  isActive ? "text-green-400" : "text-red-400"
                }`}
              >
                {isActive ? "ACTIVE" : "INACTIVE"}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-xs font-bold text-blue-300">
                Last Updated
              </p>

              <p className="mt-2 text-sm font-black text-blue-200">
                {formatDate(updatedAt)}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 shadow-xl shadow-black/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Announcement Status</h2>

              <p className="mt-1 text-sm text-zinc-500">
                बंद करने पर dashboard से announcement line गायब हो जाएगी।
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((current) => !current)}
              className={`relative h-8 w-16 shrink-0 rounded-full border transition ${
                isActive
                  ? "border-green-400/50 bg-green-500"
                  : "border-zinc-700 bg-zinc-800"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-lg transition-all ${
                  isActive ? "left-9" : "left-1"
                }`}
              />
            </button>
          </div>

          <div
            className={`mt-4 rounded-2xl border p-4 ${
              isActive
                ? "border-green-500/20 bg-green-500/10"
                : "border-zinc-800 bg-black"
            }`}
          >
            <p
              className={`font-black ${
                isActive ? "text-green-300" : "text-zinc-500"
              }`}
            >
              {isActive
                ? "Announcement अभी users को दिखाई देगा"
                : "Announcement अभी users को दिखाई नहीं देगा"}
            </p>
          </div>
        </section>

        <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 shadow-xl shadow-black/30">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label
              htmlFor="announcement-message"
              className="text-xl font-black"
            >
              Message
            </label>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-black ${
                remainingCharacters < 30
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-zinc-700 bg-black text-zinc-400"
              }`}
            >
              {message.length}/{maxLength}
            </span>
          </div>

          <textarea
            id="announcement-message"
            value={message}
            onChange={(event) =>
              setMessage(event.target.value.slice(0, maxLength))
            }
            rows={6}
            placeholder="उदाहरण: आज रात 10 बजे maintenance के कारण site 15 मिनट बंद रहेगी।"
            className="w-full resize-none rounded-[22px] border border-zinc-800 bg-black px-4 py-4 text-base font-bold leading-7 text-white outline-none placeholder:font-normal placeholder:text-zinc-600 focus:border-yellow-400/50"
          />

          <div className="mt-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-xs text-zinc-500">
              Emoji, Hindi और English सभी लिख सकते हैं।
            </p>

            <p
              className={`text-xs font-bold ${
                remainingCharacters < 30
                  ? "text-red-400"
                  : "text-zinc-500"
              }`}
            >
              {remainingCharacters} अक्षर बाकी
            </p>
          </div>
        </section>

        <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 shadow-xl shadow-black/30">
          <h2 className="text-xl font-black">Live Preview</h2>

          <p className="mt-1 text-sm text-zinc-500">
            Dashboard पर announcement लगभग ऐसा दिखाई देगा।
          </p>

          <div className="mt-4 overflow-hidden rounded-2xl border border-yellow-400/30 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10">
            <div className="flex items-center">
              <div className="shrink-0 border-r border-yellow-400/30 bg-yellow-400 px-3 py-3 text-sm font-black text-black">
                📢 सूचना
              </div>

              <div className="min-w-0 flex-1 overflow-hidden px-3 py-3">
                {message.trim() ? (
                  <p className="whitespace-nowrap font-bold text-yellow-200">
                    {message.trim()}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-600">
                    Message लिखने पर preview यहाँ दिखाई देगा।
                  </p>
                )}
              </div>
            </div>
          </div>

          {!isActive && (
            <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-sm font-bold text-red-300">
                Preview मौजूद है, लेकिन announcement OFF होने के कारण users
                को नहीं दिखेगा।
              </p>
            </div>
          )}
        </section>

        <section className="mb-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 shadow-xl shadow-black/30">
          <h2 className="text-xl font-black">Quick Messages</h2>

          <p className="mt-1 text-sm text-zinc-500">
            किसी example पर click करके उसे edit कर सकते हैं।
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                useExample(
                  "🎉 DeshiLudo में आपका स्वागत है। जिम्मेदारी से खेलें और नियमों का पालन करें।"
                )
              }
              className="rounded-2xl border border-zinc-800 bg-black p-4 text-left text-sm font-bold text-zinc-300 hover:border-yellow-400/30"
            >
              🎉 Welcome Message
            </button>

            <button
              type="button"
              onClick={() =>
                useExample(
                  "⚠️ किसी भी user के साथ OTP, password या UPI PIN share न करें।"
                )
              }
              className="rounded-2xl border border-zinc-800 bg-black p-4 text-left text-sm font-bold text-zinc-300 hover:border-yellow-400/30"
            >
              ⚠️ Security Alert
            </button>

            <button
              type="button"
              onClick={() =>
                useExample(
                  "🛠️ आज रात maintenance के कारण site कुछ समय के लिए बंद रह सकती है।"
                )
              }
              className="rounded-2xl border border-zinc-800 bg-black p-4 text-left text-sm font-bold text-zinc-300 hover:border-yellow-400/30"
            >
              🛠️ Maintenance Notice
            </button>

            <button
              type="button"
              onClick={() =>
                useExample(
                  "💳 Deposit या Withdraw request submit करने के बाद approval का इंतजार करें।"
                )
              }
              className="rounded-2xl border border-zinc-800 bg-black p-4 text-left text-sm font-bold text-zinc-300 hover:border-yellow-400/30"
            >
              💳 Payment Notice
            </button>
          </div>
        </section>

        <section className="sticky bottom-3 z-20 rounded-[24px] border border-yellow-400/30 bg-black/90 p-4 shadow-2xl shadow-black backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={saveAnnouncement}
              disabled={saving}
              className="flex-1 rounded-2xl bg-yellow-400 px-5 py-4 font-black text-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving Announcement..."
                : isActive
                ? "Save & Show to All Users"
                : "Save & Keep Announcement Off"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMessage("");
                setIsActive(false);
              }}
              disabled={saving}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 font-black text-red-300 disabled:opacity-50"
            >
              Clear & Turn Off
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}