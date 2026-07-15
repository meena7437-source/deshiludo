"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { supabase } from "../../lib/supabase";

type LegalPage =
  | "about"
  | "privacy"
  | "terms"
  | "refund"
  | "contact"
  | null;

export default function ProfilePage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [balance, setBalance] = useState(0);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [savedName, setSavedName] = useState("");
  const [savedUsername, setSavedUsername] = useState("");

  const [referralCode, setReferralCode] = useState("");
  const [kycStatus, setKycStatus] = useState("pending");
  const [aadhaarUrl, setAadhaarUrl] = useState("");
  const [panUrl, setPanUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAadhaar, setUploadingAadhaar] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);

  const [legalPage, setLegalPage] = useState<LegalPage>(null);

  useEffect(() => {
    let walletChannel: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const userPhone = user.phoneNumber || "";

      setUid(user.uid);
      setPhone(userPhone);

      await loadProfile(user.uid, userPhone);

      walletChannel = supabase
        .channel(`profile-wallet-${user.uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallets",
            filter: `uid=eq.${user.uid}`,
          },
          (payload: any) => {
            setBalance(Number(payload.new?.balance || 0));
          }
        )
        .subscribe();

      setLoading(false);
    });

    return () => {
      unsubscribe();

      if (walletChannel) {
        supabase.removeChannel(walletChannel);
      }
    };
  }, [router]);

  useEffect(() => {
    if (legalPage) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [legalPage]);

  function makeReferralCode(userPhone: string, userId: string) {
    const cleanPhone = userPhone.replace(/\D/g, "");

    const last4 =
      cleanPhone.slice(-4) || userId.slice(0, 4).toUpperCase();

    const random = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();

    return `DL${last4}${random}`;
  }

  async function loadWallet(userId: string) {
    const { data, error } = await supabase
      .from("wallets")
      .select("balance")
      .eq("uid", userId)
      .maybeSingle();

    if (error) {
      console.error("Wallet load error:", error);
      toast.error("Wallet load nahi hua");
      return;
    }

    setBalance(Number(data?.balance || 0));
  }

  async function loadProfile(userId: string, userPhone: string) {
    await loadWallet(userId);

    const { data, error } = await supabase
      .from("users")
      .select(
        "name,username,referral_code,aadhaar_url,pan_url,kyc_status"
      )
      .eq("firebase_uid", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile load error:", error);
      toast.error("Profile load nahi hua");
      return;
    }

    let code = data?.referral_code;

    if (!code) {
      code = makeReferralCode(userPhone, userId);

      const { error: referralError } = await supabase
        .from("users")
        .update({
          referral_code: code,
        })
        .eq("firebase_uid", userId);

      if (referralError) {
        console.error("Referral save error:", referralError);
        toast.error("Referral code save nahi hua");
      }
    }

    const loadedName = data?.name || "";
    const loadedUsername = data?.username || "";

    setName(loadedName);
    setUsername(loadedUsername);
    setSavedName(loadedName);
    setSavedUsername(loadedUsername);

    setReferralCode(code || "");
    setAadhaarUrl(data?.aadhaar_url || "");
    setPanUrl(data?.pan_url || "");
    setKycStatus(data?.kyc_status || "pending");
  }

  async function saveBasicProfile() {
    const profileLocked =
      Boolean(savedName.trim()) && Boolean(savedUsername.trim());

    if (profileLocked) {
      toast.error("Name aur username pehle se locked hain");
      return;
    }

    if (!uid) {
      toast.error("Login session missing");
      return;
    }

    const cleanName = name.trim().replace(/\s+/g, " ");
    const cleanUsername = username.trim().toLowerCase();

    if (cleanName.length < 2) {
      toast.error("Name kam se kam 2 letters ka hona chahiye");
      return;
    }

    if (cleanName.length > 50) {
      toast.error("Name 50 letters se chhota rakho");
      return;
    }

    if (cleanUsername.length < 4 || cleanUsername.length > 20) {
      toast.error("Username 4 se 20 characters ka hona chahiye");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      toast.error(
        "Username me sirf small letters, numbers aur underscore use karo"
      );
      return;
    }

    setSavingProfile(true);

    try {
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("firebase_uid")
        .eq("username", cleanUsername)
        .neq("firebase_uid", uid)
        .maybeSingle();

      if (checkError) {
        console.error("Username check error:", checkError);
        toast.error("Username check nahi hua");
        return;
      }

      if (existingUser) {
        toast.error("Ye username pehle se use ho raha hai");
        return;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: cleanName,
          username: cleanUsername,
        })
        .eq("firebase_uid", uid);

      if (updateError) {
        console.error("Profile update error:", updateError);

        if (
          updateError.code === "23505" ||
          updateError.message.toLowerCase().includes("duplicate")
        ) {
          toast.error("Ye username pehle se use ho raha hai");
          return;
        }

        toast.error(updateError.message || "Profile save nahi hua");
        return;
      }

      setName(cleanName);
      setUsername(cleanUsername);
      setSavedName(cleanName);
      setSavedUsername(cleanUsername);

      toast.success("Name aur username save ho gaya ✅");
    } catch (error: any) {
      console.error("Profile save error:", error);
      toast.error(error?.message || "Profile save nahi hua");
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadKycDoc(
    type: "aadhaar" | "pan",
    file: File
  ) {
    try {
      if (!uid) {
        toast.error("User login nahi hai");
        return;
      }

      if (type === "aadhaar") {
        setUploadingAadhaar(true);
      }

      if (type === "pan") {
        setUploadingPan(true);
      }

      const formData = new FormData();

      formData.append("uid", uid);
      formData.append("type", type);
      formData.append("file", file);

      const response = await fetch("/api/kyc/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.message || "Upload failed");
        return;
      }

      if (type === "aadhaar") {
        setAadhaarUrl(result.path || "");
      }

      if (type === "pan") {
        setPanUrl(result.path || "");
      }

      setKycStatus("pending");

      toast.success(
        type === "aadhaar"
          ? "Aadhaar upload ho gaya"
          : "PAN upload ho gaya"
      );
    } catch (error: any) {
      console.error("KYC upload error:", error);
      toast.error(error?.message || "Upload failed");
    } finally {
      setUploadingAadhaar(false);
      setUploadingPan(false);
    }
  }

  async function copyReferral() {
    if (!referralCode) {
      toast.error("Referral code nahi mila");
      return;
    }

    try {
      await navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied");
    } catch {
      toast.error("Referral code copy nahi hua");
    }
  }


  function referralLink() {
    return `https://deshiludo.in/?ref=${referralCode}`;
  }

  async function shareReferral(platform:"whatsapp"|"telegram"|"instagram"|"copy"){
    const message=`🎮 DeshiLudo\n\nReferral Code: ${referralCode}\n${referralLink()}`;
    if(platform==="copy"||platform==="instagram"){
      await navigator.clipboard.writeText(message);
      toast.success(platform==="copy"?"Referral link copied":"Message copied. Instagram me paste karein.");
      return;
    }
    const url=platform==="whatsapp"
      ?`https://wa.me/?text=${encodeURIComponent(message)}`
      :`https://t.me/share/url?url=${encodeURIComponent(referralLink())}&text=${encodeURIComponent("Join DeshiLudo using my referral code: "+referralCode)}`;
    window.open(url,"_blank");
  }

  async function logout() {
    await signOut(auth);
    localStorage.removeItem("deshiludo_admin");
    router.replace("/login");
  }

  function kycClass() {
    if (kycStatus === "approved") {
      return "border border-green-500/30 bg-green-500/10 text-green-400";
    }

    if (kycStatus === "rejected") {
      return "border border-red-500/30 bg-red-500/10 text-red-400";
    }

    return "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  }

  function kycMessage() {
    if (kycStatus === "approved") {
      return "KYC approved hai.";
    }

    if (kycStatus === "rejected") {
      return "KYC reject hui hai. Documents dubara upload karo.";
    }

    return "KYC verification pending hai.";
  }

  function legalPageTitle() {
    if (legalPage === "about") {
      return "About Us";
    }

    if (legalPage === "privacy") {
      return "Privacy Policy";
    }

    if (legalPage === "terms") {
      return "Terms & Conditions";
    }

    if (legalPage === "refund") {
      return "Refund & Cancellation";
    }

    if (legalPage === "contact") {
      return "Contact Us";
    }

    return "";
  }

  function LegalContent() {
    if (legalPage === "about") {
      return (
        <div className="space-y-5">
          <LegalSection title="Welcome to DeshiLudo">
            <p>
              DeshiLudo is an online platform designed to provide a
              smooth, secure and enjoyable Ludo gaming experience.
            </p>

            <p>
              Our goal is to provide users with a simple interface,
              transparent battle system, fair gameplay and responsive
              customer support.
            </p>
          </LegalSection>

          <LegalSection title="Our Mission">
            <p>
              Our mission is to build a trusted gaming platform where
              users can participate in skill-based Ludo matches with a
              focus on fairness, security and user satisfaction.
            </p>
          </LegalSection>

          <LegalSection title="What We Offer">
            <ul className="space-y-2">
              <li>• Simple and user-friendly interface</li>
              <li>• Secure OTP-based account access</li>
              <li>• Transparent wallet and battle records</li>
              <li>• KYC-based withdrawal verification</li>
              <li>• Fair-play and anti-fraud measures</li>
              <li>• Help and support facility</li>
            </ul>
          </LegalSection>

          <LegalSection title="Fair Play">
            <p>
              We are committed to maintaining a fair environment for
              all users. Cheating, fake screenshots, multiple-account
              misuse, collusion or fraudulent activities may result in
              battle cancellation, account suspension or permanent
              account termination.
            </p>
          </LegalSection>

          <LegalSection title="Third-Party Game">
            <p>
              DeshiLudo provides a battle and result-management
              platform. Matches may be played through a supported
              third-party Ludo application using private rooms.
            </p>

            <p>
              DeshiLudo is an independent platform and is not claiming
              ownership of any third-party game, brand or application.
            </p>
          </LegalSection>

          <LegalSection title="Contact">
            <p>
              For questions, feedback or support, use the Help &
              Support option available in your Profile.
            </p>
          </LegalSection>
        </div>
      );
    }

    if (legalPage === "privacy") {
      return (
        <div className="space-y-5">
          <LegalSection title="Privacy Policy">
            <p>
              Effective Date: 12 July 2026
            </p>

            <p>
              This Privacy Policy explains how DeshiLudo collects,
              uses, stores and protects information when users access
              the platform.
            </p>
          </LegalSection>

          <LegalSection title="1. Information We Collect">
            <ul className="space-y-2">
              <li>• Name and username</li>
              <li>• Mobile number</li>
              <li>• Referral information</li>
              <li>• Wallet and transaction records</li>
              <li>• Deposit and withdrawal information</li>
              <li>• KYC documents, including Aadhaar and PAN</li>
              <li>• Battle records and result screenshots</li>
              <li>• Device, login and technical information</li>
            </ul>
          </LegalSection>

          <LegalSection title="2. How We Use Information">
            <ul className="space-y-2">
              <li>• To create and manage user accounts</li>
              <li>• To verify user identity</li>
              <li>• To process deposits and withdrawals</li>
              <li>• To manage battles and results</li>
              <li>• To provide customer support</li>
              <li>• To detect fraud and misuse</li>
              <li>• To comply with legal obligations</li>
              <li>• To improve platform security and performance</li>
            </ul>
          </LegalSection>

          <LegalSection title="3. KYC Information">
            <p>
              Aadhaar, PAN and other verification documents may be
              collected when required for KYC and withdrawal
              verification.
            </p>

            <p>
              Users must upload clear and correct documents belonging
              to themselves. False documents may lead to rejection or
              account suspension.
            </p>
          </LegalSection>

          <LegalSection title="4. Payment Information">
            <p>
              Payment and transaction details may be processed through
              banks, UPI providers or payment service providers.
              DeshiLudo may not directly store complete bank or card
              credentials.
            </p>
          </LegalSection>

          <LegalSection title="5. Sharing of Information">
            <p>
              We do not sell users&apos; personal information.
              Information may be shared only when reasonably required:
            </p>

            <ul className="space-y-2">
              <li>• With payment service providers</li>
              <li>• With identity-verification partners</li>
              <li>• To prevent fraud or illegal activities</li>
              <li>• When required by law or authorities</li>
              <li>• To protect users and the platform</li>
            </ul>
          </LegalSection>

          <LegalSection title="6. Data Security">
            <p>
              We use reasonable technical and organisational measures
              to protect user information. However, no internet-based
              system can guarantee complete security.
            </p>
          </LegalSection>

          <LegalSection title="7. User Responsibility">
            <p>
              Users are responsible for keeping their device, OTP and
              account access secure. Users must immediately report
              suspicious activity through Help & Support.
            </p>
          </LegalSection>

          <LegalSection title="8. Cookies and Technical Data">
            <p>
              The platform may use cookies, local storage and similar
              technologies to maintain sessions, improve performance
              and provide a better user experience.
            </p>
          </LegalSection>

          <LegalSection title="9. Policy Updates">
            <p>
              This Privacy Policy may be updated when required.
              Continued use of the platform after an update means the
              user accepts the revised policy.
            </p>
          </LegalSection>

          <LegalSection title="10. Contact">
            <p>
              For privacy-related queries, use the Help & Support
              option available in the Profile section.
            </p>
          </LegalSection>
        </div>
      );
    }

    if (legalPage === "terms") {
      return (
        <div className="space-y-5">
          <LegalSection title="Terms & Conditions">
            <p>
              Effective Date: 12 July 2026
            </p>

            <p>
              By registering, accessing or using DeshiLudo, you agree
              to these Terms & Conditions.
            </p>
          </LegalSection>

          <LegalSection title="1. Eligibility">
            <ul className="space-y-2">
              <li>• Users must be at least 18 years old.</li>
              <li>
                • Users must be legally allowed to participate under
                the laws applicable in their location.
              </li>
              <li>
                • Users must provide correct identity and account
                information.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="2. User Account">
            <ul className="space-y-2">
              <li>• One person should use only one account.</li>
              <li>
                • Users are responsible for activity performed through
                their account.
              </li>
              <li>
                • OTP, device access and account details must be kept
                secure.
              </li>
              <li>
                • False information may result in suspension or
                termination.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="3. Gameplay">
            <ul className="space-y-2">
              <li>
                • Players must follow the game rules displayed on the
                platform.
              </li>
              <li>
                • Matches must be played fairly using the required
                private-room process.
              </li>
              <li>
                • Fake result claims or edited screenshots are
                prohibited.
              </li>
              <li>
                • Users must not exploit technical errors or platform
                bugs.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="4. Battle Amount">
            <p>
              Battle entry amounts are deducted from the user&apos;s
              wallet according to the platform&apos;s battle rules.
              Users must verify the amount before creating or joining a
              battle.
            </p>
          </LegalSection>

          <LegalSection title="5. Deposits">
            <ul className="space-y-2">
              <li>
                • Deposits are credited after successful payment and
                verification.
              </li>
              <li>
                • Incorrect UTR, fake screenshots or fraudulent payment
                claims may be rejected.
              </li>
              <li>
                • Deposit processing time may vary depending on payment
                verification.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="6. Withdrawals">
            <ul className="space-y-2">
              <li>
                • KYC approval may be mandatory before withdrawal.
              </li>
              <li>
                • Withdrawal requests are subject to verification.
              </li>
              <li>
                • Incorrect bank or UPI details may cause delay or
                failure.
              </li>
              <li>
                • Suspicious transactions may be held for review.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="7. Bonuses and Referrals">
            <p>
              Bonus and referral benefits are subject to platform
              rules. Abuse, self-referral, fake accounts or
              manipulation may result in cancellation of bonus and
              suspension of related accounts.
            </p>
          </LegalSection>

          <LegalSection title="8. Fair Play and Fraud">
            <p>
              The following activities are prohibited:
            </p>

            <ul className="space-y-2">
              <li>• Fake or edited result screenshots</li>
              <li>• Multiple accounts controlled by one person</li>
              <li>• Collusion between players</li>
              <li>• Payment fraud or false UTR submission</li>
              <li>• Abuse, threats or harassment</li>
              <li>• Exploiting technical bugs</li>
              <li>• Attempting unauthorised system access</li>
            </ul>
          </LegalSection>

          <LegalSection title="9. Disputes">
            <p>
              In case of a dispute, DeshiLudo may review screenshots,
              account activity, battle records and other available
              evidence. The platform&apos;s decision will be based on
              the available evidence and applicable rules.
            </p>
          </LegalSection>

          <LegalSection title="10. Account Suspension">
            <p>
              DeshiLudo may temporarily or permanently restrict an
              account for fraud, rule violations, suspicious activity,
              legal requirements or risks to users and the platform.
            </p>
          </LegalSection>

          <LegalSection title="11. Technical Issues">
            <p>
              DeshiLudo is not responsible for losses caused by
              internet failure, device malfunction, third-party app
              issues, payment-provider downtime or circumstances
              beyond reasonable control.
            </p>
          </LegalSection>

          <LegalSection title="12. Third-Party Services">
            <p>
              Certain services, including payment processing and game
              applications, may be provided by third parties. Their
              separate terms and policies may also apply.
            </p>
          </LegalSection>

          <LegalSection title="13. Changes to Terms">
            <p>
              These Terms & Conditions may be updated when required.
              Continued use of the platform after changes means
              acceptance of the updated terms.
            </p>
          </LegalSection>
        </div>
      );
    }

    if (legalPage === "refund") {
      return (
        <div className="space-y-5">
          <LegalSection title="Refund & Cancellation Policy">
            <p>
              Effective Date: 12 July 2026
            </p>

            <p>
              This policy explains the conditions under which wallet
              refunds, battle cancellations and transaction reviews may
              be processed.
            </p>
          </LegalSection>

          <LegalSection title="1. Successful Deposits">
            <p>
              Once a successful deposit is verified and credited to the
              DeshiLudo wallet, it is generally not refundable to the
              original payment method.
            </p>
          </LegalSection>

          <LegalSection title="2. Payment Deducted but Wallet Not Credited">
            <p>
              If money is deducted from the user&apos;s bank or UPI
              account but is not credited to the DeshiLudo wallet, the
              user must submit valid transaction proof through Help &
              Support.
            </p>

            <p>
              The case will be reviewed after checking the UTR,
              transaction status and payment records.
            </p>
          </LegalSection>

          <LegalSection title="3. Failed Transactions">
            <p>
              Failed payment transactions are normally reversed by the
              bank or payment provider according to their processing
              timelines.
            </p>
          </LegalSection>

          <LegalSection title="4. Duplicate Transactions">
            <p>
              If the same payment is charged more than once, the user
              should report it with valid transaction details. A
              confirmed duplicate payment may be adjusted or refunded
              after verification.
            </p>
          </LegalSection>

          <LegalSection title="5. Battle Cancellation">
            <p>
              A battle entry amount will be returned to the applicable
              user wallet only when cancellation is permitted under the
              platform&apos;s battle rules.
            </p>

            <p>
              Battles already completed or settled cannot normally be
              cancelled.
            </p>
          </LegalSection>

          <LegalSection title="6. Both Players Cancel">
            <p>
              Where the platform&apos;s rules permit automatic
              cancellation after both players submit a valid cancel
              claim, the applicable entry amounts may be returned to
              the users&apos; wallets.
            </p>
          </LegalSection>

          <LegalSection title="7. Result Disputes">
            <p>
              A refund is not automatically issued merely because a
              player disputes a result. The matter may be reviewed
              using screenshots, claims and battle records.
            </p>
          </LegalSection>

          <LegalSection title="8. Withdrawal Cancellation">
            <p>
              A withdrawal request may not be cancellable after it has
              been approved or entered payment processing.
            </p>
          </LegalSection>

          <LegalSection title="9. Rejected Withdrawals">
            <p>
              If a withdrawal request is rejected before payment, the
              applicable amount will be returned or restored to the
              user&apos;s wallet according to the platform&apos;s
              system rules.
            </p>
          </LegalSection>

          <LegalSection title="10. Fraud and Misuse">
            <p>
              Refund or cancellation requests may be rejected when
              linked to fake payments, false screenshots, chargeback
              abuse, multiple accounts, collusion or other fraudulent
              activity.
            </p>
          </LegalSection>

          <LegalSection title="11. Review Time">
            <p>
              Transaction and refund review time may vary depending on
              the bank, payment provider, submitted evidence and
              verification requirements.
            </p>
          </LegalSection>

          <LegalSection title="12. Contact">
            <p>
              To report a payment, refund or cancellation issue, use
              the Help & Support option and provide the relevant battle
              ID, UTR, amount, date and screenshot.
            </p>
          </LegalSection>
        </div>
      );
    }

    if (legalPage === "contact") {
      return (
        <div className="space-y-5">
          <LegalSection title="Contact DeshiLudo">
            <p>
              For account, wallet, KYC, battle or technical issues, use
              the Help & Support option available in your Profile.
            </p>
          </LegalSection>

          <Link
            href="/support"
            onClick={() => setLegalPage(null)}
            className="flex w-full items-center justify-between rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20 text-xl">
                🎧
              </div>

              <div>
                <p className="text-sm font-black text-white">
                  Open Help & Support
                </p>

                <p className="mt-0.5 text-[10px] text-zinc-400">
                  Send message and issue details
                </p>
              </div>
            </div>

            <span className="text-xl font-black text-blue-400">
              ›
            </span>
          </Link>

          <LegalSection title="Support Topics">
            <ul className="space-y-2">
              <li>• Account and OTP issues</li>
              <li>• Deposit and UTR verification</li>
              <li>• Withdrawal and KYC issues</li>
              <li>• Battle disputes</li>
              <li>• Result screenshot problems</li>
              <li>• Wallet balance issues</li>
              <li>• Fraud or misuse reports</li>
              <li>• General feedback</li>
            </ul>
          </LegalSection>

          <LegalSection title="Information to Provide">
            <p>
              For faster support, include:
            </p>

            <ul className="space-y-2">
              <li>• Registered mobile number</li>
              <li>• Battle ID, when applicable</li>
              <li>• Transaction amount and date</li>
              <li>• UTR or payment reference</li>
              <li>• Clear screenshot or document</li>
              <li>• Short description of the issue</li>
            </ul>
          </LegalSection>

          <LegalSection title="Support Availability">
            <p>
              Support requests are reviewed as soon as reasonably
              possible. Response time may vary depending on the issue
              and verification required.
            </p>
          </LegalSection>

          <LegalSection title="Important">
            <p>
              Never share your OTP, password, PIN or complete banking
              credentials with anyone claiming to be support staff.
            </p>
          </LegalSection>
        </div>
      );
    }

    return null;
  }

  const profileLocked =
    Boolean(savedName.trim()) && Boolean(savedUsername.trim());

  const profileChanged =
    !profileLocked &&
    (name.trim().replace(/\s+/g, " ") !== savedName ||
      username.trim().toLowerCase() !== savedUsername);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="DeshiLudo Logo"
            width={64}
            height={64}
            className="rounded-full border border-yellow-400/50 object-cover"
            priority
          />

          <p className="text-sm font-bold text-yellow-400">
            Loading Profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-black px-3 pb-20 pt-3 text-white">
        <div className="mx-auto w-full max-w-md">
          <header className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="DeshiLudo"
                width={42}
                height={42}
                className="h-[42px] w-[42px] shrink-0 rounded-full border border-yellow-400/40 object-cover"
                priority
              />

              <div className="min-w-0">
                <h1 className="text-xl font-black leading-tight text-yellow-400">
                  Profile
                </h1>

                <p className="truncate text-[10px] text-zinc-500">
                  {savedUsername
                    ? `@${savedUsername}`
                    : savedName || "DeshiLudo Player"}
                </p>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="shrink-0 rounded-lg bg-zinc-800 px-3 py-2 text-[11px] font-bold text-white"
            >
              Back
            </Link>
          </header>

          <section className="mb-3 rounded-2xl border border-yellow-500/20 bg-zinc-950 p-3">
            <div className="mb-2.5">
              <h2 className="text-sm font-black text-white">
                Player Details
              </h2>

              <p className="mt-0.5 text-[10px] text-zinc-500">
                Battle me username dikhaya jayega.
              </p>
            </div>

            <label className="text-[10px] font-bold text-zinc-400">
              Name
            </label>

            <input
              type="text"
              value={name}
              maxLength={50}
              onChange={(event) => setName(event.target.value)}
              placeholder="Apna naam daalo"
              disabled={savingProfile || profileLocked}
              className="mb-2.5 mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-60"
            />

            <label className="text-[10px] font-bold text-zinc-400">
              Unique Username
            </label>

            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
                @
              </span>

              <input
                type="text"
                value={username}
                maxLength={20}
                onChange={(event) =>
                  setUsername(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, "")
                  )
                }
                placeholder="sher123"
                disabled={savingProfile || profileLocked}
                className="w-full rounded-xl border border-zinc-800 bg-black py-2.5 pl-7 pr-3 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-60"
              />
            </div>

            <p className="mt-1 text-[9px] text-zinc-600">
              4–20 characters • small letters, numbers aur underscore
            </p>

            {profileLocked ? (
              <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3">
                <p className="text-xs font-black text-green-400">
                  🔒 Name aur username locked hain
                </p>
                <p className="mt-1 text-[10px] leading-4 text-zinc-400">
                  Inhe user dobara change nahi kar sakta.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <p className="text-[10px] font-bold leading-4 text-yellow-300">
                    Name aur username dono ek saath save honge. Save hone ke
                    baad dono permanently lock ho jayenge.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={saveBasicProfile}
                  disabled={savingProfile || !profileChanged}
                  className="mt-3 w-full rounded-xl bg-yellow-400 py-2.5 text-sm font-black text-black disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  {savingProfile
                    ? "Saving..."
                    : "Save & Permanently Lock"}
                </button>
              </>
            )}
          </section>

          <section className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[10px] text-zinc-400">
              Mobile Number
            </p>

            <p className="mt-0.5 text-base font-black text-white">
              {phone || "User"}
            </p>

          </section>

          <section className="mb-3 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/15 via-zinc-950 to-black p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold text-green-300">
                  Wallet Balance
                </p>

                <p className="mt-0.5 text-2xl font-black text-green-400">
                  ₹{balance.toLocaleString("en-IN")}
                </p>
              </div>

              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[9px] font-black text-green-400">
                SINGLE WALLET
              </span>
            </div>
          </section>

          <Link
            href="/wallet-history"
            className="mb-3 block w-full rounded-xl border border-yellow-500/30 bg-zinc-950 py-2.5 text-center text-sm font-black text-yellow-400"
          >
            Wallet History →
          </Link>

          <section className="mb-3 rounded-xl border border-yellow-500/30 bg-yellow-400/10 p-3">
            <p className="text-[10px] text-zinc-400">
              Referral Code
            </p>

            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-lg font-black text-yellow-400">
                {referralCode || "Generating..."}
              </p>

              <button
                type="button"
                onClick={copyReferral}
                className="shrink-0 rounded-lg bg-yellow-400 px-3 py-2 text-[11px] font-black text-black"
              >
                Copy
              </button>
            </div>


            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => shareReferral("whatsapp")} className="rounded-lg bg-green-600 py-2 text-xs font-black text-white">WhatsApp</button>
              <button type="button" onClick={() => shareReferral("telegram")} className="rounded-lg bg-sky-600 py-2 text-xs font-black text-white">Telegram</button>
              <button type="button" onClick={() => shareReferral("instagram")} className="rounded-lg bg-pink-600 py-2 text-xs font-black text-white">Instagram</button>
              <button type="button" onClick={() => shareReferral("copy")} className="rounded-lg bg-zinc-800 py-2 text-xs font-black text-white">Copy Link</button>
            </div>
          </section>

          <section className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-white">
                  KYC Documents
                </h2>

                <p className="text-[10px] text-zinc-500">
                  Aadhaar aur PAN upload karo.
                </p>
              </div>

              <span
                className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${kycClass()}`}
              >
                {kycStatus}
              </span>
            </div>

            <div className="mb-2.5 rounded-lg border border-zinc-800 bg-black p-2">
              <p className="text-[10px] text-zinc-400">
                {kycMessage()}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="rounded-xl border border-zinc-800 bg-black p-2.5">
                <p className="text-xs font-bold text-zinc-300">
                  Aadhaar Card
                </p>

                <p
                  className={`mt-1 text-[10px] ${
                    aadhaarUrl
                      ? "text-green-400"
                      : "text-zinc-500"
                  }`}
                >
                  {aadhaarUrl
                    ? "Aadhaar uploaded ✅"
                    : "Aadhaar upload nahi hai."}
                </p>

                {kycStatus !== "approved" && (
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    disabled={uploadingAadhaar}
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        uploadKycDoc("aadhaar", file);
                      }

                      event.target.value = "";
                    }}
                    className="mt-2.5 w-full text-[10px] text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-3 file:py-2 file:text-[10px] file:font-black file:text-black disabled:opacity-60"
                  />
                )}

                {uploadingAadhaar && (
                  <p className="mt-1.5 text-[10px] text-yellow-400">
                    Uploading Aadhaar...
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-black p-2.5">
                <p className="text-xs font-bold text-zinc-300">
                  PAN Card
                </p>

                <p
                  className={`mt-1 text-[10px] ${
                    panUrl
                      ? "text-green-400"
                      : "text-zinc-500"
                  }`}
                >
                  {panUrl
                    ? "PAN uploaded ✅"
                    : "PAN card upload nahi hai."}
                </p>

                {kycStatus !== "approved" && (
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    disabled={uploadingPan}
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        uploadKycDoc("pan", file);
                      }

                      event.target.value = "";
                    }}
                    className="mt-2.5 w-full text-[10px] text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-3 file:py-2 file:text-[10px] file:font-black file:text-black disabled:opacity-60"
                  />
                )}

                {uploadingPan && (
                  <p className="mt-1.5 text-[10px] text-yellow-400">
                    Uploading PAN...
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="mb-3 overflow-hidden rounded-2xl border border-yellow-500/25 bg-zinc-950">
            <div className="border-b border-zinc-800 bg-gradient-to-r from-yellow-400/10 to-transparent px-3 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  📚
                </span>

                <div>
                  <h2 className="text-sm font-black text-white">
                    Legal & Information
                  </h2>

                  <p className="text-[10px] text-zinc-500">
                    Policies aur platform ki jankari
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-zinc-800">
              <LegalButton
                icon="👤"
                title="About Us"
                description="DeshiLudo ke baare me"
                onClick={() => setLegalPage("about")}
              />

              <LegalButton
                icon="🔒"
                title="Privacy Policy"
                description="Aapke data ki suraksha"
                onClick={() => setLegalPage("privacy")}
              />

              <LegalButton
                icon="📜"
                title="Terms & Conditions"
                description="Platform use karne ki shartein"
                onClick={() => setLegalPage("terms")}
              />

              <LegalButton
                icon="💰"
                title="Refund & Cancellation"
                description="Refund aur battle cancellation policy"
                onClick={() => setLegalPage("refund")}
              />

              <LegalButton
                icon="📞"
                title="Contact Us"
                description="Support aur contact information"
                onClick={() => setLegalPage("contact")}
              />
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/deposit"
              className="rounded-lg bg-yellow-400 py-2.5 text-center text-xs font-black text-black"
            >
              Deposit
            </Link>

            <Link
              href="/withdraw"
              className="rounded-lg bg-green-500 py-2.5 text-center text-xs font-black text-black"
            >
              Withdraw
            </Link>

            <Link
              href="/support"
              className="rounded-lg bg-blue-600 py-2.5 text-center text-xs font-black text-white"
            >
              Help & Support
            </Link>

            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-red-600 py-2.5 text-xs font-black text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </main>

      <div
        className={`fixed inset-0 z-[100] transition ${
          legalPage
            ? "pointer-events-auto"
            : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          aria-label="Close legal information"
          onClick={() => setLegalPage(null)}
          className={`absolute inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity duration-300 ${
            legalPage ? "opacity-100" : "opacity-0"
          }`}
        />

        <aside
          className={`absolute right-0 top-0 h-full w-[92%] max-w-md transform border-l border-yellow-500/20 bg-black shadow-[-20px_0_60px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out ${
            legalPage
              ? "translate-x-0"
              : "translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <header className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setLegalPage(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-black text-xl font-black text-white"
                >
                  ←
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-yellow-500">
                    DeshiLudo
                  </p>

                  <h2 className="truncate text-base font-black text-white">
                    {legalPageTitle()}
                  </h2>
                </div>

                <Image
                  src="/logo.png"
                  alt="DeshiLudo"
                  width={38}
                  height={38}
                  className="h-[38px] w-[38px] shrink-0 rounded-full border border-yellow-400/40 object-cover"
                />
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <LegalContent />

              <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-400/5 p-3 text-center">
                <p className="text-xs font-black text-yellow-400">
                  DeshiLudo
                </p>

                <p className="mt-1 text-[9px] text-zinc-500">
                  © 2026 DeshiLudo. All Rights Reserved.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function LegalButton({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/[0.03] active:bg-white/[0.06]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-black text-lg">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="truncate text-xs font-black text-white">
            {title}
          </p>

          <p className="mt-0.5 truncate text-[9px] text-zinc-500">
            {description}
          </p>
        </div>
      </div>

      <span className="shrink-0 text-xl font-black text-yellow-400">
        ›
      </span>
    </button>
  );
}

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="mb-2 text-sm font-black text-yellow-400">
        {title}
      </h3>

      <div className="space-y-3 text-[11px] leading-5 text-zinc-300">
        {children}
      </div>
    </section>
  );
}