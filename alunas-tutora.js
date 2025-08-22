import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, query, where, getDocs, limit, orderBy,
  addDoc, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const meInfo = document.getElementById("meInfo");
const alunasEl = document.getElementById("alunas");
const hintEl = document.getElementById("hint");

const selCategoria = document.getElementById("selCategoria");
const selStatus = document.getElementById("selStatus");
const chkFavOnly = document.getElementById("chkFavOnly");
const txtBusca = document.getElementById("txtBusca");

const dlg = document.getElementById("dlgMsg");
const dlgTitle = document.getElementById("dlgTitle");
const dlgHist = document.getElementById("dlgHist");
const dlgText = document.getElementById("dlgText");
const dlgClose = document.getElementById("dlgClose");
const dlgSend = document.getElementById("dlgSend");

const dlgPerfil = document.getElementById("dlgPerfil");
const dlgPerfilTitle = document.getElementById("dlgPerfilTitle");
const dlgPerfilBody = document.getElementById("dlgPerfilBody");
const dlgPerfilClose = document.getElementById("dlgPerfilClose");

let ME = null;
let FAVORITOS = new Set();
let STATUS = new Map();

function norm(s){ return (s||"").toString().toLowerCase().trim(); }

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
  if (e.includes("embedded") || e.includes("embarc") || e.includes("iot")) add("embedded","iot");
  if (e.includes("devops") || e.includes("kubernetes") || e.includes("docker")) add("devops","cloud");
  if (e.includes("cloud") || e.includes("aws") || e.includes("azure") || e.includes("gcp")) add("cloud");
  if (e.includes("linux") || e.includes("windows server") || e.includes("sysadmin")) add("sysadmin");
  if (e.includes("rede") || e.includes("network") || e.includes("router") || e.includes("switch") || e.includes("ccna")) add("networks");
  if (e.includes("segur") || e.includes("security")) add("security");
  if (e.includes("pentest")) add("pentest","security");
  if (e.includes("ids") || e.includes("ips") || e.includes("firewall") || e.includes("nac")) add("netsec","security");
  if (e.includes("devsec") || e.includes("sec eng") || e.includes("seceng")) add("seceng","security");
  if (e.includes("incidente") || e.includes("siem") || e.includes("forense")) add("incident","security");
  if (e.includes("ux")) add("ux");
  if (e.includes("ui") || e.includes("figma") || e.includes("web design")) add("ui","webdesign");
  if (e.includes("product")) add("productdesign");
  if (e.includes("po")) add("po");
  if (e.includes("pm")) add("pm");
  if (e.includes("scrum")) add("scrum");
  if (e.includes("projeto") || e.includes("project")) add("project");
  if (e.includes("tech lead") || e.includes("lider")) add("techlead");
  if (e.includes("help")) add("helpdesk");
  if (e.includes("service")) add("servicedesk");
  if (e.includes("erp") || e.includes("totvs") || e.includes("sap") || e.includes("protheus")) add("erp");
  if (e.includes("vr") || e.includes("ar") || e.includes("realidade")) add("vrar");
  if (e.includes("blockchain")) add("blockchain");
  if (e.includes("rob")) add("robotics");
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
  snap.forEach(docu=>{
    const data = docu.data();
    if (!data.removed) setIds.add(docu.id);
  });
  return setIds;
}
async function getStatusMap(tutoraId){
  const stCol = collection(db, "usuarios", tutoraId, "alunas");
  const snap = await getDocs(stCol);
  const map = new Map();
  snap.forEach(d=> map.set(d.id, d.data().status || "acompanhando"));
  return map;
}

function threadId(tutoraId, estudanteId){ return `${tutoraId}__${estudanteId}`; }

async function openMatch(estudanteId){
  const tid = threadId(ME.uid, estudanteId);
  await setDoc(doc(db, "matches", tid), {
    tutoraId: ME.uid,
    estudanteId,
    status: "aberto",
    createdAt: serverTimestamp()
  }, { merge: true });
}

async function closeMatch(estudanteId){
  const tid = threadId(ME.uid, estudanteId);
  try { await deleteDoc(doc(db, "matches", tid)); } catch(_) {}
}

async function carregarAlunas(){
  alunasEl.innerHTML = "<p class='muted'>Carregando…</p>";

  const meSnap = await getDoc(doc(db,"usuarios",ME.uid));
  const espec = meSnap.exists() ? (meSnap.data().especialidades || []) : [];
  const tutorTags = tagsFromEspecialidades(espec);

  hintEl.textContent = tutorTags.length
    ? "Ordenado por compatibilidade com suas especialidades."
    : "Dica: adicione suas especialidades no Dashboard para recomendações melhores.";

  const [res, favoritos, statusMap] = await Promise.all([
    getDocs(query(
      collection(db, "usuarios"),
      where("tipo", "==", "estudante"),
      where("questionarioFinalizado", "==", true),
      limit(300)
    )),
    getFavoritosIds(ME.uid),
    getStatusMap(ME.uid)
  ]);
  FAVORITOS = favoritos;
  STATUS = statusMap;

  const filtroCat = selCategoria.value || "todas";
  const favOnly = !!chkFavOnly.checked;
  const filtroStatus = selStatus.value || "todos";
  const texto = norm(txtBusca.value);

  const alunos = [];
  res.forEach(d=>{
    const u = d.data();
    if (filtroCat !== "todas" && u.categoriaSugerida !== filtroCat) return;

    const st = STATUS.get(d.id);
    if (filtroStatus !== "todos" && st !== filtroStatus) return;

    if (favOnly && !FAVORITOS.has(d.id)) return;

    if (texto){
      const hay = `${u.nome||""} ${u.email||""}`.toLowerCase();
      if (!hay.includes(texto)) return;
    }

    const topTags = (u.questionario?.topTags || []).map(norm);
    const sc = scoreAluno(topTags, tutorTags);
    alunos.push({ id:d.id, ...u, _score: sc, _status: st||null });
  });

  alunos.sort((a,b)=> b._score - a._score);
  renderLista(alunos.slice(0,100));
}

