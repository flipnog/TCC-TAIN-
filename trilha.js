import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDocFromServer, setDoc, serverTimestamp,
  collection, getDocs, getDoc, query, where, limit, getDocsFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const emptyState = document.getElementById("emptyState");
const trailWrap  = document.getElementById("trailWrap");
const catTitle   = document.getElementById("catTitle");
const roleTitle  = document.getElementById("roleTitle");
const taskListEl = document.getElementById("taskList");
const pbar       = document.getElementById("pbar");
const ptext      = document.getElementById("ptext");
const saveHint   = document.getElementById("saveHint");
const errorHint  = document.getElementById("errorHint");

const TRILHAS = {
  "Desenvolvimento e Programação": ["Lógica de Programação", "Git/GitHub", "HTML/CSS/JS", "Banco de Dados (SQL)", "APIs/HTTP", "Framework (React/Node)", "Boas práticas e testes"],
  "Infraestrutura e Redes": ["Redes (TCP/IP)", "Linux/Windows Server", "Scripting (Shell/Python)", "Cloud (AWS/Azure/GCP)", "CI/CD e Observabilidade", "Segurança básica"],
  "Segurança da Informação (Cybersecurity)": ["Fundamentos de Segurança", "Pentest básico", "Segurança de Redes", "SIEM e Resposta a Incidentes", "Criptografia", "Compliance"],
  "Dados e Inteligência Artificial": ["Fundamentos de Dados", "SQL", "ETL/Pipelines", "BI/Dashboards (Power BI)", "Python (Pandas)", "ML básico"],
  "Design e Experiência do Usuário": ["Princípios de Design", "Acessibilidade", "Figma/Prototipagem", "Pesquisa com Usuárias", "Design System", "Dev handoff"],
  "Gestão e Produto": ["Agilidade/Scrum", "Discovery/Delivery", "Métricas de Produto", "Roadmap", "Comunicação & Liderança"],
  "Suporte e Atendimento": ["ITIL/SLAs", "Ferramentas de Chamados", "Diagnóstico & Documentação", "Soft Skills", "Noções de Redes e SO"],
  "Outras áreas emergentes": ["Fundamentos da área", "Ferramentas/SDKs", "Projeto prático guiado", "Publicação/Deploy", "Comunidade & Portfólio"]
};

const slug = (s)=> (s||"")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")
  .slice(0,60);

let UID = null;
let TASKS = [];
let TUTORA_ID = null;           // tutora ativa (se houver)
const FEEDBACK = new Map();      // itemId -> { text, updatedAt, tutoraId }

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="login.html"; return; }
  UID = user.uid;

  let usnap;
  try{
    usnap = await getDocFromServer(doc(db,"usuarios",UID));
  }catch(e){
    showEmpty("Não foi possível carregar seu perfil agora. Tente novamente em instantes.");
    console.error(e);
    return;
  }
  if(!usnap.exists()){ window.location.href="cadastro.html"; return; }

  const u = usnap.data();
  const finished = (u.questionarioFinalizado === true) || ((u.questionario?.topTags||[]).length>0);
  if(!finished){
    showEmpty(); return;
  }

  // Descobre a tutora ativa — primeiro tenta no doc do usuário, senão consulta matches
  TUTORA_ID = await descobrirTutoraAtiva(UID, u.tutoraId);

  const categoria = u.categoriaSugerida || "Desenvolvimento e Programação";
  const papel     = u.papelSugerido || "Trilha de estudos";
  catTitle.textContent  = categoria;
  roleTitle.textContent = papel;

  const baseItems = (TRILHAS[categoria] || TRILHAS["Desenvolvimento e Programação"]).map(title => ({
    id: slug(title), title
  }));

  const col = collection(db,"usuarios",UID,"trilha");
  let saved = [];
  try{
    const snap = await getDocs(col);
    snap.forEach(d => saved.push({ id:d.id, ...(d.data()||{}) }));
  }catch(e){
    console.warn("Não foi possível ler subcoleção trilha:", e.code || e.message);
  }

  const mapSaved = new Map(saved.map(x => [x.id, x]));
  TASKS = baseItems.map(b => {
    const s = mapSaved.get(b.id) || {};
    return {
      id: b.id,
      title: b.title,
      done: !!s.done,
      studentNote: s.studentNote || ""
    };
  });

  renderTasks();          // render com placeholders
  updateProgress();

  // garante documentos base existentes
  baseItems.forEach(async (b)=>{
    if (!mapSaved.has(b.id)){
      try{
        await setDoc(doc(db,"usuarios",UID,"trilha",b.id), {
          title: b.title,
          done: false,
          studentNote: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge:true });
      }catch(e){
        console.warn("Falha ao criar item inicial:", b.id, e.code || e.message);
      }
    }
  });

  // carrega feedback da tutora (se existir) e atualiza a UI
  if (TUTORA_ID){
    await carregarFeedbackTutora(TUTORA_ID);
    aplicarFeedbackNaUI();
  }
});

