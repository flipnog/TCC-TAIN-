import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function canRedoFromUrl(){
  const p = new URLSearchParams(window.location.search);
  return p.get("refazer") === "1";
}

async function salvarResultadoFinal(uid, resultado){
  await setDoc(doc(db,"usuarios",uid), {
    categoriaSugerida: resultado.categoriaSugerida,
    papelSugerido: resultado.papelSugerido,
    questionario: {
      topTags: resultado.topTags || [],
      respostas: resultado.respostas || [],
      scoresTags: resultado.scoresTags || {},
      scoresCategorias: resultado.scoresCategorias || {},
      finalizadoEm: serverTimestamp()
    },
    questionarioFinalizado: true,
    atualizadoEm: new Date()
  }, { merge:true });
}

const CATEGORIAS = {
  "Desenvolvimento e Programação": ["frontend","backend","fullstack","software","mobile","games","embedded"],
  "Infraestrutura e Redes": ["networks","sysadmin","devops","cloud"],
  "Segurança da Informação (Cybersecurity)": ["security","pentest","netsec","seceng","incident"],
  "Dados e Inteligência Artificial": ["data","datapipeline","analytics","bi","ml"],
  "Design e Experiência do Usuário": ["ui","ux","productdesign","webdesign"],
  "Gestão e Produto": ["po","pm","scrum","project","techlead"],
  "Suporte e Atendimento": ["helpdesk","servicedesk","erp"],
  "Outras áreas emergentes": ["vrar","iot","blockchain","robotics","edge"]
};

const ROLES = {
  "Desenvolvimento e Programação": [
    { papel: "Desenvolvedor(a) Front-End", tags: ["frontend","ui","webdesign"] },
    { papel: "Desenvolvedor(a) Back-End", tags: ["backend","software"] },
    { papel: "Desenvolvedor(a) Full Stack", tags: ["fullstack","frontend","backend"] },
    { papel: "Engenheiro(a) de Software", tags: ["software","backend"] },
    { papel: "Desenvolvedor(a) Mobile", tags: ["mobile"] },
    { papel: "Desenvolvedor(a) de Jogos", tags: ["games"] },
    { papel: "Programador(a) de Sistemas Embarcados", tags: ["embedded","iot"] }
  ],
  "Infraestrutura e Redes": [
    { papel: "Administrador(a) de Redes", tags: ["networks"] },
    { papel: "Engenheiro(a) de Redes", tags: ["networks","cloud"] },
    { papel: "Administrador(a) de Sistemas", tags: ["sysadmin"] },
    { papel: "Engenheiro(a) de DevOps", tags: ["devops","cloud"] },
    { papel: "Especialista em Cloud Computing", tags: ["cloud"] }
  ],
  "Segurança da Informação (Cybersecurity)": [
    { papel: "Analista de Segurança da Informação", tags: ["security"] },
    { papel: "Pentester / Ethical Hacker", tags: ["pentest"] },
    { papel: "Especialista em Segurança de Redes", tags: ["netsec","security"] },
    { papel: "Engenheiro(a) de Segurança", tags: ["seceng","security"] },
    { papel: "Analista de Resposta a Incidentes", tags: ["incident","security"] }
  ],
  "Dados e Inteligência Artificial": [
    { papel: "Cientista de Dados", tags: ["ml","analytics","data"] },
    { papel: "Engenheiro(a) de Dados", tags: ["datapipeline","data"] },
    { papel: "Analista de Dados", tags: ["analytics","bi"] },
    { papel: "Engenheiro(a) de Machine Learning", tags: ["ml","data"] },
    { papel: "Especialista em BI (Business Intelligence)", tags: ["bi","analytics"] }
  ],
  "Design e Experiência do Usuário": [
    { papel: "UI Designer (User Interface)", tags: ["ui","webdesign"] },
    { papel: "UX Designer (User Experience)", tags: ["ux"] },
    { papel: "Designer de Produto Digital", tags: ["productdesign","ux","ui"] },
    { papel: "Web Designer", tags: ["webdesign","ui"] }
  ],
  "Gestão e Produto": [
    { papel: "Product Owner (PO)", tags: ["po","scrum"] },
    { papel: "Product Manager (PM)", tags: ["pm"] },
    { papel: "Scrum Master", tags: ["scrum"] },
    { papel: "Gerente de Projetos de TI", tags: ["project"] },
    { papel: "Tech Lead", tags: ["techlead"] }
  ],
  "Suporte e Atendimento": [
    { papel: "Suporte Técnico / Help Desk", tags: ["helpdesk"] },
    { papel: "Analista de Service Desk", tags: ["servicedesk"] },
    { papel: "Administrador(a) de ERP", tags: ["erp"] }
  ],
  "Outras áreas emergentes": [
    { papel: "Especialista em Realidade Virtual/Aumentada (VR/AR)", tags: ["vrar"] },
    { papel: "Engenheiro(a) de IoT", tags: ["iot","embedded"] },
    { papel: "Especialista em Blockchain", tags: ["blockchain"] },
    { papel: "Engenheiro(a) de Robótica", tags: ["robotics","embedded"] },
    { papel: "Especialista em Edge Computing", tags: ["edge","iot"] }
  ]
};

