import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const contato   = document.getElementById("contato");
const bio       = document.getElementById("bio");

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
    photoData = reader.result;
    showAvatar(photoData);
  };
  reader.readAsDataURL(f);
});
btnRemoverFoto.addEventListener("click", ()=>{
  photoData = null;
  showAvatar(null);
});

cep.addEventListener("input", ()=>{
  let d = onlyDigits(cep.value).slice(0,8);
  cep.value = d.length > 5 ? d.slice(0,5) + "-" + d.slice(5) : d;
});
cep.addEventListener("blur", ()=> fetchByCep(cep.value));

let UID = null;

onAuthStateChanged(auth, async (user)=>{
  if (!user){ window.location.href = "login.html"; return; }
  UID = user.uid;

  try{
    const ref = doc(db,"usuarios", UID);
    const snap = await getDoc(ref);
    const U = snap.exists() ? snap.data() : {};

    if (U.tipo && U.tipo !== "tutora"){
      alert("Área exclusiva para Tutoras.");
      window.location.href = "login.html";
      return;
    }
    if (!U.tipo){
      await setDoc(ref, { tipo:"tutora", atualizadoEm:new Date() }, { merge:true });
    }

    email.value = U.email || user.email || "";

    const fullName = U.nome || user.displayName || "";
    if (fullName && !U.firstName && !U.lastName){
      const parts = fullName.split(" ");
      firstName.value = parts.shift() || "";
      lastName.value  = parts.join(" ");
    } else {
      firstName.value = U.firstName || "";
      lastName.value  = U.lastName || "";
    }

    birthdate.value = U.birthdate || "";
    gender.value    = U.gender || "";
    cep.value       = U.cep || "";
    city.value      = U.city || "";
    uf.value        = (U.uf || "").toUpperCase();
    education.value = U.education || "";
    educationOther.value = U.educationOther || "";

    contato.value   = U.contato || "";
    bio.value       = U.bio || "";

    photoData = U.photoData || null;
    showAvatar(photoData);
  }catch(e){
    alert("Não foi possível carregar seu perfil: " + (e.code || e.message));
  }
});

btnCancelar.addEventListener("click", ()=> window.location.reload());

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
      tipo: "tutora",
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
      contato:   contato.value.trim(),
      bio:       bio.value.trim(),
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