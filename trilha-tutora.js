import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, collection, getDocs, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const alunaNome = document.getElementById("alunaNome");
const alunaMeta = document.getElementById("alunaMeta");
const listaEl   = document.getElementById("lista");
const btnMsgs   = document.getElementById("btnMsgs");

const params = new URLSearchParams(location.search);
const ALUNA_ID = params.get("id");

if (!ALUNA_ID){
  alert("ID da aluna não informado.");
  window.location.href = "tutora.html";
}

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

async function loadTrilha(tutoraId){
  const us = await getDoc(doc(db,"usuarios",ALUNA_ID));
  if (!us.exists()){
    alunaNome.textContent = "Aluna não encontrada.";
    return;
  }
  const u = us.data();
  alunaNome.textContent = u.nome || "Estudante";
  alunaMeta.textContent = `${u.categoriaSugerida || "-"} • ${u.papelSugerido || "-"}`;
  btnMsgs.href = `mensagens-tutora.html?tid=${tutoraId}__${ALUNA_ID}`;

  const categoria = u.categoriaSugerida || "Desenvolvimento e Programação";
  const baseItems = (TRILHAS[categoria] || TRILHAS["Desenvolvimento e Programação"])
    .map(title => ({ id: slug(title), title }));

  const snap = await getDocs(collection(db,"usuarios",ALUNA_ID,"trilha"));
  const saved = new Map();
  snap.forEach(d => saved.set(d.id, d.data()));

  const frags = [];
  for (const b of baseItems){
    const s = saved.get(b.id) || {};

    const fbRef = doc(db,"usuarios",ALUNA_ID,"trilha",b.id,"feedback",tutoraId);
    const fbSnap = await getDoc(fbRef);
    const myText = fbSnap.exists() ? (fbSnap.data().text || "") : "";

    const step = document.createElement("div");
    step.className = "step";
    step.innerHTML = `
      <h4>${b.title}</h4>
      <div class="meta">
        <span class="badge ${s.done ? "concluido" : "pendente"}">
          ${s.done ? "Concluído pela aluna" : "Pendente"}
        </span>
      </div>

      <div class="row">
        <div style="flex:1">
          <div class="muted" style="margin-bottom:4px">Anotações da aluna</div>
          <textarea class="readonly" readonly>${(s.studentNote || "").trim()}</textarea>
        </div>
        <div style="flex:1">
          <div class="muted" style="margin-bottom:4px">Observações da tutora</div>
          <textarea class="ta" data-item="${b.id}" placeholder="Escreva suas orientações, referências, próximos passos…">${myText}</textarea>
          <div class="saveHint" id="hint-${b.id}"></div>
        </div>
      </div>
    `;
    frags.push(step);
  }

  listaEl.innerHTML = "";
  frags.forEach(el=> listaEl.appendChild(el));

  const timers = new Map();
  listaEl.querySelectorAll("textarea.ta").forEach(ta=>{
    ta.addEventListener("input", ()=>{
      const itemId = ta.getAttribute("data-item");
      const hint = document.getElementById(`hint-${itemId}`);
      hint.textContent = "Salvando…";
      clearTimeout(timers.get(itemId));
      timers.set(itemId, setTimeout(async ()=>{
        try{
          await setDoc(
            doc(db,"usuarios",ALUNA_ID,"trilha",itemId,"feedback",tutoraId),
            { text: ta.value.trim(), tutoraId, updatedAt: serverTimestamp() },
            { merge:true }
          );
          hint.textContent = "Salvo.";
          setTimeout(()=> hint.textContent="", 1200);
        }catch(e){
          hint.textContent = "Erro ao salvar.";
          console.error(e);
        }
      }, 400));
    });
  });
}

onAuthStateChanged(auth, async (user)=>{
  if (!user){ window.location.href="login.html"; return; }

  const meSnap = await getDoc(doc(db,"usuarios",user.uid));
  if (!meSnap.exists() || meSnap.data().tipo !== "tutora"){
    alert("Área exclusiva para Tutoras.");
    window.location.href = "login.html";
    return;
  }

  await loadTrilha(user.uid);
});