import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const categoriaEl = document.getElementById("categoria");
const papelEl = document.getElementById("papel");
const trilhaEl = document.getElementById("trilha");
const tutorasEl = document.getElementById("tutoras");
const hintEl = document.getElementById("hint");

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

const KEYWORDS = {
  "Desenvolvimento e Programação": ["frontend","html","css","javascript","react","ui","web","backend","api","node","java","python","full stack","fullstack","mobile","react native","flutter","android","ios","games","unity","unreal","embedded","iot","c","c++"],
  "Infraestrutura e Redes": ["redes","network","router","switch","ccna","sysadmin","linux","windows server","devops","ci/cd","kubernetes","docker","cloud","aws","azure","gcp"],
  "Segurança da Informação (Cybersecurity)": ["segurança","security","pentest","ethical hacking","netsec","wireshark","siem","incident","forense","owasp"],
  "Dados e Inteligência Artificial": ["dados","data","sql","etl","pipeline","bi","power bi","excel","analytics","python","pandas","ml","machine learning"],
  "Design e Experiência do Usuário": ["ui","ux","figma","prototipagem","design system","web design","acessibilidade"],
  "Gestão e Produto": ["product owner","po","product manager","pm","scrum","scrum master","kanban","agile","project","gp","tech lead","liderança"],
  "Suporte e Atendimento": ["help desk","service desk","suporte","erp","totvs","sap","protheus"],
  "Outras áreas emergentes": ["vr","ar","vr/ar","realidade virtual","realidade aumentada","iot","blockchain","robótica","robotics","edge"]
};


function inferKeywords(categoria, papel) {
  const base = (KEYWORDS[categoria] || []).slice(0);
  if (!papel) return base;

  const p = papel.toLowerCase();
  if (p.includes("front")) base.unshift("frontend","html","css","javascript","react","ui");
  if (p.includes("back")) base.unshift("backend","api","node","java","python","sql");
  if (p.includes("full")) base.unshift("fullstack","frontend","backend");
  if (p.includes("mobile")) base.unshift("mobile","react native","flutter","android","ios");
  if (p.includes("jogos")) base.unshift("games","unity","unreal");
  if (p.includes("embarc")) base.unshift("embedded","iot","c","c++");
  if (p.includes("redes")) base.unshift("networks","redes","router","switch","ccna");
  if (p.includes("devops")) base.unshift("devops","kubernetes","docker","ci/cd","cloud");
  if (p.includes("cloud")) base.unshift("aws","azure","gcp","cloud");
  if (p.includes("seguran")) base.unshift("security","pentest","netsec","siem","incident");
  if (p.includes("dados")) base.unshift("dados","sql","etl","bi","python","pandas");
  if (p.includes("machine")) base.unshift("ml","machine learning","modelos");
  if (p.includes("ui")) base.unshift("ui","figma","web design");
  if (p.includes("ux")) base.unshift("ux","pesquisa");
  if (p.includes("product")) base.unshift("po","pm","scrum","agile");
  if (p.includes("help")) base.unshift("help desk","service desk");
  if (p.includes("erp")) base.unshift("erp","totvs","sap","protheus");
  if (p.includes("vr") || p.includes("ar")) base.unshift("vr","ar","realidade");
  if (p.includes("blockchain")) base.unshift("blockchain","web3");
  if (p.includes("rob")) base.unshift("robótica","robotics");
  return [...new Set(base)];
}

function norm(s){ return (s||"").toString().toLowerCase().trim(); }

function scoreTutora(especialidades=[], keywords=[]){
  const esp = especialidades.map(norm);
  const kws = keywords.map(norm);
  let sc = 0;
  for (const k of kws){
    for (const e of esp){
      if (!e) continue;
      if (e === k || e.includes(k) || k.includes(e)) { sc += 1; break; }
    }
  }
  return sc;
}

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="login.html"; return; }

  const uSnap = await getDoc(doc(db,"usuarios",user.uid));
  if(!uSnap.exists()){ categoriaEl.textContent="Perfil não encontrado."; return; }

  const u = uSnap.data();
  const categoria = u.categoriaSugerida || "Desenvolvimento e Programação";
  const papel = u.papelSugerido || "Desenvolvedor(a) Front-End";
  const topTags = (u.questionario?.topTags || []).map(t=>t.toLowerCase());

  categoriaEl.textContent = categoria;
  papelEl.textContent = papel;

  trilhaEl.innerHTML="";
  (TRILHAS[categoria]||[]).forEach(item=>{
    const li=document.createElement("li"); li.textContent=item; trilhaEl.appendChild(li);
  });

  await recomendarTutoras(categoria, papel, topTags);
});

async function recomendarTutoras(categoria, papel, topTags){
  tutorasEl.innerHTML = "";
  hintEl.textContent = "";

  const inferred = inferKeywords(categoria, papel);
  const keywords = [...new Set([...(topTags||[]), ...inferred])];

  const qAll = query(collection(db,"usuarios"), where("tipo","==","tutora"), limit(50));
  const res = await getDocs(qAll);

  if (res.empty){
    tutorasEl.innerHTML = "<p>Nenhuma tutora cadastrada ainda.</p>";
    hintEl.textContent = "Dica: cadastre tutoras com o campo 'especialidades' (ex.: JavaScript, DevOps, SQL, UX/UI).";
    return;
  }

  const lista = [];
  res.forEach(d=>{
    const t = d.data();
    const sc = scoreTutora(t.especialidades||[], keywords);
    lista.push({ ...t, _score: sc });
  });

  lista.sort((a,b)=>b._score - a._score);
  const top = lista.filter(x=>x._score>0).slice(0,6);

  if (top.length === 0){
    hintEl.textContent = "Dica: melhore as 'especialidades' das tutoras para recomendações mais precisas.";
    renderTutoras(lista.slice(0,6));
  } else {
    renderTutoras(top);
  }
}

function renderTutoras(arr){
  tutorasEl.innerHTML = "";
  arr.forEach(t=>{
    const div = document.createElement("div");
    div.className = "tutora";
    const espec = (t.especialidades||[]).map(s=>`<span class="pill">${s}</span>`).join(" ");
    div.innerHTML = `
      <strong>${t.nome || "Tutora"}</strong><br/>
      <span class="muted">${t.email || ""}</span>
      <div style="margin-top:6px">${espec || '<span class="muted">Sem especialidades informadas</span>'}</div>
    `;
    tutorasEl.appendChild(div);
  });
}