export default function Header() {
  return (
    <header className="flex items-center justify-between p-5 border-b border-yellow-500 bg-black">
      <h1 className="text-3xl font-bold text-yellow-400">
        DeshiLudo
      </h1>

      <div className="flex gap-3">
        <button className="border border-yellow-400 px-4 py-2 rounded-lg">
          Register
        </button>

        <button className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold">
          Login
        </button>
      </div>
    </header>
  );
}