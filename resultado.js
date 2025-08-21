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

// Elementos da UI
const categoriaEl = document.getElementById("categoria");
const papelEl     = document.getElementById("papel");
const trilhaEl    = document.getElementById("trilha");

// Contêiner da tutora (compatível com IDs antigos ou novos)
const tutorBox =
  document.getElementById("tutoraBox") ||
  document.getElementById("tutoras") ||          // ID antigo
  document.getElementById("tutora");             // fallback se existir

// Mensagem auxiliar (se existir no HTML)
const hintEl = document.getElementById("hint");

// Trilha por categoria
const TRILHAS = {
  "Desenvolvimento e Programação": [
    "Lógica de Programação",
    "Git/GitHub",
    "HTML/CSS/JS",
    "Banco de Dados (SQL)",
    "APIs/HTTP",
    "Framework (React/Node)",
    "Boas práticas e testes"
  ],
  "Infraestrutura e Redes": [
    "Redes (TCP/IP)",
    "Linux/Windows Server",
    "Scripting (Shell/Python)",
    "Cloud (AWS/Azure/GCP)",
    "CI/CD e Observabilidade",
    "Segurança básica"
  ],
  "Segurança da Informação (Cybersecurity)": [
    "Fundamentos de Segurança",
    "Pentest básico",
    "Segurança de Redes",
    "SIEM e Resposta a Incidentes",
    "Criptografia",
    "Compliance"
  ],
  "Dados e Inteligência Artificial": [
    "Fundamentos de Dados",
    "SQL",
    "ETL/Pipelines",
    "BI/Dashboards (Power BI)",
    "Python (Pandas)",
    "ML básico"
  ],
  "Design e Experiência do Usuário": [
    "Princípios de Design",
    "Acessibilidade",
    "Figma/Prototipagem",
    "Pesquisa com Usuárias",
    "Design System",
    "Dev handoff"
  ],
  "Gestão e Produto": [
    "Agilidade/Scrum",
    "Discovery/Delivery",
    "Métricas de Produto",
    "Roadmap",
    "Comunicação & Liderança"
  ],
  "Suporte e Atendimento": [
    "ITIL/SLAs",
    "Ferramentas de Chamados",
    "Diagnóstico & Documentação",
    "Soft Skills",
    "Noções de Redes e SO"
  ],
  "Outras áreas emergentes": [
    "Fundamentos da área",
    "Ferramentas/SDKs",
    "Projeto prático guiado",
    "Publicação/Deploy",
    "Comunidade & Portfólio"
  ]
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // 1) Carrega o perfil SEM cache
  let uSnap;
  try {
    uSnap = await getDocFromServer(doc(db, "usuarios", user.uid));
  } catch (e) {
    safeSetText(categoriaEl, "Não foi possível carregar seus dados agora.");
    console.error(e);
    return;
  }
  if (!uSnap.exists()) {
    safeSetText(categoriaEl, "Perfil não encontrado.");
    return;
  }

  const u = uSnap.data();

  // 2) Render categoria/papel + trilha
  const categoria = u.categoriaSugerida || "Desenvolvimento e Programação";
  const papel     = u.papelSugerido     || "Desenvolvedor(a) Front-End";

  safeSetText(categoriaEl, categoria);
  safeSetText(papelEl, papel);

  trilhaEl.innerHTML = "";
  (TRILHAS[categoria] || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    trilhaEl.appendChild(li);
  });

  // 3) Mostra a TUTORA VINCULADA (match aceito). Se não houver, mensagem padrão.
  await renderTutoraVinculada(user.uid);
});

async function renderTutoraVinculada(estudanteId) {
  if (!tutorBox) return; // sem contêiner no HTML

  // Limpa e estado inicial
  tutorBox.innerHTML = "";
  if (hintEl) hintEl.textContent = "";

  try {
    // Busca um match ACEITO para esta estudante
    const q = query(
      collection(db, "matches"),
      where("estudanteId", "==", estudanteId),
      where("status", "==", "aceito"),
      limit(1)
    );

    const matchSnap = await getDocsFromServer(q);

    if (matchSnap.empty) {
      // Não há tutora vinculada ainda
      tutorBox.innerHTML = `
        <div class="tutora">
          <p class="muted">Você ainda não tem uma tutora definida.</p>
          <p class="muted">Assim que uma tutora aceitar te acompanhar, ela aparecerá aqui.</p>
        </div>
      `;
      return;
    }

    // Existe vínculo — pega a primeira
    const matchDoc = matchSnap.docs[0];
    const match    = matchDoc.data();
    const tutoraId = match.tutoraId;

    // Carrega dados da tutora diretamente do servidor
    const tutSnap = await getDocFromServer(doc(db, "usuarios", tutoraId));
    if (!tutSnap.exists()) {
      tutorBox.innerHTML = `
        <div class="tutora">
          <p class="muted">Sua tutora está vinculada, mas não conseguimos carregar os dados agora.</p>
        </div>
      `;
      return;
    }

    const t = tutSnap.data();

    // Monta especialidades (se houver)
    const especHtml = (t.especialidades || [])
      .map((s) => `<span class="pill">${escapeHtml(s)}</span>`)
      .join(" ");

    // Render do cartão da tutora
    tutorBox.innerHTML = `
      <div class="tutora">
        <div style="display:flex;gap:12px;align-items:center;">
          <div style="width:40px;height:40px;border-radius:50%;background:#ffe3f1;display:flex;align-items:center;justify-content:center;font-weight:700;color:#e62e8b;">
            ${getInitials(t.nome || "T")}
          </div>
          <div>
            <strong>${escapeHtml(t.nome || "Tutora")}</strong><br/>
            <span class="muted">${escapeHtml(t.email || "")}</span>
          </div>
        </div>
        <div style="margin-top:10px">${especHtml || '<span class="muted">Sem especialidades informadas</span>'}</div>

        <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
          <a class="pill" href="mensagens.html" style="text-decoration:none;">Enviar mensagem</a>
        </div>
      </div>
    `;
  } catch (e) {
    console.error(e);
    tutorBox.innerHTML = `
      <div class="tutora">
        <p class="muted">Não foi possível carregar sua tutora agora. Tente novamente mais tarde.</p>
      </div>
    `;
  }
}

/* -------- helpers -------- */

function safeSetText(el, text) {
  if (el) el.textContent = text;
}

function getInitials(name) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}

function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}