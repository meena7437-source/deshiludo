import Link from "next/link";
export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-5 border-b border-yellow-500">
        <Link href="/login">
  <button className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-semibold">
    Login
  </button>
</Link>
      </header>

      {/* Hero */}
      <section className="text-center py-16 px-5">
        <h2 className="text-5xl font-bold text-yellow-400">
          Play Ludo. Win Rewards.
        </h2>

        <p className="mt-5 text-gray-300 text-lg">
          India's Premium Ludo Battle Platform
        </p>

        <div className="mt-10 flex justify-center gap-4">
          <button className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-bold">
            Create Battle
          </button>

          <button className="border border-yellow-400 px-6 py-3 rounded-xl">
            Join Battle
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-6 p-6">
        <div className="bg-zinc-900 p-6 rounded-2xl">
          <h3 className="text-yellow-400 text-xl font-bold">💰 Wallet</h3>
          <p className="text-gray-300 mt-2">
            Add Money & Withdraw Instantly
          </p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl">
          <h3 className="text-yellow-400 text-xl font-bold">⚔️ Battles</h3>
          <p className="text-gray-300 mt-2">
            Create & Join Live Battles
          </p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl">
          <h3 className="text-yellow-400 text-xl font-bold">🎁 Referral</h3>
          <p className="text-gray-300 mt-2">
            Invite Friends & Earn Rewards
          </p>
        </div>
      </section>

      {/* Live Battles */}
      <section className="p-6">
        <h2 className="text-2xl font-bold text-yellow-400 mb-4">
          🔥 Live Battles
        </h2>

        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-xl p-5 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">Classic Battle</h3>
              <p className="text-gray-400">Entry ₹50 • Win ₹90</p>
            </div>

            <button className="bg-yellow-400 text-black px-5 py-2 rounded-lg font-bold">
              Join
            </button>
          </div>

          <div className="bg-zinc-900 rounded-xl p-5 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">Pro Battle</h3>
              <p className="text-gray-400">Entry ₹100 • Win ₹180</p>
            </div>

            <button className="bg-yellow-400 text-black px-5 py-2 rounded-lg font-bold">
              Join
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-6 text-center text-gray-400">
        © 2026 DeshiLudo • Play Fair • Secure Payments
      </footer>
    </main>
  );
}