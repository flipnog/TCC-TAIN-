import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const nomeEl   = document.getElementById("nome");
const catEl    = document.getElementById("categoria");
const intro    = document.getElementById("intro");
const pbar     = document.getElementById("pbar");
const pbarPct  = document.getElementById("pbarPct");
const resumoRes= document.getElementById("resumoRes");

const drawer = document.getElementById("drawer");
document.getElementById("btnHamb")?.addEventListener("click", ()=> drawer?.classList.toggle("show"));
const doLogout = async ()=>{ try{ await signOut(auth); window.location.href="login.html"; }catch(e){ alert(e.message);} };
document.getElementById("btnLogout")?.addEventListener("click", doLogout);
document.getElementById("btnLogout2")?.addEventListener("click", doLogout);

let ME = null;

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="login.html"; return; }

  const usnap = await getDoc(doc(db,"usuarios",user.uid));
  if(!usnap.exists()){ window.location.href="cadastro.html"; return; }

  const me = usnap.data();
  ME = me;

  if (me.tipo === "tutora") { window.location.href = "tutora.html"; return; }

  nomeEl.textContent = me.nome || user.displayName || "Estudante";
  catEl.textContent  = me.categoriaSugerida || "Sem categoria sugerida ainda";
  intro.textContent  = "Bem-vinda ao seu painel! O futuro começa aqui!.";

  if (me.papelSugerido) {
    const tags = (me.questionario?.topTags || []).join(", ");
    resumoRes.textContent = `${me.papelSugerido} — top tags: ${tags}`;
  } else {
    resumoRes.textContent = "Você ainda não finalizou o questionário. Use o menu para respondê-lo quando quiser.";
  }

  try{
    const tSnap = await getDocs(collection(db,"usuarios",user.uid,"trilha"));
    let done = 0, total = 0;
    tSnap.forEach(d=>{ total++; if(d.data().done) done++; });
    const pct = total ? Math.round((done/total)*100) : 0;
    if (pbar)    pbar.style.width = pct+"%";
    if (pbarPct) pbarPct.textContent = `${pct}% concluído`;
  }catch(_){}

  document.querySelectorAll(".link-resultado").forEach(a=>{
    a.addEventListener("click",(e)=>{
      e.preventDefault();
      const finished = (ME?.questionarioFinalizado === true) ||
                       ((ME?.questionario?.topTags || []).length > 0);
      window.location.href = finished ? "resultado.html" : "formulario.html";
    });
  });
});