const bump = (obj, keys, val = 2) => { keys.forEach(k => obj[k] = (obj[k] || 0) + val); return obj; };

const PERGUNTAS = [
  { id:"Q1",  enunciado:"Qual grande área de tecnologia mais combina com você agora?", opcoes:[
    { t:"Desenvolvimento e Programação", w:bump({},["software","frontend","backend"],1) },
    { t:"Infraestrutura e Redes", w:bump({},["networks","sysadmin","devops","cloud"],1) },
    { t:"Segurança da Informação (Cyber)", w:bump({},["security"],2) },
    { t:"Dados e Inteligência Artificial", w:bump({},["data","analytics","ml","bi"],1) },
    { t:"Design e Experiência do Usuário", w:bump({},["ui","ux","productdesign","webdesign"],1) },
    { t:"Gestão e Produto", w:bump({},["po","pm","scrum","project","techlead"],1) },
    { t:"Suporte e Atendimento", w:bump({},["helpdesk","servicedesk","erp"],1) },
    { t:"Outras áreas emergentes", w:bump({},["vrar","iot","blockchain","robotics","edge"],1) }
  ]},
  { id:"Q2",  enunciado:"O que você quer construir principalmente?", opcoes:[
    { t:"Interfaces web e experiências visuais", w:{ frontend:2, ui:1, webdesign:1 } },
    { t:"APIs, lógica de negócio e bancos de dados para web", w:{ backend:2, software:1 } },
    { t:"Ambos: interfaces e APIs na web", w:{ fullstack:2, frontend:1, backend:1 } },
    { t:"Aplicativos Mobile (iOS/Android)", w:{ mobile:2 } },
    { t:"Jogos digitais", w:{ games:2 } },
    { t:"Software para microcontroladores/IoT", w:{ embedded:2, iot:1 } },
    { t:"Projetar sistemas complexos e arquitetura", w:{ software:2, backend:1 } }
  ]},
  { id:"Q3",  enunciado:"No desenvolvimento web, você prefere...", opcoes:[
    { t:"Trabalhar com HTML/CSS, componentes visuais e acessibilidade", w:{ frontend:2, ui:1, webdesign:1 } },
    { t:"Programar lógica no front (estado, roteamento, chamadas a API)", w:{ frontend:2, software:1 } },
    { t:"Criar design systems e interfaces pixel-perfect", w:{ ui:2, frontend:1 } }
  ]},
  { id:"Q4",  enunciado:"Dentro de Infra/Redes, o que mais te atrai?", opcoes:[
    { t:"Redes (roteamento, switches, topologias, BGP/OSPF)", w:{ networks:2 } },
    { t:"Sistemas e servidores (Linux/Windows, automação)", w:{ sysadmin:2 } },
    { t:"Automação, CI/CD e cultura DevOps", w:{ devops:2, cloud:1 } },
    { t:"Arquiteturas e serviços em Cloud (AWS/Azure/GCP)", w:{ cloud:2 } }
  ]},
  { id:"Q5",  enunciado:"Sobre Redes, seu foco seria mais...", opcoes:[
    { t:"Operação diária, configurações e suporte a sites", w:{ networks:2 } },
    { t:"Projetar/otimizar redes de grande porte e alta disponibilidade", w:{ networks:2, cloud:1 } }
  ]},
  { id:"Q6",  enunciado:"Qual vertente de Segurança mais te interessa?", opcoes:[
    { t:"Ofensiva: encontrar falhas (pentest/ethical hacking)", w:{ pentest:2, security:1 } },
    { t:"Defensiva/operacional: monitorar e proteger", w:{ security:2 } },
    { t:"Arquitetura de segurança e DevSecOps", w:{ seceng:2, security:1 } },
    { t:"Segurança de redes (firewalls, IDS/IPS, NAC)", w:{ netsec:2, security:1 } },
    { t:"Resposta a incidentes e forense", w:{ incident:2, security:1 } }
  ]},
  { id:"Q7",  enunciado:"Em Dados/IA, você curte mais...", opcoes:[
    { t:"Estatística, modelagem e gerar insights", w:{ analytics:1, ml:1, data:1 } },
    { t:"Construir pipelines/infra para dados (ETL/ELT)", w:{ datapipeline:2, data:1 } },
    { t:"Dashboards e indicadores para o negócio", w:{ bi:2, analytics:1 } }
  ]},
  { id:"Q8",  enunciado:"No lado de modelos, seu foco seria...", opcoes:[
    { t:"Explorar dados e criar modelos para responder perguntas do negócio", w:{ analytics:2, ml:1 } },
    { t:"Colocar modelos em produção e manter em escala", w:{ ml:2, data:1 } }
  ]},
  { id:"Q9",  enunciado:"Para suporte a decisões, você prefere...", opcoes:[
    { t:"Analisar métricas, criar relatórios e painéis", w:{ analytics:2, bi:1 } },
    { t:"Modelagem analítica e plataformas de BI corporativo", w:{ bi:2, analytics:1 } }
  ]},
  { id:"Q10", enunciado:"No Design de Produto, qual perfil descreve melhor você?", opcoes:[
    { t:"UI: visual, componentes, tipografia e cores", w:{ ui:2, webdesign:1 } },
    { t:"UX: pesquisa, jornada, arquitetura da informação", w:{ ux:2 } },
    { t:"Produto: unir UX/UI com métricas e estratégia", w:{ productdesign:2 } },
    { t:"Web: layout de sites e estética visual", w:{ webdesign:2, ui:1 } }
  ]},
  { id:"Q11", enunciado:"Você quer liderar como?", opcoes:[
    { t:"Tecnicamente, guiando soluções e padrões", w:{ techlead:2, software:1 } },
    { t:"Produto: visão, descoberta e métricas", w:{ pm:2, po:1 } },
    { t:"Processos ágeis: facilitar e melhorar fluxo", w:{ scrum:2 } }
  ]},
  { id:"Q12", enunciado:"No universo de produto, qual foco te move?", opcoes:[
    { t:"Definir estratégia e ciclo de vida", w:{ pm:2 } },
    { t:"Maximar valor no backlog e releases", w:{ po:2 } }
  ]},
  { id:"Q13", enunciado:"Na operação, o que te empolga mais?", opcoes:[
    { t:"Scrum, facilitação e remoção de impedimentos", w:{ scrum:2 } },
    { t:"Planejamento de escopo, cronograma e riscos", w:{ project:2 } }
  ]},
  { id:"Q14", enunciado:"No atendimento/ops, sua vocação é...", opcoes:[
    { t:"Atender e resolver problemas técnicos dos usuários", w:{ helpdesk:2 } },
    { t:"Gerir chamados, SLAs e relatórios", w:{ servicedesk:2 } },
    { t:"Administrar sistema ERP e apoiar áreas de negócio", w:{ erp:2 } }
  ]},
  { id:"Q15", enunciado:"Em áreas emergentes, qual te chama mais?", opcoes:[
    { t:"VR/AR — experiências imersivas", w:{ vrar:2 } },
    { t:"IoT — dispositivos conectados", w:{ iot:2, embedded:1 } },
    { t:"Blockchain — web3 e contratos inteligentes", w:{ blockchain:2 } },
    { t:"Robótica — percepção e controle", w:{ robotics:2, embedded:1 } },
    { t:"Edge Computing — processamento no limite", w:{ edge:2, iot:1 } }
  ]}
];