async function descobrirTutoraAtiva(estudanteId, tutoraIdDoPerfil){
  // 1) se já veio do perfil, ótimo
  if (tutoraIdDoPerfil) return tutoraIdDoPerfil;

  // 2) tenta achar um match aberto
  try{
    const q1 = query(
      collection(db,"matches"),
      where("estudanteId","==", estudanteId),
      where("status","==","aberto"),
      limit(1)
    );
    const snap = await getDocsFromServer(q1);
    if (!snap.empty){
      const m = snap.docs[0].data();
      return m.tutoraId || null;
    }
  }catch(_){}
  return null;
}

async function carregarFeedbackTutora(tutoraId){
  FEEDBACK.clear();
  try{
    // não há "list" direto na subcoleção por item; então buscamos item a item
    const itens = TASKS.map(t => t.id);
    await Promise.all(itens.map(async (itemId)=>{
      const fbRef = doc(db,"usuarios",UID,"trilha",itemId,"feedback",tutoraId);
      const snap = await getDoc(fbRef);
      if (snap.exists()){
        const d = snap.data();
        FEEDBACK.set(itemId, { text: d.text || "", updatedAt: d.updatedAt, tutoraId });
      }
    }));
  }catch(e){
    console.warn("Falha ao carregar feedback da tutora:", e.code || e.message);
  }
}

function aplicarFeedbackNaUI(){
  TASKS.forEach(t=>{
    const host = document.getElementById(`tnote_${t.id}`);
    if (!host) return;
    const fb = FEEDBACK.get(t.id);
    if (fb && fb.text){
      host.textContent = fb.text;
    }else{
      host.innerHTML = '<span class="muted">Sem observações da tutora ainda.</span>';
    }
  });
}

function showEmpty(msg){
  emptyState.style.display = "block";
  trailWrap.style.display  = "none";
  if (msg){
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = msg;
    emptyState.appendChild(p);
  }
}

function showTrail(){
  emptyState.style.display = "none";
  trailWrap.style.display  = "grid";
}

function renderTasks(){
  showTrail();
  taskListEl.innerHTML = "";

  TASKS.forEach((t, idx)=>{
    const wrapper = document.createElement("div");
    wrapper.className = "task";
    wrapper.innerHTML = `
      <div class="task-head">
        <input type="checkbox" id="chk_${t.id}" ${t.done ? "checked":""} aria-label="Marcar como concluído">
        <div>
          <div class="task-title">${t.title}</div>
        </div>
      </div>

      <div class="task-notes">
        <div class="note-block">
          <div class="note-label">Suas anotações</div>
          <textarea id="note_${t.id}" placeholder="Escreva o que estudou, links úteis, dúvidas...">${escapeHtml(t.studentNote)}</textarea>
        </div>

        <div>
          <div class="note-label">Observações da tutora</div>
          <div class="note-tutor" id="tnote_${t.id}">
            <span class="muted">Carregando…</span>
          </div>
        </div>
      </div>
    `;
    taskListEl.appendChild(wrapper);

    const chk  = wrapper.querySelector(`#chk_${t.id}`);
    const note = wrapper.querySelector(`#note_${t.id}`);

    chk?.addEventListener("change", async ()=>{
      TASKS[idx].done = !!chk.checked;
      updateProgress();
      await saveTaskPartial(t.id, { done: TASKS[idx].done });
    });

    let timer = null;
    note?.addEventListener("input", ()=>{
      if (timer) clearTimeout(timer);
      TASKS[idx].studentNote = note.value;
      timer = setTimeout(async ()=>{
        await saveTaskPartial(t.id, { studentNote: TASKS[idx].studentNote });
      }, 700);
    });
  });
}

function updateProgress(){
  const total = TASKS.length || 0;
  const done  = TASKS.filter(x=>x.done).length;
  const pct   = total ? Math.round(done/total*100) : 0;
  if (pbar)  pbar.style.width = pct + "%";
  if (ptext) ptext.textContent = `${pct}% concluído`;
}

async function saveTaskPartial(id, patch){
  showSaving(true);
  try{
    await setDoc(doc(db,"usuarios",UID,"trilha",id), {
      ...(patch||{}),
      updatedAt: serverTimestamp()
    }, { merge:true });
    showSaving(false);
    showError(false);
  }catch(e){
    console.error("saveTaskPartial", e);
    showSaving(false);
    showError(true);
  }
}

function showSaving(on){
  saveHint.style.display = on ? "block" : "none";
}
function showError(on){
  errorHint.style.display = on ? "block" : "none";
}

function escapeHtml(s){
  return (s||"").toString().replace(/[&<>"']/g, (m)=>{
    switch(m){
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#039;";
      default: return m;
    }
  });
}