import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCSgN3pASjCJumhrPy_Z1XcSfXBHMvVck",
  authDomain: "tech-run-girls-web.firebaseapp.com",
  projectId: "tech-run-girls-web",
  storageBucket: "tech-run-girls-web.appspot.com",
  messagingSenderId: "347627401714",
  appId: "1:347627401714:web:95d1747954006cfccc7b6b",
  measurementId: "G-7MG911DXMJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);