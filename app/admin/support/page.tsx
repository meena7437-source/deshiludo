"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";

type Ticket = {
  id: number;
  uid: string;
  phone: string | null;
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

export default function AdminSupportPage() {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadTickets();

    const channel = supabase
      .channel("admin-support-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        async () => {
          await loadTickets(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  useEffect(() => {
    if (!activeTicket) return;

    loadMessages(activeTicket.id);

    const channel = supabase
      .channel(`admin-support-messages-${activeTicket.id}`)
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

  async function loadTickets(showLoader = true) {
    if (showLoader) setLoading(true);

    let query = supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;

    if (showLoader) setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setTickets(data || []);

    if (!activeTicket && data && data.length > 0) {
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

  async function uploadFile(ticketId: number) {
    if (!file) return null;

    const ext = file.name.split(".").pop();
    const path = `admin/${ticketId}/${Date.now()}.${ext}`;

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

  async function sendReply() {
    if (!activeTicket) {
      toast.error("Ticket select karo");
      return;
    }

    if (activeTicket.status === "closed") {
      toast.error("Ticket closed hai");
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
      sender: "admin",
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
    await loadTickets(false);
  }

  async function updateStatus(status: "open" | "closed") {
    if (!activeTicket) return;

    const { error } = await supabase
      .from("support_tickets")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeTicket.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(status === "closed" ? "Ticket closed" : "Ticket reopened");

    const updated = { ...activeTicket, status };
    setActiveTicket(updated);
    await loadTickets(false);
  }

  const filteredTickets = tickets.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    return (
      String(t.id).includes(q) ||
      (t.phone || "").toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.uid.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-yellow-400 font-bold">Loading tickets...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-3">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-yellow-400">Admin Support</h1>
            <p className="text-xs text-gray-400">
              Users ke tickets aur chat manage karo
            </p>
          </div>

          <Link href="/admin">
            <button className="bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg text-xs">
              Admin
            </button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">
            <div className="flex gap-2 mb-2">
              {["open", "closed", "all"].map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f);
                    setActiveTicket(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold ${
                    filter === f
                      ? "bg-yellow-400 text-black"
                      : "bg-black border border-gray-700 text-gray-300"
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone / ticket / subject"
              className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none mb-3"
            />

            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredTickets.length === 0 ? (
                <p className="text-xs text-gray-400">Ticket nahi mila</p>
              ) : (
                filteredTickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTicket(t)}
                    className={`w-full text-left p-2 rounded-lg border text-xs ${
                      activeTicket?.id === t.id
                        ? "border-yellow-400 bg-yellow-400/10"
                        : "border-gray-800 bg-black"
                    }`}
                  >
                    <div className="font-bold text-white">
                      #{t.id} {t.subject}
                    </div>

                    <div className="text-gray-400 mt-1">
                      {t.phone || "No phone"}
                    </div>

                    <div
                      className={
                        t.status === "open"
                          ? "text-green-400 mt-1"
                          : "text-red-400 mt-1"
                      }
                    >
                      {t.status.toUpperCase()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 md:col-span-2">
            {!activeTicket ? (
              <p className="text-gray-400 text-sm">Ticket select karo</p>
            ) : (
              <>
                <div className="border-b border-gray-800 pb-2 mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-sm">
                      #{activeTicket.id} {activeTicket.subject}
                    </h2>
                    <p className="text-xs text-gray-400">
                      Phone: {activeTicket.phone || "N/A"}
                    </p>
                    <p className="text-xs text-gray-500 break-all">
                      UID: {activeTicket.uid}
                    </p>
                    <p
                      className={`text-xs font-bold ${
                        activeTicket.status === "open"
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      Status: {activeTicket.status.toUpperCase()}
                    </p>
                  </div>

                  {activeTicket.status === "open" ? (
                    <button
                      onClick={() => updateStatus("closed")}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-bold"
                    >
                      Close
                    </button>
                  ) : (
                    <button
                      onClick={() => updateStatus("open")}
                      className="bg-green-500 text-white px-3 py-2 rounded-lg text-xs font-bold"
                    >
                      Reopen
                    </button>
                  )}
                </div>

                <div className="h-[430px] overflow-y-auto space-y-2 pr-1 mb-3">
                  {messages.length === 0 ? (
                    <p className="text-xs text-gray-400">Abhi message nahi hai</p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-2 rounded-lg max-w-[85%] text-sm ${
                          m.sender === "admin"
                            ? "ml-auto bg-yellow-400 text-black"
                            : "mr-auto bg-gray-800 text-white"
                        }`}
                      >
                        <div className="text-[10px] font-bold mb-1">
                          {m.sender === "admin" ? "Admin" : "User"}
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
                    Ticket closed hai. Reply karne ke liye Reopen karo.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Admin reply likho..."
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
                      onClick={sendReply}
                      disabled={sending}
                      className="w-full bg-yellow-400 text-black py-2 rounded-lg font-bold disabled:opacity-60"
                    >
                      {sending ? "Sending..." : "Send Reply"}
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