function statusBadge(st){
  if (!st) return "";
  if (st==="acompanhando") return `<span class="badge acomp">Acompanhando</span>`;
  if (st==="mais_tarde")   return `<span class="badge later">Mais tarde</span>`;
  if (st==="rejeitado")    return `<span class="badge reject">Rejeitado</span>`;
  return "";
}

function renderLista(lista){
  if (!lista.length){
    alunasEl.innerHTML = "<p class='muted'>Nenhuma aluna encontrada para este filtro.</p>";
    return;
  }
  alunasEl.innerHTML = "";
  lista.forEach(a=>{
    const espec = (a.questionario?.topTags || []).map(t=>`<span class="pill">${t}</span>`).join(" ");
    const fav = FAVORITOS.has(a.id);
    const st  = a._status;

    const contactInfo = a.contato && a.contato.trim() ? a.contato.trim() : (a.email || "");
    const link = buildContactLink(contactInfo);
    const contatoBtn = link
      ? `<a class="btn ghost" href="${link.href}" ${link.newTab?'target="_blank" rel="noopener"':''}>${link.label}</a>`
      : "";

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="row">
        <div>
          <strong>${a.nome || "Estudante"}</strong>
          ${statusBadge(st)}
          <div class="muted">${a.email || ""}</div>
          <div class="muted" style="margin-top:4px">${a.categoriaSugerida || "-" } • ${a.papelSugerido || "-"}</div>
          <div style="margin-top:6px">${espec || '<span class="muted">Sem tags</span>'}</div>
        </div>

        <!-- Ações principais -->
        <div class="actions primary" style="margin-top:10px">
          <button class="btn ghost btnPerfil" data-id="${a.id}" data-name="${a.nome||'Estudante'}">Ver perfil</button>
          <button class="btn ghost btnMsg" data-id="${a.id}" data-name="${a.nome||'Estudante'}">Mensagens</button>
          ${contatoBtn}
          <span class="pill"><strong>Score:</strong> ${a._score}</span>
          <span class="star ${fav?'on':''}" title="Favoritar" data-id="${a.id}">${fav?'★':'☆'}</span>
        </div>

        <!-- Decisão -->
        <div class="decision-group" style="margin-top:8px" role="group" aria-label="Decisão da tutora">
          <button class="btn-choice ${st==='acompanhando'?'is-selected':''}" data-choice="acomp" data-id="${a.id}">Acompanhar</button>
          <button class="btn-choice ${st==='mais_tarde'?'is-selected':''}" data-choice="later" data-id="${a.id}">Mais tarde</button>
          <button class="btn-choice ${st==='rejeitado'?'is-selected':''}" data-choice="reject" data-id="${a.id}">Rejeitar</button>
          <button class="btn link btn-clear" data-act="clear" data-id="${a.id}" title="Remover status">Limpar status</button>
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
      if (nowFav) FAVORITOS.add(id); else FAVORITOS.delete(id);
    });
  });

  alunasEl.querySelectorAll(".btnMsg").forEach(b=>{
    b.addEventListener("click", ()=> openDialogMsg(b.getAttribute("data-id"), b.getAttribute("data-name")));
  });
  alunasEl.querySelectorAll(".btnPerfil").forEach(b=>{
    b.addEventListener("click", ()=> openDialogPerfil(b.getAttribute("data-id"), b.getAttribute("data-name")));
  });

  alunasEl.querySelectorAll(".btn-choice").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-id");
      const choice = btn.getAttribute("data-choice");
      let status = null;
      if (choice==="acomp") status = "acompanhando";
      if (choice==="later") status = "mais_tarde";
      if (choice==="reject") status = "rejeitado";
      if (!status) return;

      await setDoc(doc(db,"usuarios",ME.uid,"alunas",id), { estudanteId:id, status, updatedAt:new Date() }, { merge:true });
      STATUS.set(id, status);

      if (status === "acompanhando") {
        await openMatch(id);
      } else {
        await closeMatch(id);
      }

      await carregarAlunas();
    });
  });

  alunasEl.querySelectorAll(".btn-clear").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-id");
      try{
        await deleteDoc(doc(db,"usuarios",ME.uid,"alunas",id));
        STATUS.delete(id);
        await closeMatch(id);
        await carregarAlunas();
      }catch(e){
        alert("Não foi possível limpar o status: " + (e.code || e.message));
      }
    });
  });
}

