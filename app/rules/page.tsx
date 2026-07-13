"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

const rules = [
  {
    title: "1. आयु सीमा",
    content: [
      "केवल 18 वर्ष या उससे अधिक आयु के उपयोगकर्ता ही DeshiLudo का उपयोग कर सकते हैं।",
    ],
  },
  {
    title: "2. KYC",
    content: [
      "Winning Balance Withdraw करने के लिए KYC Approved होना अनिवार्य है।",
    ],
  },
  {
    title: "3. Deposit",
    content: [
      "न्यूनतम Deposit ₹100 है।",
      "Deposit सफल होने के बाद ही Wallet में राशि जोड़ी जाएगी।",
    ],
  },
  {
    title: "4. Withdraw",
    content: [
      "न्यूनतम Withdraw ₹100 है।",
      "केवल Winning Balance ही Withdraw की जा सकती है।",
      "Deposit Balance Withdraw नहीं की जा सकती।",
    ],
  },
  {
    title: "5. Battle Rules",
    content: [
      "न्यूनतम Battle Amount ₹100 है।",
      "Battle Amount केवल ₹50 के गुणकों में होगी।",
      "एक Battle में केवल संबंधित दोनों खिलाड़ी ही भाग ले सकते हैं।",
    ],
  },
  {
},
{
  title: "6. Battle Join करने से पहले शर्तें पढ़ें",
  content: [
    "Battle Join करने से पहले Creator द्वारा लिखी गई सभी शर्तों को ध्यानपूर्वक पढ़ें।",
    "यदि आप उन सभी शर्तों का पालन कर सकते हैं, तभी Battle Join करें।",
    "अन्यथा Battle Cancel करके किसी अन्य उपयुक्त Player के साथ नई Battle शुरू करें।",
  ],
},
  {
    title: "7. Result और Screenshot",
    content: [
      "जीतने वाला खिलाड़ी आवश्यकतानुसार Result Screenshot अपलोड करेगा।",
      "गलत, नकली, अधूरा या Edit किया हुआ Screenshot देने पर Account पर कार्रवाई की जा सकती है।",
    ],
  },
  {
    title: "8. Bonus",
    content: [
      "First Deposit Bonus 5% केवल पहली सफल Deposit पर मिलेगा।",
      "Referral Bonus 5% केवल Refer किए गए User की पहली सफल Deposit पर मिलेगा।",
    ],
  },
  {
    title: "9. Fair Play",
    content: [
      "Fake Screenshot, Multi Account, Cheating, Hacking, Bug Abuse और Fraud Activity प्रतिबंधित है।",
      "Auto Clicker, Emulator, Script, Bot या Unfair Software का उपयोग प्रतिबंधित है।",
      "नियम तोड़ने पर Account Suspend या Permanently Ban किया जा सकता है।",
      "गंभीर Fraud या Cheating की स्थिति में Wallet Balance जब्त किया जा सकता है।",
    ],
  },
  {
    title: "10. Refund",
    content: [
      "Refund केवल उन्हीं मामलों में दिया जाएगा जहाँ Platform Policy के अनुसार Battle Cancel या कोई वैध कारण लागू हो।",
      "गलत Claim, User की गलती या नियमों के उल्लंघन की स्थिति में Refund नहीं दिया जाएगा।",
    ],
  },
  {
    title: "11. अंतिम निर्णय",
    content: [
      "किसी भी विवाद की स्थिति में DeshiLudo Admin का निर्णय अंतिम और सभी खिलाड़ियों पर बाध्यकारी होगा।",
    ],
  },
  {
    title: "12. नियमों में बदलाव",
    content: [
      "DeshiLudo बिना पूर्व सूचना के किसी भी समय इन नियमों में संशोधन कर सकता है।",
      "Platform का उपयोग जारी रखने का अर्थ नए नियमों को स्वीकार करना होगा।",
    ],
  },
  {
    title: "13. Technical Issues",
    content: [
      "Internet Problem, Network Issue, Mobile Hang, Battery Low, App Crash, Call आने, Screen Lock या User Device की समस्या के लिए DeshiLudo जिम्मेदार नहीं होगा।",
      "Battle शुरू करने से पहले खिलाड़ी अपने Internet, Battery और Device की स्थिति जाँच लें।",
    ],
  },
];

export default function RulesPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#050510] text-white">
      <div className="mx-auto min-h-screen w-full max-w-md px-3 pb-8 pt-3 sm:px-4 sm:pt-5">
        <header className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-bold text-zinc-200 transition active:scale-95"
          >
            <span className="text-base leading-none">←</span>
            Back
          </button>

          <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-yellow-300">
            Official Rules
          </span>
        </header>

        <section className="mb-3 overflow-hidden rounded-[24px] border border-yellow-400/20 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 px-4 py-5 shadow-[0_0_30px_rgba(250,204,21,0.09)]">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-yellow-400/25 bg-black shadow-[0_0_18px_rgba(250,204,21,0.18)] sm:h-16 sm:w-16">
              <Image
                src="/logo.png"
                alt="DeshiLudo Logo"
                fill
                priority
                sizes="64px"
                className="object-contain p-1"
              />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-400">
                DeshiLudo
              </p>

              <h1 className="mt-0.5 text-xl font-black leading-tight text-white sm:text-2xl">
                Game Rules
              </h1>

              <p className="mt-1 text-[11px] font-medium leading-4 text-zinc-400 sm:text-xs">
                Khelo • Jeeto • Kamao
              </p>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-[1.65] text-zinc-300 sm:text-sm">
            Battle खेलने, Deposit करने या Withdraw करने से पहले सभी नियम ध्यान
            से पढ़ें।
          </p>

          <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2.5">
            <p className="text-[12px] font-semibold leading-5 text-red-200 sm:text-[13px]">
              DeshiLudo का उपयोग करने का अर्थ है कि आप इन सभी नियमों को स्वीकार
              करते हैं।
            </p>
          </div>
        </section>

        <div className="space-y-2.5">
          {rules.map((rule) => (
            <section
              key={rule.title}
              className="rounded-[18px] border border-white/10 bg-white/[0.035] px-3.5 py-3.5"
            >
              <h2 className="mb-2 text-[14px] font-extrabold leading-5 text-yellow-300 sm:text-[15px]">
                {rule.title}
              </h2>

              <div className="space-y-1.5">
{(rule.content ?? []).map((line, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />

                    <p className="text-[12px] leading-[1.65] text-zinc-300 sm:text-[13px]">
                      {line}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-4 rounded-[18px] border border-green-400/20 bg-green-500/10 px-4 py-3 text-center">
          <p className="text-[12px] font-bold leading-5 text-green-300 sm:text-[13px]">
            Fair Play करें और सुरक्षित तरीके से Battle खेलें।
          </p>
        </section>

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 w-full rounded-2xl bg-yellow-400 px-4 py-3.5 text-[13px] font-black text-black shadow-[0_8px_25px_rgba(250,204,21,0.18)] transition active:scale-[0.98]"
        >
          मैंने सभी नियम पढ़ लिए हैं
        </button>

        <p className="pb-2 pt-4 text-center text-[10px] text-zinc-600">
          © 2026 DeshiLudo. All rights reserved.
        </p>
      </div>
    </main>
  );
}