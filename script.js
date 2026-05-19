/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyBIDfCfu2rQR0jf5l-3WFIYkspD8DRi4-s",
  authDomain: "://firebaseapp.com", // CORRIGIDO: Link completo restabelecido
  projectId: "driverpg-2c066",
  storageBucket: "driverpg-2c066.firebasestorage.app",
};

// Inicializa o app principal se não estiver inicializado
if(!firebase.apps.length){
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// CORRIGIDO: Inicialização segura do app secundário para evitar erros de execução no Vercel
let adminApp;
if (!firebase.apps.find(app => app.name === "AdminApp")) {
  adminApp = firebase.initializeApp(firebaseConfig, "AdminApp");
} else {
  adminApp = firebase.app("AdminApp");
}
const adminAuth = firebase.auth(adminApp);

/* ELEMENTOS DO DOM */
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const navbar = document.getElementById("navbar");
const editorNav = document.getElementById("editorNav");
const masterAdminBox = document.getElementById("masterAdminBox");
const listaFichas = document.getElementById("listaFichas");
const profileInfo = document.getElementById("profileInfo");
const topUsername = document.getElementById("topUsername");
const topCargo = document.getElementById("topCargo");
const userArea = document.querySelector(".userArea");
const saveFichaBtn = document.getElementById("saveFichaBtn");
const createAdminUserBtn = document.getElementById("createAdminUserBtn");
const searchInput = document.getElementById("searchInput");
const descricaoEditor = document.getElementById("descricaoFicha");

let editingFichaId = null; 
let usuarioLogadoCargo = "Membro"; // Padrão seguro de inicialização

/* NAVEGAÇÃO ENTRE PÁGINAS */
function showPage(pageId){
  document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
  const page = document.getElementById(pageId);
  if(page) page.classList.remove("hidden");

  document.querySelectorAll(".navBtn").forEach(btn => {
    btn.classList.remove("active");
    if(btn.dataset.page === pageId) btn.classList.add("active");
  });
}

document.querySelectorAll(".navBtn").forEach(btn => {
  btn.onclick = () => {
    if(btn.dataset.page) {
      if(btn.dataset.page === 'editorPage' && !editingFichaId) {
        limparFormularioFicha();
      }
      showPage(btn.dataset.page);
    }
  };
});

/* AUXILIAR DE FORMATAÇÃO DO EDITOR */
function executarComando(comando) {
  document.execCommand(comando, false, null);
}

/* INSERIR IMAGEM VIA URL */
function inserirImagemUrl() {
  const url = prompt("Insira a URL da imagem (ex: https://site.com):");
  if(url) {
    document.execCommand("insertImage", false, url);
  }
}

/* INTERCEPTADOR DE COLAGEM: COPIA 100% DA FORMATAÇÃO ORIGINAL (WORD, GOOGLE DOCS E IMAGENS) */
if(descricaoEditor) {
  descricaoEditor.addEventListener("paste", function(e) {
    e.preventDefault();
    const htmlText = e.clipboardData.getData("text/html");
    const plainText = e.clipboardData.getData("text/plain");

    if (htmlText) {
      document.execCommand("insertHTML", false, htmlText);
    } else {
      const formattedPlain = plainText.replace(/\n/g, "<br>");
      document.execCommand("insertHTML", false, formattedPlain);
    }
  });
}

/* LÓGICA DE LOGIN */
async function login(){
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value.trim();

  if(!email || !senha){
    alert("Preencha todos os campos.");
    return;
  }

  try{
    loginBtn.disabled = true;
    loginBtn.innerText = "Entrando...";
    await auth.signInWithEmailAndPassword(email, senha);
  }catch(err){
    console.error(err);
    alert("Erro ao entrar: " + err.message);
  }finally{
    loginBtn.disabled = false;
    loginBtn.innerText = "Entrar";
  }
}
if(loginBtn) loginBtn.onclick = login;

if(logoutBtn) {
  logoutBtn.onclick = async () => {
    await auth.signOut();
    location.reload();
  };
}

/* OBSERVADOR DE ESTADO DE AUTENTICAÇÃO (CONTROLE DE CARGOS E PERMISSÕES) */
let unsubscribeFichas = null;

auth.onAuthStateChanged(async user => {
  if(!user){
    if(unsubscribeFichas) unsubscribeFichas();
    navbar.classList.add("hidden");
    userArea.classList.remove("active");
    showPage("loginPage");
    return;
  }

  try {
    const userDoc = await db.collection("usuarios").doc(user.uid).get();
    let dadosUser = { nome: "Thiago", cargo: "Master" }; // Padrão de fallback condizente com a conta principal

    if(userDoc.exists) {
      dadosUser = userDoc.data();
    }

    usuarioLogadoCargo = dadosUser.cargo;

    topUsername.innerText = dadosUser.nome;
    topCargo.innerText = dadosUser.cargo;
    userArea.classList.add("active");
    navbar.classList.remove("hidden");

    profileInfo.innerHTML = `
      <b>Nome:</b> ${dadosUser.nome}<br>
      <b>E-mail:</b> ${user.email}<br>
      <b>Cargo atual:</b> ${dadosUser.cargo}
    `;

    // REGRAS DE EXIBIÇÃO DE INTERFACE POR CARGO:
    // Editores e Masters podem acessar a aba de criação de fichas
    if(usuarioLogadoCargo === "Master" || usuarioLogadoCargo === "Editor") {
      editorNav.classList.remove("hidden");
    } else {
      editorNav.classList.add("hidden"); // Membros apenas pesquisam e deslogam
    }

    // Apenas o cargo Master vê a caixa de gerenciamento/criação de contas no Perfil
    if(usuarioLogadoCargo === "Master") {
      masterAdminBox.classList.remove("hidden");
    } else {
      masterAdminBox.classList.add("hidden");
    }

    showPage("searchPage");
    carregarFichas();

  } catch(err) {
    console.error("Erro ao ler dados do usuário: ", err);
  }
});

/* CRIAR OU ATUALIZAR FICHA */
saveFichaBtn.onclick = async () => {
  const nome = document.getElementById("nomeFicha").value.trim();
  const descricaoHTML = descricaoEditor.innerHTML;

  if(!nome || !descricaoHTML || descricaoHTML === "<br>" || descricaoHTML.trim() === ""){
    alert("Insira os dados da ficha.");
    return;
  }

  try {
    saveFichaBtn.disabled = true;
    
    if(editingFichaId) {
      // Atualização de Ficha Existente (Editor ou Master)
      await db.collection("fichas").doc(editingFichaId).update({
        nome: nome,
        descricao: descricaoHTML,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("Ficha editada e salva com sucesso!");
    } else {
      // Criação de Nova Ficha (Editor ou Master)
      await db.collection("fichas").add({
        nome: nome,
        descricao: descricaoHTML,
        criadoPor: auth.currentUser.uid,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("Nova ficha cadastrada!");
    }

    limparFormularioFicha();
    showPage("searchPage");
  } catch(err) {
    alert("Erro operacional ao salvar ficha: " + err.message);
  } finally {
    saveFichaBtn.disabled = false;
  }
};

function limparFormularioFicha() {
  editingFichaId = null;
  document.getElementById("editorTitle").innerText = "Criar Ficha";
  document.getElementById("nomeFicha").value = "";
  descricaoEditor.innerHTML = "";
  saveFichaBtn.innerText = "Salvar Ficha";
}

/* CARREGAR FICHAS EM TEMPO REAL */
function carregarFichas() {
  if(unsubscribeFichas) unsubscribeFichas();

  unsubscribeFichas = db.collection("fichas").orderBy("criadoEm", "desc")
    .onSnapshot(snapshot => {
      renderizarFichas(snapshot.docs);
    }, err => console.error("Erro ao carregar banco em tempo real: ", err));
}

/* RENDERIZAR FICHAS E APLICAR BOTÕES DE ACORDO COM O CARGO */
function renderizarFichas(docs) {
  listaFichas.innerHTML = "";
  if(docs.length === 0) {
    listaFichas.innerHTML = "<p style='opacity:0.5;text-align:center;'>Nenhuma ficha cadastrada.</p>";
    return;
  }

  docs.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");
    div.className = "ficha";
    
    const conteudoExibicao = data.descricao.includes("<") ? data.descricao : data.descricao.replace(/\n/g, "<br>");
    let acoesHtml = "";
    
    // REGRAS DE PERMISSÃO PARA AÇÃO:
    // Apenas Masters e Editores recebem os controles visuais de modificação/exclusão
    if(usuarioLogadoCargo === "Master" || usuarioLogadoCargo === "Editor") {
       acoesHtml = `
        <div class="ficha-actions">
          <button type="button" class="edit-btn" onclick="prepararEdicao('${doc.id}')">Editar</button>
          <button type="button" class="delete-btn" onclick="deletarFicha('${doc.id}')">Excluir</button>
        </div>
       `;
    }
    
    div.innerHTML = `
      <h3>${data.nome}</h3>
      <div class="fichaRender">${conteudoExibicao}</div>
      ${acoesHtml}
    `;
    listaFichas.appendChild(div);
  });
}

/* PREPARAR EDIÇÃO DE FICHA EXISTENTE */
window.prepararEdicao = async function(id) {
  try {
    const doc = await db.collection("fichas").doc(id).get();
    if(doc.exists) {
      editingFichaId = id;
      document.getElementById("editorTitle").innerText = "Editar Ficha";
      document.getElementById("nomeFicha").value = doc.data().nome;
      descricaoEditor.innerHTML = doc.data().descricao;
      saveFichaBtn.innerText = "Salvar Alterações";
      showPage("editorPage");
    }
  } catch(err) {
    alert("Erro ao resgatar documento: " + err.message);
  }
};

/* EXCLUIR FICHA PERMANENTEMENTE */
window.deletarFicha = async function(id) {
  if(confirm("Tem certeza absoluta de que deseja excluir permanentemente esta ficha?")) {
    try {
      await db.collection("fichas").doc(id).delete();
      alert("Ficha excluída com sucesso.");
    } catch(err) {
      alert("Erro ao tentar excluir a ficha: " + err.message);
    }
  }
};

/* BUSCA DINÂMICA EM TEMPO REAL (CLIENT-SIDE) */
if(searchInput) {
  searchInput.oninput = () => {
    const filtro = searchInput.value.toLowerCase();
    document.querySelectorAll(".ficha").forEach(fichaElement => {
      const nome = fichaElement.querySelector("h3").innerText.toLowerCase();
      if(nome.includes(filtro)) {
        fichaElement.classList.remove("hidden");
      } else {
        fichaElement.classList.add("hidden");
      }
    });
  };
}

/* CADASTRO DE LOGINS (EXCLUSIVO DO CARGO MASTER - DENTRO DA SEÇÃO DE PERFIL) */
createAdminUserBtn.onclick = async () => {
  const nome = document.getElementById("newAdminNome").value.trim();
  const email = document.getElementById("newAdminEmail").value.trim();
  const senha = document.getElementById("newAdminSenha").value.trim();
  const cargo = document.getElementById("newAdminCargo").value;

  if(!nome || !email || !senha) {
    alert("Preencha todos os campos do formulário.");
    return;
  }

  try {
    createAdminUserBtn.disabled = true;
    createAdminUserBtn.innerText = "Registrando...";

    // Cria o login usando a instância isolada para não deslogar o Master atual
    const userCredential = await adminAuth.createUserWithEmailAndPassword(email, senha);
    const novoUid = userCredential.user.uid;

    // Vincula o nome e o cargo selecionado (Membro, Editor ou Master) ao documento do usuário
    await db.collection("usuarios").doc(novoUid).set({
      nome: nome,
      cargo: cargo,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Sucesso! Usuário '${nome}' cadastrado com o nível '${cargo}'.`);
    
    document.getElementById("newAdminNome").value = "";
    document.getElementById("newAdminEmail").value = "";
    document.getElementById("newAdminSenha").value = "";
    
    await adminAuth.signOut();

  } catch(err) {
    console.error(err);
    alert("Erro ao criar credencial: " + err.message);
  } finally {
    createAdminUserBtn.disabled = false;
    createAdminUserBtn.innerText = "Criar e Registrar Conta";
  }
};
