export default function Stats() {
  return (
    <section className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
      <div className="bg-zinc-900 rounded-xl p-4 text-center border border-yellow-500">
        <h3 className="text-yellow-400 text-2xl font-bold">25K+</h3>
        <p>Players</p>
      </div>

      <div className="bg-zinc-900 rounded-xl p-4 text-center border border-yellow-500">
        <h3 className="text-yellow-400 text-2xl font-bold">5K+</h3>
        <p>Battles</p>
      </div>

      <div className="bg-zinc-900 rounded-xl p-4 text-center border border-yellow-500">
        <h3 className="text-yellow-400 text-2xl font-bold">₹10L+</h3>
        <p>Prize Paid</p>
      </div>

      <div className="bg-zinc-900 rounded-xl p-4 text-center border border-yellow-500">
        <h3 className="text-yellow-400 text-2xl font-bold">24×7</h3>
        <p>Support</p>
      </div>
    </section>
  );
}