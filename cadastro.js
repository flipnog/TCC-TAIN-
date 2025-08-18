import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, createUserWithEmailAndPassword } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const tipoSel    = document.getElementById("tipo");
const boxEspec   = document.getElementById("box-espec");
const rowSenha   = document.getElementById("rowSenha");
const btn        = document.getElementById("cadastroBtn");
const tituloEl   = document.getElementById("titulo");
const subtituloEl= document.getElementById("subtitulo");

const inpNome    = document.getElementById("nome");
const inpEmail   = document.getElementById("email");
const inpContato = document.getElementById("contato");
const inpSenha   = document.getElementById("password");
const inpEspec   = document.getElementById("especialidades");

let modoCompletar = false;

tipoSel.addEventListener("change", () => {
  boxEspec.classList.toggle("hidden", tipoSel.value !== "tutora");
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  modoCompletar = true;
  tituloEl.textContent = "Completar perfil";
  subtituloEl.textContent = "Confirme seus dados para continuar";
  btn.textContent = "Salvar perfil";

  if (!inpNome.value)  inpNome.value  = user.displayName || "";
  if (!inpEmail.value) inpEmail.value = user.email || "";
  inpEmail.readOnly = true;
  inpEmail.classList.add("readonly");
  if (rowSenha) rowSenha.style.display = "none";

  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const u = snap.data();
    if (u.tipo === "tutora") {
      window.location.href = "tutora.html";
      return;
    }
    if (u.tipo === "estudante") {
      window.location.href = "formulario.html";
      return;
    }
    if (u.contato) inpContato.value = u.contato;
    if (Array.isArray(u.especialidades) && u.especialidades.length) {
      tipoSel.value = "tutora";
      boxEspec.classList.remove("hidden");
      inpEspec.value = u.especialidades.join(", ");
    }
  }
});

btn.addEventListener("click", async () => {
  const nome   = inpNome.value.trim();
  const email  = inpEmail.value.trim();
  const senha  = (inpSenha?.value || "").trim();
  const tipo   = tipoSel.value;
  const contato= (inpContato?.value || "").trim();
  const especStr = (inpEspec?.value || "").trim();

  // validações
  if (!nome || !email || !tipo) {
    alert("Preencha nome, e-mail e selecione o tipo.");
    return;
  }
  if (!modoCompletar && !senha) {
    alert("Crie uma senha.");
    return;
  }

  try {
    let uid;
    if (modoCompletar) {
      // Já autenticada (ex.: Google) — só salva/atualiza doc
      uid = auth.currentUser.uid;
    } else {
      // Cadastro tradicional
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      uid = cred.user.uid;
    }

    let especialidades = [];
    if (tipo === "tutora" && especStr) {
      especialidades = especStr.split(",").map(s => s.trim()).filter(Boolean);
    }

    await setDoc(doc(db, "usuarios", uid), {
      nome,
      email,
      tipo,
      contato,
      especialidades,
      atualizadoEm: new Date(),
      ...(modoCompletar ? { criadoEm: new Date() } : { criadoEm: new Date() })
    }, { merge: true });

    alert(modoCompletar ? "Perfil salvo!" : "Cadastro realizado com sucesso!");

    if (tipo === "tutora") {
      window.location.href = "dashboard_tutora.html";
    } else {
      window.location.href = "formulario.html";
    }
  } catch (error) {
    alert("Erro no cadastro: " + error.message);
  }
});