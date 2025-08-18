import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, query, where, getDocs, limit, orderBy, addDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const meNomeEl = document.getElementById("meNome");
const meEmailEl = document.getElementById("meEmail");
const inpEspec = document.getElementById("inpEspec");
const chips = document.getElementById("chips");
const btnSalvar = document.getElementById("btnSalvar");
const btnLogout = document.getElementById("btnLogout");
const alunasEl = document.getElementById("alunas");
const hintEl = document.getElementById("hint");
const selCategoria = document.getElementById("selCategoria");
const chkFavOnly = document.getElementById("chkFavOnly");

const dlg = document.getElementById("dlgMsg");
const dlgTitle = document.getElementById("dlgTitle");
const dlgHist = document.getElementById("dlgHist");
const dlgText = document.getElementById("dlgText");
const dlgClose = document.getElementById("dlgClose");
const dlgSend = document.getElementById("dlgSend");

let ME = null;

function norm(s){ return (s||"").toString().toLowerCase().trim(); }
function splitEspecialidades(s){ return (s||"").split(",").map(x=>x.trim()).filter(Boolean); }
function renderChips(list){
  chips.innerHTML = (list||[]).map(s=>`<span class="pill">${s}</span>`).join(" ") || `<span class="muted">Nenhuma especialidade informada</span>`;
}

function buildContactLink(raw){
  const s = (raw||"").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return { href:s, newTab:true, label:"Contato" };
  if (/^[+]?[\d\s\-()]{10,16}$/.test(s)) {
    const digits = s.replace(/[^\d]/g,"");
    return { href:`https://wa.me/${digits}`, newTab:true, label:"WhatsApp" };
  }
  if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(s)) {
    return { href:`mailto:${s}`, newTab:false, label:"E-mail" };
  }
  return null;
}

function mapEspecialidadeToTags(espRaw){
  const e = norm(espRaw);
  const out = [];
  const add = (...ts) => ts.forEach(t=>out.push(t));
  if (e.includes("front") || e.includes("react") || e.includes("javascript") || e.includes("html") || e.includes("css") || e.includes("vue") || e.includes("angular")) add("frontend","ui","webdesign");
  if (e.includes("back") || e.includes("api") || e.includes("node") || e.includes("java") || e.includes("spring")) add("backend","software");
  if (e.includes("python")) add("backend","data","ml");
  if (e.includes("sql") || e.includes("etl") || e.includes("pipeline") || e.includes("bi") || e.includes("power bi") || e.includes("excel")) add("data","datapipeline","bi","analytics");
  if (e.includes("ml") || e.includes("machine") || e.includes("ia") || e.includes("ai")) add("ml","data");
  if (e.includes("mobile") || e.includes("android") || e.includes("ios") || e.includes("react native") || e.includes("flutter")) add("mobile");
  if (e.includes("game") || e.includes("unity") || e.includes("unreal")) add("games");
  if (e.includes("embedded") || e.includes("embarc") || e.includes("iot") || e.includes("microcontrol")) add("embedded","iot");
  if (e.includes("devops") || e.includes("ci") || e.includes("cd") || e.includes("kubernetes") || e.includes("docker")) add("devops","cloud");
  if (e.includes("cloud") || e.includes("aws") || e.includes("azure") || e.includes("gcp")) add("cloud");
  if (e.includes("linux") || e.includes("windows server") || e.includes("sysadmin") || e.includes("shell")) add("sysadmin");
  if (e.includes("rede") || e.includes("network") || e.includes("router") || e.includes("switch") || e.includes("bgp") || e.includes("ospf") || e.includes("ccna")) add("networks");
  if (e.includes("segur") || e.includes("security")) add("security");
  if (e.includes("pentest") || e.includes("ethical")) add("pentest","security");
  if (e.includes("ids") || e.includes("ips") || e.includes("firewall") || e.includes("nac")) add("netsec","security");
  if (e.includes("devsec") || e.includes("sec eng") || e.includes("seceng")) add("seceng","security");
  if (e.includes("incidente") || e.includes("siem") || e.includes("forense")) add("incident","security");
  if (e.includes("ux")) add("ux");
  if (e.includes("ui") || e.includes("figma") || e.includes("web design")) add("ui","webdesign");
  if (e.includes("product") || e.includes("produto") || e.includes("pd")) add("productdesign");
  if (e.includes("po")) add("po");
  if (e.includes("pm") || e.includes("product manager")) add("pm");
  if (e.includes("scrum") || e.includes("agile") || e.includes("kanban")) add("scrum");
  if (e.includes("projeto") || e.includes("project")) add("project");
  if (e.includes("tech lead") || e.includes("lider")) add("techlead");
  if (e.includes("help") || e.includes("suporte")) add("helpdesk");
  if (e.includes("service")) add("servicedesk");
  if (e.includes("erp") || e.includes("totvs") || e.includes("sap") || e.includes("protheus")) add("erp");
  if (e.includes("vr") || e.includes("ar") || e.includes("realidade")) add("vrar");
  if (e.includes("blockchain") || e.includes("web3")) add("blockchain");
  if (e.includes("rob") || e.includes("robot")) add("robotics");
  if (e.includes("edge")) add("edge");
  return [...new Set(out)];
}
function tagsFromEspecialidades(list){
  const tags = new Set();
  (list||[]).forEach(s => mapEspecialidadeToTags(s).forEach(t=>tags.add(t)));
  return [...tags];
}