const formEl = document.getElementById("quizForm");
const btnBack = document.getElementById("btnBack");
const btnNext = document.getElementById("btnNext");
const btnLogout = document.getElementById("btnLogout");
const btnReset = document.getElementById("btnReset");
const stepNow = document.getElementById("stepNow");
const stepTotal = document.getElementById("stepTotal");
const progressBar = document.getElementById("progressBar");

let step = 0;
const respostas = Array(PERGUNTAS.length).fill(null);

function renderStep() {
  const q = PERGUNTAS[step];
  stepTotal.textContent = PERGUNTAS.length.toString();
  stepNow.textContent = (step + 1).toString();
  const pct = Math.round((step) / PERGUNTAS.length * 100);
  progressBar.style.width = `${pct}%`;
  formEl.innerHTML = `
    <div class="question">
      <h3>${q.enunciado}</h3>
      <div class="options">
        ${q.opcoes.map((op, j) => `
          <label>
            <input type="radio" name="${q.id}" value="${j}" ${respostas[step]===j?'checked':''} required>
            ${op.t}
          </label>
        `).join("")}
      </div>
    </div>
  `;
  btnBack.disabled = step === 0;
  btnNext.textContent = step === PERGUNTAS.length - 1 ? "Finalizar" : "Avançar";
}

