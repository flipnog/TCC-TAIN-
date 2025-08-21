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
const papelEl = document.getElementById("papel");
const trilhaEl = document.getElementById("trilha");

const tutoraBox = document.getElementById("tutoraBox");
const tutoraHint = document.getElementById("tutoraHint");

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

  trilhaEl.innerHTML="";
  (TRILHAS[categoria]||[]).forEach(item=>{
    const li=document.createElement("li"); li.textContent=item; trilhaEl.appendChild(li);
  });

  await carregarTutora(user.uid);
});

async function carregarTutora(estudanteUid){
  tutoraBox.innerHTML = `<p class="muted">Carregando…</p>`;
  tutoraHint.textContent = "";

  try{
    const qThreads = query(
      collection(db,"matches"),
      where("estudanteId","==", estudanteUid),
      limit(100)
    );
    const tSnap = await getDocsFromServer(qThreads);

    if (tSnap.empty){
      tutoraBox.innerHTML = `<p class="muted">Ainda não há uma tutora atribuída. Assim que uma tutora for vinculada a você, ela aparecerá aqui.</p>`;
      tutoraHint.textContent = "Dica: você pode enviar mensagens a tutoras a partir da área de tutoras quando houver um ''match''.";
      return;
    }

    const threads = [];
    tSnap.forEach(d=> threads.push({ id:d.id, ...d.data() }));
    threads.sort((a,b)=> (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
    const chosen = threads[0];
    if (!chosen?.tutoraId){
      tutoraBox.innerHTML = `<p class="muted">Não foi possível identificar a tutora nesta conversa.</p>`;
      return;
    }

    const tutoraSnap = await getDocFromServer(doc(db,"usuarios", chosen.tutoraId));
    if (!tutoraSnap.exists()){
      tutoraBox.innerHTML = `<p class="muted">A tutora vinculada não foi encontrada.</p>`;
      return;
    }
    const t = tutoraSnap.data();

    const espec = (t.especialidades||[]).map(s=>`<span class="pill">${s}</span>`).join(" ");
    const contactInfo = (t.contato && t.contato.trim()) ? t.contato.trim() : (t.email || "");
    const link = buildContactLink(contactInfo);
    const contatoBtn = link
      ? `<a class="btn ghost" href="${link.href}" ${link.newTab?'target="_blank" rel="noopener"':''}>${link.label}</a>`
      : "";
    const contatoRaw = contactInfo && !link
      ? `<div class="muted" style="margin-top:6px">Contato: ${contactInfo}</div>`
      : "";

    tutoraBox.innerHTML = `
      <div class="tutora-head">
        <div class="tutora-avatar">👩‍🏫</div>
        <div class="tutora-meta">
          <span class="tutora-name">${t.nome || "Tutora"}</span>
          <span class="tutora-email">${t.email || ""}</span>
        </div>
      </div>
      <div class="tutora-espec">${espec || '<span class="muted">Sem especialidades informadas</span>'}</div>
      ${contatoRaw}
      <div class="tutora-actions">
        ${contatoBtn}
        <a class="btn" href="mensagens.html">Enviar mensagem</a>
      </div>
    `;
  }catch(e){
    console.error(e);
    tutoraBox.innerHTML = `<p class="muted">Não foi possível carregar as informações da sua tutora agora.</p>`;
  }
}