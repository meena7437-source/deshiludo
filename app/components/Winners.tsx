export default function Winners() {
  const winners = [
    { name: "Rahul", amount: "₹500" },
    { name: "Amit", amount: "₹1200" },
    { name: "Sohan", amount: "₹800" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-yellow-400 mb-4">
        🏆 Recent Winners
      </h2>

      <div className="space-y-3">
        {winners.map((winner, index) => (
          <div
            key={index}
            className="bg-zinc-900 border border-yellow-500 rounded-xl p-4 flex justify-between"
          >
            <span>{winner.name}</span>
            <span className="text-yellow-400 font-bold">
              {winner.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}