function scoreAluno(alunaTopTags=[], tutorTags=[]){
  const at = (alunaTopTags||[]).map(norm);
  const tt = (tutorTags||[]).map(norm);
  let sc = 0;
  for (const t of tt){ if (at.includes(t)) sc += 2; }
  const prox = [["frontend","ui"],["frontend","webdesign"],["backend","software"],["datapipeline","data"],["bi","analytics"],["iot","embedded"]];
  for (const [a,b] of prox){
    if (tt.includes(a) && at.includes(b)) sc += 1;
    if (tt.includes(b) && at.includes(a)) sc += 1;
  }
  return sc;
}

async function getFavoritosIds(tutoraId){
  const favCol = collection(db, "usuarios", tutoraId, "favoritos");
  const snap = await getDocs(favCol);
  const setIds = new Set();
  snap.forEach(docu=> setIds.add(docu.id));
  return setIds;
}

async function carregarAlunas(especList){
  alunasEl.innerHTML = "<p class='muted'>Carregando…</p>";
  const tutorTags = tagsFromEspecialidades(especList);

  hintEl.textContent = tutorTags.length
    ? "Ordenado por compatibilidade com suas especialidades."
    : "Dica: adicione suas especialidades para ver recomendações melhores.";

  try {
    const [res, favoritos] = await Promise.all([
      getDocs(
      query(
      collection(db, "usuarios"),
      where("tipo", "==", "estudante"),
      where("questionarioFinalizado", "==", true),
      limit(200)
      )
    ),
    getFavoritosIds(ME.uid)
    ]);

    const filtroCat = selCategoria.value || "todas";
    const favOnly = !!chkFavOnly?.checked;

    const alunos = [];
    res.forEach(d=>{
      if (d.id === ME.uid) return;
      const u = d.data();
      if (u.tipo !== "estudante") return;
      if (filtroCat !== "todas" && u.categoriaSugerida !== filtroCat) return;
      if (favOnly && !favoritos.has(d.id)) return;

      const topTags = (u.questionario?.topTags || []).map(norm);
      const sc = scoreAluno(topTags, tutorTags);
      alunos.push({ id:d.id, ...u, _score: sc });
    });

    alunos.sort((a,b)=> b._score - a._score);
    renderLista(alunos.slice(0,50), favoritos);

  } catch (e) {
    console.error(e);
    alunasEl.innerHTML = `<p class='muted'>Não foi possível carregar alunas (${e.code || e.message}). Verifique as regras do Firestore.</p>`;
  }
}

