import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const meNomeEl = document.getElementById("meNome");
const meEmailEl = document.getElementById("meEmail");
const inpEspec = document.getElementById("inpEspec");
const chips = document.getElementById("chips");
const btnSalvar = document.getElementById("btnSalvar");

function norm(s){ return (s||"").toString().toLowerCase().trim(); }
function splitEspecialidades(s){ return (s||"").split(",").map(x=>x.trim()).filter(Boolean); }
function renderChips(list){
  chips.innerHTML = (list||[]).map(s=>`<span class="pill">${s}</span>`).join(" ")
    || `<span class="muted">Nenhuma especialidade informada</span>`;
}

async function salvarEspecialidades(uid){
  const raw = inpEspec.value || "";
  const arr = splitEspecialidades(raw);
  await setDoc(doc(db,"usuarios",uid), {
    especialidades: arr,
    especialidadesNorm: arr.map(norm),
    atualizadoEm: new Date()
  }, { merge:true });
  renderChips(arr);
  alert("Especialidades atualizadas!");
}

btnSalvar?.addEventListener("click", async ()=>{ 
  const uid = auth.currentUser?.uid; if(!uid) return;
  try{ await salvarEspecialidades(uid); }catch(e){ alert("Erro ao salvar: "+e.message); }
});

inpEspec?.addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ e.preventDefault(); btnSalvar.click(); } });

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="login.html"; return; }
  const uref = doc(db,"usuarios",user.uid);
  let snap = await getDoc(uref);
  if(!snap.exists()){
    await setDoc(uref, { tipo:"tutora", email:user.email||"", atualizadoEm:new Date() }, { merge:true });
    snap = await getDoc(uref);
  }
  const me = snap.data();
  if(me.tipo!=="tutora"){ alert("Área exclusiva para Tutoras."); window.location.href="login.html"; return; }
  meNomeEl.textContent  = me.nome || (user.displayName || "Tutora");
  meEmailEl.textContent = me.email || (user.email || "");
  const espec = me.especialidades || [];
  inpEspec.value = espec.join(", ");
  renderChips(espec);
});