function captureCurrent() {
  const q = PERGUNTAS[step];
  const sel = formEl.querySelector(`input[name="${q.id}"]:checked`);
  respostas[step] = sel ? parseInt(sel.value, 10) : null;
}

function requireAnswer() {
  if (respostas[step] === null) {
    alert("Selecione uma opção para continuar.");
    return false;
  }
  return true;
}

btnBack.addEventListener("click", () => { captureCurrent(); if (step > 0) step--; renderStep(); });

btnNext.addEventListener("click", async () => {
  captureCurrent();
  if (!requireAnswer()) return;
  if (step === PERGUNTAS.length - 1) { await finalizar(); return; }
  step++; renderStep();
});

btnLogout.addEventListener("click", async () => {
  try { await signOut(auth); window.location.href = "login.html"; }
  catch (e) { alert("Não foi possível sair agora: " + e.message); }
});

btnReset.addEventListener("click", () => { respostas.fill(null); step = 0; renderStep(); window.scrollTo({ top: 0, behavior: "smooth" }); });

formEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); btnNext.click(); } });
document.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") btnNext.click(); if (e.key === "ArrowLeft") btnBack.click(); });

function computeScoring() {
  const tagScores = {};
  const catScores = {};
  Object.keys(CATEGORIAS).forEach(cat => catScores[cat] = 0);

  PERGUNTAS.forEach((q, i) => {
    const idx = respostas[i];
    if (idx === null || idx === undefined) return;
    const w = q.opcoes[idx].w || {};
    Object.keys(w).forEach(t => { tagScores[t] = (tagScores[t] || 0) + w[t]; });
  });

  Object.entries(CATEGORIAS).forEach(([cat, tags]) => {
    catScores[cat] = tags.reduce((s, t) => s + (tagScores[t] || 0), 0);
  });

  let topCat = null, topScore = -1;
  Object.entries(catScores).forEach(([cat, sc]) => { if (sc > topScore) { topScore = sc; topCat = cat; } });

  let topRole = ROLES[topCat][0].papel, roleScore = -1;
  ROLES[topCat].forEach(r => {
    const s = r.tags.reduce((acc, t) => acc + (tagScores[t] || 0), 0);
    if (s > roleScore) { roleScore = s; topRole = r.papel; }
  });

  const topTags = Object.entries(tagScores).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  return { tagScores, catScores, categoria: topCat, papel: topRole, topTags };
}

async function finalizar() {
  const user = auth.currentUser;
  if (!user) { window.location.href = "login.html"; return; }

  for (let i = 0; i < PERGUNTAS.length; i++) {
    if (respostas[i] === null || respostas[i] === undefined) {
      alert("Você deixou uma pergunta sem resposta.");
      return;
    }
  }

  const r = computeScoring();
  try {
    const resultado = {
      categoriaSugerida: r.categoria,
      papelSugerido: r.papel,
      topTags: r.topTags,
      respostas,
      scoresTags: r.tagScores,
      scoresCategorias: r.catScores
    };
    await salvarResultadoFinal(user.uid, resultado);
    window.location.href = "resultado.html";
  } catch (e) {
    alert("Erro ao salvar resultado: " + e.message);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if (snap.exists()) {
    const u = snap.data();
    if (u.tipo && u.tipo !== "estudante") {
      alert("Este formulário é apenas para Estudantes.");
      window.location.href = "login.html";
      return;
    }
    if (u.questionarioFinalizado === true && !canRedoFromUrl()) {
      window.location.href = "resultado.html";
      return;
    }
  }
  renderStep();
});