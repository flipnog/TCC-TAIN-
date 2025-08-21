import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const btnLogin = document.getElementById("loginBtn");
const btnGoogle = document.getElementById("googleBtn");

btnLogin.addEventListener("click", async ()=>{
  const email = (emailEl.value||"").trim();
  const pass  = (passEl.value||"").trim();
  if(!email || !pass){ alert("Preencha e-mail e senha."); return; }
  try{
    await signInWithEmailAndPassword(auth, email, pass);
    window.location.href = "inicio.html";
  }catch(e){
    alert("Erro no login: " + (e.code || e.message));
  }
});

btnGoogle.addEventListener("click", async ()=>{
  try{
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    window.location.href = "inicio.html";
  }catch(e){
    alert("Erro no login com Google: " + (e.code || e.message));
  }
});