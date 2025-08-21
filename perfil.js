import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const drawer = document.getElementById("drawer");
document.getElementById("btnHamb")?.addEventListener("click", ()=> drawer?.classList.toggle("show"));

const doLogout = async ()=>{ try{ await signOut(auth); window.location.href="login.html"; }catch(e){ alert(e.message);} };
document.getElementById("btnLogout")?.addEventListener("click", doLogout);
document.getElementById("btnLogout2")?.addEventListener("click", doLogout);

const form = document.getElementById("formPerfil");
const avatarImg = document.getElementById("avatarImg");
const avatarFallback = document.getElementById("avatarFallback");
const fileFoto = document.getElementById("fileFoto");
const btnRemoverFoto = document.getElementById("btnRemoverFoto");

const firstName = document.getElementById("firstName");
const lastName  = document.getElementById("lastName");
const email     = document.getElementById("email");
const birthdate = document.getElementById("birthdate");
const gender    = document.getElementById("gender");
const cep       = document.getElementById("cep");
const city      = document.getElementById("city");
const uf        = document.getElementById("uf");
const education = document.getElementById("education");
const educationOther = document.getElementById("educationOther");

const btnCancelar = document.getElementById("btnCancelar");
const btnSalvar   = document.getElementById("btnSalvar");

function showAvatar(dataUrl){
  if (dataUrl){
    avatarImg.src = dataUrl;
    avatarImg.style.display = "block";
    avatarFallback.style.display = "none";
  } else {
    avatarImg.removeAttribute("src");
    avatarImg.style.display = "none";
    avatarFallback.style.display = "block";
  }
}
function onlyDigits(s){ return (s||"").replace(/\D/g,""); }

async function fetchByCep(cepStr){
  const d = onlyDigits(cepStr);
  if (d.length !== 8) return;
  try{
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!res.ok) return;
    const j = await res.json();
    if (j && !j.erro){
      city.value = j.localidade || city.value;
      uf.value   = (j.uf || uf.value || "").toUpperCase();
    }
  }catch(_){}
}

let photoData = null;
fileFoto?.addEventListener("change", ()=>{
  const f = fileFoto.files?.[0];
  if (!f) return;
  if (!/^image\//.test(f.type)) { alert("Selecione uma imagem (PNG/JPG)."); return; }
  if (f.size > 2*1024*1024){ alert("Tamanho máximo recomendado: 2MB."); return; }

  const reader = new FileReader();
  reader.onload = () => {
    photoData = reader.result; // data URL
    showAvatar(photoData);
  };
  reader.readAsDataURL(f);
});
btnRemoverFoto.addEventListener("click", ()=>{
  photoData = null;
  showAvatar(null);
});

/* Formatação leve do CEP */
cep.addEventListener("input", ()=>{
  let d = onlyDigits(cep.value).slice(0,8);
  cep.value = d.length > 5 ? d.slice(0,5) + "-" + d.slice(5) : d;
});
cep.addEventListener("blur", ()=>{
  fetchByCep(cep.value);
});

let UID = null;
let SNAP = null;

onAuthStateChanged(auth, async (user)=>{
  if (!user){ window.location.href = "login.html"; return; }
  UID = user.uid;

  document.querySelectorAll(".link-resultado").forEach(a=>{
    a.addEventListener("click", async (e)=>{
      e.preventDefault();
      const snap = await getDoc(doc(db,"usuarios",UID));
      const u = snap.exists() ? snap.data() : {};
      const finished = u.questionarioFinalizado === true || (u.questionario?.topTags?.length>0);
      window.location.href = finished ? "resultado.html" : "formulario.html";
    });
  });

  try{
    const ref = doc(db,"usuarios", UID);
    const snap = await getDoc(ref);
    SNAP = snap.exists() ? snap.data() : {};

    email.value = SNAP.email || user.email || "";

    const fullName = SNAP.nome || user.displayName || "";
    if (fullName && !SNAP.firstName && !SNAP.lastName){
      const parts = fullName.split(" ");
      firstName.value = parts.shift() || "";
      lastName.value  = parts.join(" ");
    } else {
      firstName.value = SNAP.firstName || "";
      lastName.value  = SNAP.lastName || "";
    }

    birthdate.value = SNAP.birthdate || "";
    gender.value    = SNAP.gender || "";
    cep.value       = SNAP.cep || "";
    city.value      = SNAP.city || "";
    uf.value        = (SNAP.uf || "").toUpperCase();
    education.value = SNAP.education || "";
    educationOther.value = SNAP.educationOther || "";

    photoData = SNAP.photoData || null;
    showAvatar(photoData);
  }catch(e){
    alert("Não foi possível carregar seu perfil: " + (e.code || e.message));
  }
});

btnCancelar.addEventListener("click", ()=>{
  window.location.reload();
});

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  btnSalvar.disabled = true;

  if (!firstName.value.trim() || !lastName.value.trim()){
    alert("Informe nome e sobrenome.");
    btnSalvar.disabled = false;
    return;
  }

  try{
    const ref = doc(db,"usuarios", UID);
    await setDoc(ref, {
      firstName: firstName.value.trim(),
      lastName:  lastName.value.trim(),
      nome:      `${firstName.value.trim()} ${lastName.value.trim()}`.trim(),
      birthdate: birthdate.value || "",
      gender:    gender.value || "",
      cep:       cep.value || "",
      city:      city.value || "",
      uf:        (uf.value || "").toUpperCase(),
      education: education.value || "",
      educationOther: educationOther.value || "",
      photoData: photoData || null,
      atualizadoEm: new Date()
    }, { merge:true });

    alert("Perfil atualizado com sucesso!");
  }catch(e){
    alert("Erro ao salvar: " + (e.code || e.message));
  }finally{
    btnSalvar.disabled = false;
  }
});