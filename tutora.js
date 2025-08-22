import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const meNomeEl = document.getElementById("meNome");
const meEmailEl = document.getElementById("meEmail");
const inpEspec = document.getElementById("inpEspec");
const chips = document.getElementById("chips");
const btnSalvar = document.getElementById("btnSalvar");

const mQtd = document.getElementById("mQtd");
const mMedia = document.getElementById("mMedia");
const alunasHint = document.getElementById("alunasHint");
const alunasGrid = document.getElementById("alunasGrid");

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

async function getProgressoTrilha(estudanteId){
  try{
    const snap = await getDocs(collection(db,"usuarios",estudanteId,"trilha"));
    let total=0, done=0;
    snap.forEach(d=>{ total++; if(d.data().done) done++; });
    const pct = total ? Math.round((done/total)*100) : 0;
    return { total, done, pct };
  }catch{
    return { total:0, done:0, pct:0 };
  }
}

async function carregarAnalise(tutoraId){
  alunasHint.textContent = "Carregando…";
  alunasGrid.innerHTML = "";

  const stSnap = await getDocs(collection(db,"usuarios",tutoraId,"alunas"));
  const ids = [];
  stSnap.forEach(d=>{
    const data = d.data();
    if (data?.status === "acompanhando") ids.push(d.id);
  });

  if (ids.length === 0){
    mQtd.textContent = "0";
    mMedia.textContent = "0%";
    alunasHint.textContent = "Você ainda não está acompanhando nenhuma aluna. Escolha em “Alunas”.";
    return;
  }

  const cards = [];
  let somaPct = 0;

  for (const id of ids){
    const u = await getDoc(doc(db,"usuarios",id));
    if (!u.exists()) continue;
    const data = u.data();
    const prog = await getProgressoTrilha(id);
    somaPct += prog.pct;

    const div = document.createElement("div");
    div.className = "card-aluna";
    div.innerHTML = `
      <p class="name">${data.nome || "Estudante"}</p>
      <div class="muted">${data.categoriaSugerida || "-"} • ${data.papelSugerido || "-"}</div>
      <div class="progress"><span style="width:${prog.pct}%"></span></div>
      <div class="muted">${prog.pct}% concluído${prog.total?` • ${prog.done}/${prog.total} tópicos`:''}</div>
    `;
    cards.push(div);
  }

  const qtd = cards.length;
  const media = qtd ? Math.round(somaPct / qtd) : 0;
  mQtd.textContent = String(qtd);
  mMedia.textContent = media + "%";

  alunasGrid.innerHTML = "";
  cards.forEach(c=> alunasGrid.appendChild(c));
  alunasHint.textContent = qtd ? "Alunas que você está acompanhando:" :
                                "Você ainda não está acompanhando nenhuma aluna.";
}

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

  await carregarAnalise(user.uid);
});