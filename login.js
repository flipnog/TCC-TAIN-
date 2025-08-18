import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function smartRedirect(uid){
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) {
    window.location.href = "cadastro.html";
    return;
  }
  const u = snap.data();

  if (u.tipo === "tutora") {
    window.location.href = "tutora.html";
    return;
  }

  if (u.questionarioFinalizado === true) {
    window.location.href = "resultado.html";   // já finalizou -> vai pro resultado
  } else {
    window.location.href = "formulario.html";  // ainda não finalizou -> faz formulário
  }
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await smartRedirect(cred.user.uid);
  } catch (e) { alert("Erro no login: " + e.message); }
});

document.getElementById('googleBtn').addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);
    await smartRedirect(res.user.uid);
  } catch (e) { alert("Erro no login com Google: " + e.message); }
});