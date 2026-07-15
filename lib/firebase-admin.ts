import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export function getFirebaseAdminAuth() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  if (!projectId) {
    throw new Error("FIREBASE_ADMIN_PROJECT_ID missing hai.");
  }

  if (!clientEmail) {
    throw new Error("FIREBASE_ADMIN_CLIENT_EMAIL missing hai.");
  }

  if (!privateKey) {
    throw new Error("FIREBASE_ADMIN_PRIVATE_KEY missing hai.");
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });

  return getAuth(app);
}