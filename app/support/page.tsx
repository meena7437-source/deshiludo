"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

type Ticket = {
  id: number;
  uid: string;
  phone: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: number;
  ticket_id: number;
  sender: string;
  message: string | null;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
  created_at: string;
};

export default function SupportPage() {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        toast.error("Please login first");
        window.location.href = "/login";
        return;
      }

      setUid(user.uid);
      setPhone(user.phoneNumber || "");
      await loadTickets(user.uid);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activeTicket) return;

    loadMessages(activeTicket.id);

    const channel = supabase
      .channel(`support-ticket-${activeTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${activeTicket.id}`,
        },
        async () => {
          await loadMessages(activeTicket.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTicket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadTickets(userUid: string) {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("uid", userUid)
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    setTickets(data || []);

    if (data && data.length > 0) {
      setActiveTicket(data[0]);
    }
  }

  async function loadMessages(ticketId: number) {
    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      return;
    }

    setMessages(data || []);
  }

  async function createTicket() {
    if (!subject.trim()) {
      toast.error("Problem subject likho");
      return;
    }

    setSending(true);

    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        uid,
        phone,
        subject: subject.trim(),
        status: "open",
      })
      .select()
      .single();

    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Ticket create ho gaya");
    setSubject("");
    setActiveTicket(data);
    await loadTickets(uid);
  }

  async function uploadFile(ticketId: number) {
    if (!file) return null;

    const ext = file.name.split(".").pop();
    const path = `${uid}/${ticketId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("support-files")
      .upload(path, file);

    if (error) {
      toast.error(error.message);
      return null;
    }

    const { data } = supabase.storage
      .from("support-files")
      .getPublicUrl(path);

    return {
      url: data.publicUrl,
      type: file.type,
      name: file.name,
    };
  }

  async function sendMessage() {
    if (!activeTicket) {
      toast.error("Ticket select karo");
      return;
    }

    if (activeTicket.status === "closed") {
      toast.error("Ye ticket closed hai");
      return;
    }

    if (!text.trim() && !file) {
      toast.error("Message ya file bhejo");
      return;
    }

    setSending(true);

    const uploaded = await uploadFile(activeTicket.id);

    const { error } = await supabase.from("support_messages").insert({
      ticket_id: activeTicket.id,
      sender: "user",
      message: text.trim() || null,
      file_url: uploaded?.url || null,
      file_type: uploaded?.type || null,
      file_name: uploaded?.name || null,
    });

    if (!error) {
      await supabase
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeTicket.id);
    }

    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setText("");
    setFile(null);
    await loadMessages(activeTicket.id);
    await loadTickets(uid);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-yellow-400 font-bold">Loading support...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-3">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-yellow-400">Help & Support</h1>
            <p className="text-xs text-gray-400">Admin se direct help lo</p>
          </div>

          <Link href="/profile">
            <button className="bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg text-xs">
              Back
            </button>
          </Link>
        </div>

        <div className="bg-gray-950 border border-yellow-500/30 rounded-xl p-3 mb-3">
          <h2 className="font-bold mb-2 text-sm">New Ticket</h2>

          <div className="flex gap-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Problem title likho"
              className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none"
            />

            <button
              onClick={createTicket}
              disabled={sending}
              className="bg-yellow-400 text-black px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60"
            >
              Create
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 md:col-span-1">
            <h2 className="font-bold mb-2 text-sm">My Tickets</h2>

            {tickets.length === 0 ? (
              <p className="text-xs text-gray-400">Abhi koi ticket nahi hai</p>
            ) : (
              <div className="space-y-2">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTicket(t)}
                    className={`w-full text-left p-2 rounded-lg border text-xs ${
                      activeTicket?.id === t.id
                        ? "border-yellow-400 bg-yellow-400/10"
                        : "border-gray-800 bg-black"
                    }`}
                  >
                    <div className="font-bold text-white">#{t.id} {t.subject}</div>
                    <div
                      className={
                        t.status === "open"
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {t.status.toUpperCase()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 md:col-span-2">
            {!activeTicket ? (
              <p className="text-gray-400 text-sm">Ticket create ya select karo</p>
            ) : (
              <>
                <div className="border-b border-gray-800 pb-2 mb-2">
                  <h2 className="font-bold text-sm">
                    #{activeTicket.id} {activeTicket.subject}
                  </h2>
                  <p
                    className={`text-xs ${
                      activeTicket.status === "open"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    Status: {activeTicket.status.toUpperCase()}
                  </p>
                </div>

                <div className="h-[360px] overflow-y-auto space-y-2 pr-1 mb-3">
                  {messages.length === 0 ? (
                    <p className="text-xs text-gray-400">Abhi message nahi hai</p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-2 rounded-lg max-w-[85%] text-sm ${
                          m.sender === "user"
                            ? "ml-auto bg-yellow-400 text-black"
                            : "mr-auto bg-gray-800 text-white"
                        }`}
                      >
                        <div className="text-[10px] font-bold mb-1">
                          {m.sender === "user" ? "You" : "Admin"}
                        </div>

                        {m.message && <p>{m.message}</p>}

                        {m.file_url && (
                          <a
                            href={m.file_url}
                            target="_blank"
                            className="block mt-2 underline text-xs font-bold"
                          >
                            📎 {m.file_name || "Open File"}
                          </a>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                {activeTicket.status === "closed" ? (
                  <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm">
                    Ye ticket admin ne close kar diya hai.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Apna message likho..."
                      rows={3}
                      className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none"
                    />

                    <input
                      type="file"
                      accept="image/*,video/*,.pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="w-full text-xs bg-black border border-gray-700 rounded-lg p-2"
                    />

                    {file && (
                      <p className="text-xs text-yellow-400">
                        Selected: {file.name}
                      </p>
                    )}

                    <button
                      onClick={sendMessage}
                      disabled={sending}
                      className="w-full bg-yellow-400 text-black py-2 rounded-lg font-bold disabled:opacity-60"
                    >
                      {sending ? "Sending..." : "Send Message"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}