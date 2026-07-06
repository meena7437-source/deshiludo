export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-yellow-500">
      <div className="flex justify-around py-3 text-white">
        <button>🏠<br />Home</button>
        <button>⚔️<br />Battle</button>
        <button>💰<br />Wallet</button>
        <button>👤<br />Profile</button>
      </div>
    </nav>
  );
}