export default function BattleCard() {
  return (
    <div className="bg-zinc-900 border border-yellow-500 rounded-2xl p-5">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-yellow-400 text-xl font-bold">₹100 Battle</h3>
          <p className="text-gray-400">Prize: ₹180</p>
        </div>

        <button className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold">
          Join
        </button>
      </div>
    </div>
  );
}