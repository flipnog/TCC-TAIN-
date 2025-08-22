import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, collection, query, where, getDocs,
  addDoc, serverTimestamp, onSnapshot, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const meInfo = document.getElementById("meInfo");
const btnLogout = document.getElementById("btnLogout");

const threadsEl = document.getElementById("threads");
const chatWith = document.getElementById("chatWith");
const chatWithEmail = document.getElementById("chatWithEmail");
const chatBody = document.getElementById("chatBody");
const chatHint = document.getElementById("chatHint");
const msgText = document.getElementById("msgText");
const btnSend = document.getElementById("btnSend");

let ME = null;
let ACTIVE = null;
let unsub = null;

function threadId(tutoraId, estudanteId){ return `${tutoraId}__${estudanteId}`; }

btnLogout.addEventListener("click", async ()=>{
  try { await signOut(auth); window.location.href = "login.html"; }
  catch(e){ alert("Não foi possível sair agora: " + e.message); }
});

onAuthStateChanged(auth, async (user)=>{
  if (!user){ window.location.href = "login.html"; return; }

  try{
    const uref = doc(db,"usuarios",user.uid);
    const usnap = await getDoc(uref);
    if (!usnap.exists()){
      alert("Complete seu cadastro antes.");
      window.location.href = "login.html";
      return;
    }
    const me = usnap.data();
    if (me.tipo && me.tipo !== "tutora") {
      alert("Área de mensagens exclusiva para Tutoras.");
      window.location.href = "login.html";
      return;
    }
    ME = { uid:user.uid, ...me };
    meInfo.textContent = `${me.nome || "Tutora"} — ${me.email || user.email || ""}`;

    await loadThreads();
  }catch(e){
    threadsEl.innerHTML = `<div class="thread-item muted">Erro ao carregar: ${e.code || e.message}</div>`;
  }
});

async function loadThreads(){
  threadsEl.innerHTML = `<div class="thread-item muted">Carregando…</div>`;

  try{
    // Busca conversas onde EU sou a tutora
    const q1 = query(
      collection(db,"matches"),
      where("tutoraId","==", ME.uid),
      limit(100)
    );
    const snap = await getDocs(q1);

    if (snap.empty){
      threadsEl.innerHTML = `<div class="thread-item muted">Você ainda não possui conversas com estudantes.</div>`;
      return;
    }

    const items = [];
    for (const docSnap of snap.docs){
      const tid = docSnap.id;
      const meta = docSnap.data();
      items.push({ tid, meta });
    }
    // ordena por criação (desc)
    items.sort((a,b)=>{
      const ta = a.meta.createdAt?.seconds || 0;
      const tb = b.meta.createdAt?.seconds || 0;
      return tb - ta;
    });

    threadsEl.innerHTML = "";
    for (const it of items){
      // carrega dados da ESTUDANTE
      const estSnap = await getDoc(doc(db,"usuarios", it.meta.estudanteId));
      const estudante = estSnap.exists() ? estSnap.data() : { nome:"Estudante", email:"" };

      const item = document.createElement("div");
      item.className = "thread-item";
      item.dataset.tid = it.tid;
      item.innerHTML = `
        <div><strong>${estudante.nome || "Estudante"}</strong></div>
        <div class="muted" style="font-size:.9rem">${estudante.email || ""}</div>
      `;
      item.addEventListener("click", ()=> openThread(it.tid, estudante));
      threadsEl.appendChild(item);
    }
  }catch(e){
    threadsEl.innerHTML = `<div class="thread-item muted">Erro ao buscar conversas: ${e.code || e.message}</div>`;
  }
}

function highlightActive(tid){
  threadsEl.querySelectorAll(".thread-item").forEach(el=>{
    el.classList.toggle("active", el.dataset.tid === tid);
  });
}

async function openThread(tid, estudanteDoc){
  ACTIVE = { tid, estudanteDoc };
  highlightActive(tid);

  chatWith.textContent = estudanteDoc?.nome || "Estudante";
  chatWithEmail.textContent = estudanteDoc?.email || "";
  chatHint.textContent = "Conversa em tempo real";
  chatBody.innerHTML = `<div class="muted">Carregando…</div>`;
  msgText.disabled = false;
  btnSend.disabled = false;

  if (typeof unsub === "function") { unsub(); unsub = null; }

  try{
    const msgsQ = query(collection(db,"matches", tid, "mensagens"));
    unsub = onSnapshot(msgsQ, (snap)=>{
      if (snap.empty){
        chatBody.innerHTML = `<div class="muted">Sem mensagens ainda. Envie a primeira! 🙂</div>`;
      } else {
        const arr = [];
        snap.forEach(m=> arr.push({ id:m.id, ...m.data() }));
        // força ordem por createdAt asc
        arr.sort((a,b)=>{
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          return ta - tb;
        });

        const html = arr.map(d=>{
          const you = d.from === ME.uid;
          const when = d.createdAt?.seconds ? new Date(d.createdAt.seconds*1000) : new Date();
          return `
            <div class="msg ${you ? 'you' : ''}">
              <div class="bubble">
                <div>${(d.text || "").replace(/\n/g,"<br>")}</div>
                <div class="when">${when.toLocaleString()}</div>
              </div>
            </div>
          `;
        }).join("");
        chatBody.innerHTML = html;
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    }, (err)=>{
      chatBody.innerHTML = `<div class="muted">Não foi possível carregar as mensagens (${err.code || err.message}).</div>`;
    });
  }catch(e){
    chatBody.innerHTML = `<div class="muted">Erro ao abrir conversa: ${e.code || e.message}</div>`;
  }
}

btnSend.addEventListener("click", async ()=>{
  const text = msgText.value.trim();
  if (!ACTIVE || !text) return;

  try{
    await addDoc(collection(db,"matches", ACTIVE.tid, "mensagens"), {
      from: ME.uid,
      text,
      createdAt: serverTimestamp()
    });
    msgText.value = "";
    autoresize();
  }catch(e){
    alert("Erro ao enviar mensagem: " + (e.code || e.message));
  }
});

/* ===== UX extra: auto-resize do textarea e Enter para enviar ===== */
function autoresize(){
  msgText.style.height = "auto";
  msgText.style.height = Math.min(msgText.scrollHeight, 180) + "px";
}
msgText.addEventListener("input", autoresize);

// Recalcula ao habilitar
const obs = new MutationObserver(autoresize);
obs.observe(msgText, { attributes:true, attributeFilter:["disabled"] });

// Enter envia; Shift+Enter quebra linha
msgText.addEventListener("keydown", (e)=>{
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    btnSend.click();
  }
});