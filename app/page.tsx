import Link from "next/link";
import Image from "next/image";
import InstallAppButton from "./components/InstallAppButton";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-yellow-500">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="DeshiLudo"
            width={52}
            height={52}
            priority
            className="rounded-xl"
          />

          <div>
            <h1 className="text-xl font-extrabold text-yellow-400">
              DeshiLudo
            </h1>
            <p className="text-xs text-gray-400">Khelo • Jeeto • Kamao</p>
          </div>
        </div>

        <Link href="/login">
          <button className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold">
            Login
          </button>
        </Link>
      </header>

      <section className="text-center py-12 px-5">
        <div className="flex justify-center mb-5">
          <Image
            src="/logo.png"
            alt="DeshiLudo Logo"
            width={170}
            height={170}
            priority
            className="mx-auto"
          />
        </div>

        <h2 className="text-4xl md:text-5xl font-bold text-yellow-400">
          Play Ludo. Win Rewards.
        </h2>

        <p className="mt-4 text-gray-300 text-lg">
          India&apos;s Premium Ludo Battle Platform
        </p>

        <div className="mt-8 flex justify-center gap-4 flex-wrap">
          <Link href="/login">
            <button className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-bold">
              Create Battle
            </button>
          </Link>

          <Link href="/login">
            <button className="border border-yellow-400 px-6 py-3 rounded-xl">
              Join Battle
            </button>
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6 p-6">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <h3 className="text-yellow-400 text-xl font-bold">💰 Wallet</h3>
          <p className="text-gray-300 mt-2">Add Money & Withdraw Instantly</p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <h3 className="text-yellow-400 text-xl font-bold">⚔️ Battles</h3>
          <p className="text-gray-300 mt-2">Create & Join Live Battles</p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <h3 className="text-yellow-400 text-xl font-bold">🎁 Referral</h3>
          <p className="text-gray-300 mt-2">Invite Friends & Earn Rewards</p>
        </div>
      </section>

      <section className="p-6">
        <h2 className="text-2xl font-bold text-yellow-400 mb-4">
          🔥 Live Battles
        </h2>

        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-xl p-5 flex justify-between items-center border border-zinc-800">
            <div>
              <h3 className="font-bold text-lg">Classic Battle</h3>
              <p className="text-gray-400">Entry ₹50 • Win ₹90</p>
            </div>

            <Link href="/login">
              <button className="bg-yellow-400 text-black px-5 py-2 rounded-lg font-bold">
                Join
              </button>
            </Link>
          </div>

          <div className="bg-zinc-900 rounded-xl p-5 flex justify-between items-center border border-zinc-800">
            <div>
              <h3 className="font-bold text-lg">Pro Battle</h3>
              <p className="text-gray-400">Entry ₹100 • Win ₹180</p>
            </div>

            <Link href="/login">
              <button className="bg-yellow-400 text-black px-5 py-2 rounded-lg font-bold">
                Join
              </button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-6 text-center text-gray-400">
        © 2026 DeshiLudo • Play Fair • Secure Payments
      </footer>

      <InstallAppButton />
    </main>
  );
}