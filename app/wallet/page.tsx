"use client";

import { useRouter } from "next/navigation";

export default function WalletPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-black text-white p-5">
      <div className="max-w-xl mx-auto bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <h1 className="text-3xl font-bold text-green-400 mb-2">Wallet</h1>

        <p className="text-zinc-400 mb-6">
          Deposit aur Withdraw ka UI yahan rahega.
        </p>

        <div className="bg-zinc-800 rounded-xl p-5 mb-5">
          <p className="text-zinc-400">Wallet Balance</p>
          <h2 className="text-4xl font-bold text-green-400 mt-2">₹0</h2>
        </div>

        <input
          type="number"
          placeholder="Enter amount ₹"
          className="w-full p-4 rounded-xl bg-zinc-800 text-white mb-4 outline-none"
        />

        <button className="w-full bg-green-500 text-white font-bold py-4 rounded-xl mb-3">
          Deposit
        </button>

        <button className="w-full bg-yellow-400 text-black font-bold py-4 rounded-xl mb-3">
          Withdraw
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          className="w-full bg-zinc-800 text-white font-bold py-4 rounded-xl"
        >
          Back to Dashboard
        </button>
      </div>
    </main>
  );
}