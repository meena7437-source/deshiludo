export default function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-yellow-500 mt-10 py-6 text-center text-gray-400">
      <p className="text-yellow-400 font-bold text-lg">DeshiLudo</p>

      <p className="mt-2">
        © 2026 DeshiLudo. All Rights Reserved.
      </p>

      <div className="mt-4 flex justify-center gap-6">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms & Conditions</a>
        <a href="#">Contact</a>
      </div>
    </footer>
  );
}