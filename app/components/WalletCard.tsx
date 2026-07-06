export default function WalletCard() {
  return (
    <div className="bg-yellow-400 text-black rounded-2xl p-6 mb-6">
      <h2 className="text-xl font-bold">My Wallet</h2>
      <p className="text-3xl font-bold mt-2">₹0.00</p>

      <div className="flex gap-3 mt-5">
        <button className="bg-black text-white px-4 py-2 rounded-lg">
          Add Money
        </button>

        <button className="border border-black px-4 py-2 rounded-lg">
          Withdraw
        </button>
      </div>
    </div>
  );
}