async function toggleFavorito(tutoraId, estudanteId, on){
  const ref = doc(db, "usuarios", tutoraId, "favoritos", estudanteId);
  if (on){
    await setDoc(ref, { estudanteId, createdAt: new Date(), removed: false }, { merge:true });
  } else {
    try{ await deleteDoc(ref); }
    catch{ await setDoc(ref, { removed:true }, { merge:true }); }
  }
}

async function openDialogMsg(estudanteId, estudanteNome){
  dlgTitle.textContent = `Mensagem para ${estudanteNome}`;
  dlgHist.innerHTML = "Carregando…";
  dlgText.value = "";
  dlg.showModal();

  const tid = threadId(ME.uid, estudanteId);

  try {
    await setDoc(doc(db, "matches", tid), {
      tutoraId: ME.uid,
      estudanteId,
      createdAt: serverTimestamp(),
      status: "aberto"
    }, { merge: true });

    const msgsQ = query(collection(db, "matches", tid, "mensagens"), orderBy("createdAt","asc"), limit(50));
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
              <div style="font-size:.85rem;${eu?'text-align:right':''}">${(d.text||'').replace(/\n/g,'<br>')}</div>
              <div class="muted" style="font-size:.75rem; ${eu?'text-align:right':''}">${when.toLocaleString()}</div>
            </div>
          </div>`
        );
      });
      dlgHist.innerHTML = html.join("");
      dlgHist.scrollTop = dlgHist.scrollHeight;
    }
  } catch (e) {
    dlgHist.innerHTML = `<p class="muted">Não foi possível carregar as mensagens (${e.code || e.message}).</p>`;
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
      await openDialogMsg(estudanteId, estudanteNome);
    }catch(e){
      alert("Erro ao enviar mensagem: " + (e.code || e.message));
    }
  };
}
dlgClose?.addEventListener("click", ()=> dlg.close());

function fmtDate(iso){
  if (!iso) return "-";
  try{
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  }catch{ return iso; }
}
function fmtGender(g){
  if (!g) return "-";
  const m = (g||"").toString().toLowerCase();
  if (m==="feminino") return "Feminino";
  if (m==="masculino") return "Masculino";
  if (m==="outro") return "Outro";
  return g;
}

async function openDialogPerfil(estudanteId, estudanteNome){
  dlgPerfilTitle.textContent = `Perfil — ${estudanteNome}`;
  dlgPerfilBody.innerHTML = "Carregando…";
  dlgPerfil.showModal();
  try{
    const s = await getDoc(doc(db,"usuarios",estudanteId));
    if (!s.exists()){ dlgPerfilBody.innerHTML = "<p class='muted'>Perfil não encontrado.</p>"; return; }
    const u = s.data();

    const linhas = [
      ["Nome", u.nome || "-"],
      ["E-mail", u.email || "-"],
      ["Nascimento", fmtDate(u.birthdate)],
      ["Sexo", fmtGender(u.gender)],
      ["Município", u.city || "-"],
      ["UF", (u.uf || "-").toString().toUpperCase()],
      ["Formação", u.education ? (u.education === "Outro" && u.educationOther ? `Outro — ${u.educationOther}` : u.education) : "-"],
      ["Categoria sugerida", u.categoriaSugerida || "-"],
      ["Papel sugerido", u.papelSugerido || "-"]
    ];

    const tags = (u.questionario?.topTags || []).map(t=>`<span class="pill">${t}</span>`).join(" ");
    dlgPerfilBody.innerHTML = `
      <div>
        ${linhas.map(([k,v])=>`<div style="margin:.2rem 0"><strong>${k}:</strong> <span class="muted">${v}</span></div>`).join("")}
        <div style="margin-top:8px"><strong>Top tags:</strong> ${tags || '<span class="muted">—</span>'}</div>
      </div>
    `;
  }catch(e){
    dlgPerfilBody.innerHTML = "<p class='muted'>Não foi possível carregar o perfil.</p>";
  }
}
dlgPerfilClose?.addEventListener("click", ()=> dlgPerfil.close());

[selCategoria, selStatus, chkFavOnly].forEach(el=> el?.addEventListener("change", carregarAlunas));
txtBusca?.addEventListener("input", ()=>{ clearTimeout(window.__t); window.__t = setTimeout(carregarAlunas, 300); });

onAuthStateChanged(auth, async (user)=>{
  if (!user){ window.location.href = "login.html"; return; }
  const us = await getDoc(doc(db,"usuarios",user.uid));
  if (!us.exists()){ meInfo.textContent = "Usuária não encontrada."; return; }
  const me = us.data();
  if (me.tipo !== "tutora"){ alert("Área exclusiva para Tutoras."); window.location.href = "login.html"; return; }
  ME = { uid:user.uid, ...me };
  meInfo.textContent = `${me.nome || "Tutora"} • ${me.email || user.email || ""}`;
  await carregarAlunas();
});