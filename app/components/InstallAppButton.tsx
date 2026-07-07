"use client";

import { useEffect, useState } from "react";

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPromptEvent(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const installApp = async () => {
    if (!promptEvent) return;

    promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };

  if (!promptEvent) return null;

  return (
    <button
      onClick={installApp}
      className="fixed bottom-5 right-5 z-50 bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl shadow-lg"
    >
      📲 Install App
    </button>
  );
}