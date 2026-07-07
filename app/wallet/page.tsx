"use client";

import { useRouter } from "next/navigation";

export default function WalletPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#050510] text-white pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">

        <div className="rounded-[28px] border border-green-400/20 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-5 shadow-[0_0_35px_rgba(34,197,94,0.12)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-green-300">DESHILUDO</p>
              <h1 className="text-3xl font-black text-white">Wallet</h1>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl border border-zinc-700 bg-black px-4 py-2 text-sm font-bold"
            >
              Back
            </button>
          </div>

          <div className="mt-6 rounded-[24px] border border-green-400/30 bg-green-500/10 p-5 shadow-[0_0_25px_rgba(34,197,94,0.15)]">
            <p className="text-sm font-bold text-green-300">Wallet Balance</p>
            <h2 className="mt-2 text-5xl font-black text-green-400">₹0</h2>
            <p className="mt-2 text-xs text-zinc-400">
              Balance live update hoga.
            </p>
          </div>
        </div>

        <section className="mt-5 rounded-[28px] border border-yellow-400/20 bg-zinc-950 p-4">
          <h2 className="text-xl font-black">Add / Withdraw Money</h2>
          <p className="text-xs text-zinc-400">Amount enter karo</p>

          <input
            type="number"
            placeholder="₹ Amount"
            className="mt-4 w-full rounded-2xl border border-zinc-700 bg-black px-4 py-4 text-xl font-black text-yellow-400 outline-none placeholder:text-zinc-600 focus:border-yellow-400"
          />

          <button
            onClick={() => router.push("/deposit")}
            className="mt-4 w-full rounded-2xl bg-green-500 py-4 font-black text-black shadow-[0_0_25px_rgba(34,197,94,0.25)] active:scale-[0.98]"
          >
            Deposit
          </button>

          <button
            onClick={() => router.push("/withdraw")}
            className="mt-3 w-full rounded-2xl bg-gradient-to-r from-yellow-300 to-orange-500 py-4 font-black text-black shadow-[0_0_25px_rgba(234,179,8,0.25)] active:scale-[0.98]"
          >
            Withdraw
          </button>
        </section>

        <section className="mt-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="text-xl font-black">Wallet Rules</h2>

          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            <div className="rounded-2xl bg-black/60 p-3">
              ✅ Deposit admin approval ke baad wallet me add hoga.
            </div>

            <div className="rounded-2xl bg-black/60 p-3">
              ✅ Withdraw request approve hone ke baad payment milega.
            </div>

            <div className="rounded-2xl bg-black/60 p-3">
              ✅ Battle create/join karte hi amount wallet se cut hoga.
            </div>
          </div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95">
        <div className="mx-auto grid max-w-md grid-cols-5 py-2 text-center text-[11px] font-bold text-zinc-400">
          <button onClick={() => router.push("/dashboard")}>
            <div className="text-lg">🏠</div>
            Home
          </button>

          <button onClick={() => router.push("/battle-history")}>
            <div className="text-lg">⚔️</div>
            History
          </button>

          <button onClick={() => router.push("/dashboard")}>
            <div className="text-lg">➕</div>
            Create
          </button>

          <button className="text-yellow-400">
            <div className="text-lg">💰</div>
            Wallet
          </button>

          <button onClick={() => router.push("/profile")}>
            <div className="text-lg">👤</div>
            Profile
          </button>
        </div>
      </nav>
    </main>
  );
}