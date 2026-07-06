import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB-lWJZMnUfN_Ami8VRbqFhrkDlEQ98GdQ",
  authDomain: "deshiludo.firebaseapp.com",
  projectId: "deshiludo",
  storageBucket: "deshiludo.firebasestorage.app",
  messagingSenderId: "847601509318",
  appId: "1:847601509318:web:12a98642f3fc1268c6c8c7",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);