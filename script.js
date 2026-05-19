/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyBIDfCfu2rQR0jf5l-3WFIYkspD8DRi4-s",
  authDomain: "://firebaseapp.com",
  projectId: "driverpg-2c066",
  storageBucket: "driverpg-2c066.firebasestorage.app",
};

// Inicializa o app principal diretamente (Padrão de Produção para Vercel)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Inicializa o app secundário de forma limpa
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
let usuarioLogadoCargo = "Membro"; 

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

/* INTERCEPTADOR DE COLAGEM (COPIA FORMATAÇÃO DO WORD/GOOGLE DOCS) */
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

if(loginBtn) {
  loginBtn.onclick = login;
}

if(logoutBtn) {
  logoutBtn.onclick = async () => {
    await auth.signOut();
    location.reload();
  };
}

/* OBSERVADOR DE AUTENTICAÇÃO (ROLES E PERMISSÕES) */
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
    let dadosUser = { nome: "Thiago", cargo: "Master" }; 

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

    if(usuarioLogadoCargo === "Master" || usuarioLogadoCargo === "Editor") {
      editorNav.classList.remove("hidden");
    } else {
      editorNav.classList.add("hidden"); 
    }

    if(usuarioLogadoCargo === "Master") {
      masterAdminBox.classList.remove("hidden");
    } else {
      masterAdminBox.classList.add("hidden");
    }

    showPage("searchPage");
    carregarFichas();

  } catch(err) {
    console.error("Erro ao processar dados de acesso: ", err);
  }
});

/* CRIAR OU ATUALIZAR FICHA */
if(saveFichaBtn) {
  saveFichaBtn.onclick = async () => {
    const nome = document.getElementById("nomeFicha").value.trim();
    const descricaoHTML = descricaoEditor.innerHTML;

    if(!nome || !descricaoHTML || descricaoHTML === "<br>" || descricaoHTML.trim() === ""){
      alert("Por favor, preencha o nome e o conteúdo da ficha.");
      return;
    }

    try {
      saveFichaBtn.disabled = true;
      
      if(editingFichaId) {
        await db.collection("fichas").doc(editingFichaId).update({
          nome: nome,
          descricao: descricaoHTML,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Ficha atualizada com sucesso!");
      } else {
        await db.collection("fichas").add({
          nome: nome,
          descricao: descricaoHTML,
          criadoPor: auth.currentUser.uid,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Ficha criada com sucesso!");
      }

      limparFormularioFicha();
      showPage("searchPage");
    } catch(err) {
      alert("Erro ao tentar salvar os dados: " + err.message);
    } finally {
      saveFichaBtn.disabled = false;
    }
  };
}

function limparFormularioFicha() {
  editingFichaId = null;
  document.getElementById("editorTitle").innerText = "Criar Ficha";
  document.getElementById("nomeFicha").value = "";
  descricaoEditor.innerHTML = "";
  saveFichaBtn.innerText = "Salvar Ficha";
}

/* CARREGA AS FICHAS EM TEMPO REAL */
let unsubscribeFichas = null;
function carregarFichas() {
  if(unsubscribeFichas) unsubscribeFichas();

  unsubscribeFichas = db.collection("fichas").orderBy("criadoEm", "desc")
    .onSnapshot(snapshot => {
      renderizarFichas(snapshot.docs);
    }, err => console.error("Erro ao ler atualizações: ", err));
}

/* RENDERIZAR FICHAS COM BOTÕES POR CARGO */
function renderizarFichas(docs) {
  if(!listaFichas) return;
  listaFichas.innerHTML = "";
  
  if(docs.length === 0) {
    listaFichas.innerHTML = "<p style='opacity:0.5;text-align:center;'>Nenhuma ficha cadastrada na mesa.</p>";
    return;
  }

  docs.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");
    div.className = "ficha";
    
    const conteudoExibicao = data.descricao.includes("<") ? data.descricao : data.descricao.replace(/\n/g, "<br>");
    let acoesHtml = "";
    
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

/* CARREGA OS DADOS NO FORMULÁRIO DO EDITOR */
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
    alert("Erro ao buscar dados da ficha: " + err.message);
  }
};

/* DELETAR FICHA (EDITOR E MASTER) */
window.deletarFicha = async function(id) {
  if(confirm("Tem certeza de que deseja deletar permanentemente esta ficha?")) {
    try {
      await db.collection("fichas").doc(id).delete();
      alert("A ficha foi removida do sistema.");
    } catch(err) {
      alert("Não foi possível excluir o arquivo: " + err.message);
    }
  }
};

/* FILTRO DE PESQUISA */
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

/* CRIAÇÃO DE LOGINS (EXCLUSIVO MASTER) */
if(createAdminUserBtn) {
  createAdminUserBtn.onclick = async () => {
    const nome = document.getElementById("newAdminNome").value.trim();
    const email = document.getElementById("newAdminEmail").value.trim();
    const senha = document.getElementById("newAdminSenha").value.trim();
    const cargo = document.getElementById("newAdminCargo").value;

    if(!nome || !email || !senha) {
      alert("Por favor, preencha todos os campos de cadastro.");
      return;
    }

    try {
      createAdminUserBtn.disabled = true;
      createAdminUserBtn.innerText = "Criando...";

      const userCredential = await adminAuth.createUserWithEmailAndPassword(email, senha);
      const novoUid = userCredential.user.uid;

      await db.collection("usuarios").doc(novoUid).set({
        nome: nome,
        cargo: cargo,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert(`Sucesso! Conta de '${nome}' registrada com nível de acesso '${cargo}'.`);
      
      document.getElementById("newAdminNome").value = "";
      document.getElementById("newAdminEmail").value = "";
      document.getElementById("newAdminSenha").value = "";
      
      await adminAuth.signOut();

    } catch(err) {
      console.error(err);
      alert("Erro ao tentar registrar o usuário: " + err.message);
    } finally {
      createAdminUserBtn.disabled = false;
      createAdminUserBtn.innerText = "Criar e Registrar Conta";
    }
  };
}