function renderLista(lista, favoritosIds){
  if (!lista.length){
    alunasEl.innerHTML = "<p class='muted'>Nenhuma aluna encontrada para este filtro.</p>";
    return;
  }
  alunasEl.innerHTML = "";
  lista.forEach(a=>{
    const espec = (a.questionario?.topTags || []).map(t=>`<span class="pill">${t}</span>`).join(" ");
    const fav = favoritosIds.has(a.id);

    const contactInfo = a.contato && a.contato.trim() ? a.contato.trim() : (a.email || "");
    const link = buildContactLink(contactInfo);
    const contatoBtn = link
      ? `<a class="btn ghost" href="${link.href}" ${link.newTab?'target="_blank" rel="noopener"':''}>${link.label}</a>`
      : "";
    const contatoRaw = contactInfo && !link
      ? `<div style="margin-top:6px"><span class="muted">Contato:</span> ${contactInfo}</div>`
      : "";

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <strong>${a.nome || "Estudante"}</strong><br>
          <span class="muted">${a.email || ""}</span>
          <div style="margin-top:6px">${espec || '<span class="muted">Sem tags</span>'}</div>
          ${contatoRaw}
        </div>
        <div class="row actions">
          <button class="btn ghost btnMsg" data-id="${a.id}" data-name="${a.nome||'Estudante'}">Mensagens</button>
          ${contatoBtn}
          <span class="pill"><span class="score">Score:</span> ${a._score}</span>
          <span class="star ${fav?'on':''}" title="Favoritar" data-id="${a.id}">${fav?'★':'☆'}</span>
        </div>
      </div>
    `;
    alunasEl.appendChild(item);
  });

  alunasEl.querySelectorAll(".star").forEach(s=>{
    s.addEventListener("click", async ()=>{
      const id = s.getAttribute("data-id");
      const nowFav = s.classList.toggle("on");
      s.textContent = nowFav ? "★" : "☆";
      await toggleFavorito(ME.uid, id, nowFav);
    });
  });
  alunasEl.querySelectorAll(".btnMsg").forEach(b=>{
    b.addEventListener("click", ()=> openDialogMsg(b.getAttribute("data-id"), b.getAttribute("data-name")));
  });
}

async function toggleFavorito(tutoraId, estudanteId, on){
  const ref = doc(db, "usuarios", tutoraId, "favoritos", estudanteId);
  if (on){
    await setDoc(ref, { estudanteId, createdAt: new Date() }, { merge:true });
  } else {
    await deleteDoc(ref);
  }
}

function threadId(tutoraId, estudanteId){ return `${tutoraId}__${estudanteId}`; }

async function openDialogMsg(estudanteId, estudanteNome){
  dlgTitle.textContent = `Mensagem para ${estudanteNome}`;
  dlgHist.innerHTML = "Carregando…";
  dlgText.value = "";
  dlg.showModal();

  const tid = threadId(ME.uid, estudanteId);
  const tRef = doc(db, "matches", tid);

  try {
    const tSnap = await getDoc(tRef);
    if (!tSnap.exists()){
      await setDoc(tRef, {
        tutoraId: ME.uid,
        estudanteId,
        createdAt: serverTimestamp(),
        status: "aberto"
      }, { merge:true });
    }

    const msgsCol = collection(db, "matches", tid, "mensagens");
    const msgsQ = query(msgsCol, orderBy("createdAt","asc"), limit(50));
    const mSnap = await getDocs(msgsQ);

    if (mSnap.empty){
      dlgHist.innerHTML = `<p class="muted">Sem mensagens ainda. Envie a primeira! 🙂</p>`;
    } else {
      const html = [];
      mSnap.forEach(m=>{
        const d = m.data();
        const eu = d.from === ME.uid;
        const when = d.createdAt?.seconds ? new Date(d.createdAt.seconds*1000) : new Date();
        html.push(
          `<div style="margin:6px 0; display:flex; ${eu?'justify-content:flex-end':''}">
            <div style="max-width:75%; padding:8px 12px; border-radius:10px; ${eu?'background:#ffe3f1':'background:#f5f5f5'}">
              <div style="font-size:.85rem;${eu?'text-align:right':''}">${d.text||''}</div>
              <div class="muted" style="font-size:.75rem; ${eu?'text-align:right':''}">${when.toLocaleString()}</div>
            </div>
          </div>`
        );
      });
      dlgHist.innerHTML = html.join("");
      dlgHist.scrollTop = dlgHist.scrollHeight;
    }
  } catch (e) {
    dlgHist.innerHTML = `<p class="muted">Não foi possível carregar as mensagens (${e.code || e.message}). Verifique as regras do Firestore.</p>`;
  }

  dlgSend.onclick = async ()=>{
    const text = dlgText.value.trim();
    if (!text) return;
    try{
      await addDoc(collection(db,"matches", tid, "mensagens"), {
        from: ME.uid,
        text,
        createdAt: serverTimestamp()
      });
      dlgText.value = "";
      await openDialogMsg(estudanteId, estudanteNome); // recarrega histórico
    }catch(e){
      alert("Erro ao enviar mensagem: " + (e.code || e.message));
    }
  };
}

dlgClose.addEventListener("click", ()=> dlg.close());

async function salvarEspecialidades(uid){
  const raw = inpEspec.value || "";
  const arr = splitEspecialidades(raw);
  await setDoc(doc(db,"usuarios",uid), {
    especialidades: arr,
    especialidadesNorm: arr.map(norm),
    atualizadoEm: new Date()
  }, { merge:true });
  renderChips(arr);
  await carregarAlunas(arr);
}

btnSalvar.addEventListener("click", async ()=>{
  if (!ME) return;
  try{
    await salvarEspecialidades(ME.uid);
    alert("Especialidades atualizadas!");
  }catch(e){ alert("Erro ao salvar: " + e.message); }
});

inpEspec.addEventListener("keydown", async (e)=>{
  if (e.key === "Enter") { 
    e.preventDefault(); 
    btnSalvar.click(); 
  }
});

selCategoria.addEventListener("change", async ()=>{
  await carregarAlunas(ME?.especialidades || splitEspecialidades(inpEspec.value));
});
chkFavOnly?.addEventListener("change", async ()=>{
  await carregarAlunas(ME?.especialidades || splitEspecialidades(inpEspec.value));
});

btnLogout.addEventListener("click", async ()=>{
  try{ await signOut(auth); window.location.href = "login.html"; }
  catch(e){ alert("Não foi possível sair agora: " + e.message); }
});

onAuthStateChanged(auth, async (user)=>{
  if (!user){ window.location.href = "login.html"; return; }
  const uref = doc(db,"usuarios",user.uid);

  let snap = await getDoc(uref);
  if (!snap.exists()){
    await setDoc(uref, { tipo: "tutora", email: user.email || "", atualizadoEm: new Date() }, { merge:true });
    snap = await getDoc(uref);
  }

  const me = snap.data();
  if (me.tipo !== "tutora"){ alert("Área exclusiva para Tutoras."); window.location.href="login.html"; return; }

  ME = { uid: user.uid, ...me };
  meNomeEl.textContent  = me.nome || (user.displayName || "Tutora");
  meEmailEl.textContent = me.email || (user.email || "");

  const espec = me.especialidades || [];
  inpEspec.value = espec.join(", ");
  renderChips(espec);

  await carregarAlunas(espec);
});