import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  collection,
  query,
  where,
  limit,
  getDocFromServer,
  getDocsFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const categoriaEl = document.getElementById("categoria");
const papelEl     = document.getElementById("papel");
const trilhaEl    = document.getElementById("trilha");

const tutoraBoxEl = document.getElementById("tutoraBox");
const hintEl      = document.getElementById("tutoraHint");

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

async function carregarMinhaTutora(estudanteId){
  if (!tutoraBoxEl) return;

  try {
    const uSnap = await getDocFromServer(doc(db, "usuarios", estudanteId));
    if (uSnap.exists()) {
      const u = uSnap.data();
      if (u.tutoraId) {
        const tSnap = await getDocFromServer(doc(db, "usuarios", u.tutoraId));
        if (tSnap.exists()) {
          const t = tSnap.data();
          renderTutora(t);
          hintEl && (hintEl.textContent = "");
          return;
        }
      }
    }
  } catch(e) {
  }

  const q = query(
    collection(db,"matches"),
    where("estudanteId","==", estudanteId),
    where("status","==","aberto"),
    limit(1)
  );

  try{
    const snap = await getDocsFromServer(q);
    if (snap.empty) {
      renderSemTutora();
      return;
    }
    const m = snap.docs[0].data();
    const tSnap = await getDocFromServer(doc(db,"usuarios", m.tutoraId));
    if (!tSnap.exists()){
      tutoraBoxEl.innerHTML = `<div class="muted">Não foi possível carregar os dados da tutora.</div>`;
      return;
    }
    renderTutora(tSnap.data());
    hintEl && (hintEl.textContent = "");
  }catch(_){
    renderSemTutora();
  }
}

function renderSemTutora(){
  if (!tutoraBoxEl) return;
  tutoraBoxEl.innerHTML = `
    <div class="tutora">
      <div class="muted">
        Você ainda não tem uma tutora definida.<br/>
        Assim que uma tutora aceitar te acompanhar, ela aparecerá aqui.
      </div>
    </div>`;
  hintEl && (hintEl.textContent = "");
}

function renderTutora(t){
  if (!tutoraBoxEl) return;
  const espec = (t.especialidades||[]).map(s=>`<span class="pill">${s}</span>`).join(" ");
  const contato = t.contato || t.email || "";
  const link = buildContactLink(contato);
  const contatoBtn = link
    ? `<a class="btn ghost" href="${link.href}" ${link.newTab?'target="_blank" rel="noopener"':''}>${link.label}</a>`
    : "";

  tutoraBoxEl.innerHTML = `
    <div class="tutora">
      <strong>${t.nome || "Tutora"}</strong><br/>
      <span class="muted">${t.email || ""}</span>
      <div style="margin-top:6px">${espec || '<span class="muted">Sem especialidades informadas</span>'}</div>
      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap">
        ${contatoBtn}
        <a class="btn" href="mensagens.html">Enviar mensagem</a>
      </div>
    </div>`;
}

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="login.html"; return; }

  let uSnap;
  try{
    uSnap = await getDocFromServer(doc(db,"usuarios",user.uid));
  }catch(e){
    categoriaEl.textContent = "Não foi possível carregar seus dados agora.";
    console.error(e);
    return;
  }
  if(!uSnap.exists()){
    categoriaEl.textContent = "Perfil não encontrado.";
    return;
  }

  const u = uSnap.data();
  const categoria = u.categoriaSugerida || "Desenvolvimento e Programação";
  const papel = u.papelSugerido || "Desenvolvedor(a) Front-End";

  categoriaEl.textContent = categoria;
  papelEl.textContent = papel;

  trilhaEl.innerHTML = "";
  (TRILHAS[categoria]||[]).forEach(item=>{
    const li=document.createElement("li");
    li.textContent=item;
    trilhaEl.appendChild(li);
  });

  await carregarMinhaTutora(user.uid);
});