/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyBIDfCfu2rQR0jf5l-3WFIYkspD8DRi4-s",
  authDomain: "://firebaseapp.com",
  projectId: "driverpg-2c066",
  storageBucket: "driverpg-2c066.firebasestorage.app",
};

// Inicialização ultra segura: evita erros de carregamento e conflitos no CodePen/Vercel
let auth = null;
let db = null;
let adminAuth = null;

if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  auth = firebase.auth();
  db = firebase.firestore();

  // Inicializa o app secundário para cadastro sem deslogar o Master atual
  let adminApp;
  if (!firebase.apps.find(app => app.name === "AdminApp")) {
    adminApp = firebase.initializeApp(firebaseConfig, "AdminApp");
  } else {
    adminApp = firebase.app("AdminApp");
  }
  adminAuth = firebase.auth(adminApp);
} else {
  console.error("Firebase SDK não foi detectado. Certifique-se de que as ferramentas estão carregadas nas configurações do CodePen.");
}

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
let usuarioLogadoCargo = "Membro"; // Inicialização padrão de segurança

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

/* INTERCEPTADOR DE COLAGEM: PRESERVA 100% DA FORMATAÇÃO ORIGINAL (WORD, GOOGLE DOCS E IMAGENS COPIADAS) */
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
  if (!auth) {
    alert("O sistema do Firebase ainda está carregando no CodePen. Aguarde um segundo.");
    return;
  }

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
    if(auth) {
      await auth.signOut();
      location.reload();
    }
  };
}

/* OBSERVADOR DE AUTENTICAÇÃO (ROLES, INTERFACE E REGRAS DE CARGOS) */
if (auth) {
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
      let dadosUser = { nome: "Thiago", cargo: "Master" }; // Padrão caso o documento não exista no banco ainda

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

      // REGRAS DE VISIBILIDADE DA BARRA DE NAVEGAÇÃO:
      // Editores e Masters podem criar fichas
      if(usuarioLogadoCargo === "Master" || usuarioLogadoCargo === "Editor") {
        editorNav.classList.remove("hidden");
      } else {
        editorNav.classList.add("hidden"); // Membros apenas buscam e deslogam
      }

      // Caixa de criação de logins adicionada dentro do Perfil (Visível apenas para o Master)
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
}

/* CRIAR OU ATUALIZAR FICHA */
if(saveFichaBtn) {
  saveFichaBtn.onclick = async () => {
    if (!db) return;
    const nome = document.getElementById("nomeFicha").value.trim();
    const descricaoHTML = descricaoEditor.innerHTML;

    if(!nome || !descricaoHTML || descricaoHTML === "<br>" || descricaoHTML.trim() === ""){
      alert("Por favor, preencha o nome e o conteúdo da ficha.");
      return;
    }

    try {
      saveFichaBtn.disabled = true;
      
      if(editingFichaId) {
        // Modo Edição (Apenas Editor e Master)
        await db.collection("fichas").doc(editingFichaId).update({
          nome: nome,
          descricao: descricaoHTML,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Ficha atualizada com sucesso!");
      } else {
        // Modo Criação (Apenas Editor e Master)
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

/* ESCUTA E CARREGA O BANCO DE FICHAS EM TEMPO REAL */
let unsubscribeFichas = null;
function carregarFichas() {
  if(!db) return;
  if(unsubscribeFichas) unsubscribeFichas();

  unsubscribeFichas = db.collection("fichas").orderBy("criadoEm", "desc")
    .onSnapshot(snapshot => {
      renderizarFichas(snapshot.docs);
    }, err => console.error("Erro ao ler atualizações: ", err));
}

/* CONSTRÓI AS FICHAS NA TELA RESPEITANDO OS NÍVEIS DE PERMISSÃO */
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
    
    // REGRAS DE CARGO PARA EXIBIÇÃO DE CONTROLES:
    // Apenas Masters e Editores visualizam e operam as ações de Editar e Excluir
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
  if(!db) return;
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
  if(!db) return;
  if(confirm("Tem certeza de que deseja deletar permanentemente esta ficha?")) {
    try {
      await db.collection("fichas").doc(id).delete();
      alert("A ficha foi removida do sistema.");
    } catch(err) {
      alert("Não foi possível excluir o arquivo: " + err.message);
    }
  }
};

/* FILTRO DE PESQUISA EM TEMPO REAL */
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

/* CRIAÇÃO DE NOVOS LOGINS (EXCLUSIVO DO CARGO MASTER - DENTRO DO PERFIL) */
if(createAdminUserBtn) {
  createAdminUserBtn.onclick = async () => {
    if(!adminAuth || !db) {
      alert("O inicializador de contas administrativas falhou ou ainda não carregou.");
      return;
    }

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

      // Cria a credencial usando o app isolado para manter o Master logado na aba principal
      const userCredential = await adminAuth.createUserWithEmailAndPassword(email, senha);
      const novoUid = userCredential.user.uid;

      // Cria o documento de perfil na coleção 'usuarios' definindo o cargo (Membro, Editor ou Master)
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
