import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB-lWJZMnUfN_Ami8VRbqFhrkDlEQ98GdQ",
  authDomain: "deshiludo.firebaseapp.com",
  projectId: "deshiludo",
  storageBucket: "deshiludo.firebasestorage.app",
  messagingSenderId: "847601509318",
  appId: "1:847601509318:web:12a98642f3fc1268c6c8c7",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

/*
|--------------------------------------------------------------------------
| Permanent Login Session
|--------------------------------------------------------------------------
| Browser/app बंद होने के बाद भी user login रहेगा।
| Session केवल Logout करने या browser data clear करने पर हटेगा।
|--------------------------------------------------------------------------
*/

export const authPersistenceReady =
  typeof window !== "undefined"
    ? setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.error("Firebase persistence error:", error);
      })
    : Promise.resolve();