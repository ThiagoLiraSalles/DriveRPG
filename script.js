import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {

  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot

} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* FIREBASE */

const firebaseConfig = {

  apiKey: "AIzaSyATqtyD0eZqIhifLtDb5ADTzLND1x3ET8Q",

  authDomain: "drive---rpg.firebaseapp.com",

  projectId: "drive---rpg",

  storageBucket: "drive---rpg.firebasestorage.app",

  messagingSenderId: "348431071492",

  appId: "1:348431071492:web:7da94ae92eef37663ef851",

  measurementId: "G-22F2LSRY7D"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

/* VARIÁVEIS */

let usuarios = [];
let fichas = [];

let editandoId = null;

/* ELEMENTOS */

const loginScreen =
  document.getElementById("loginScreen");

const appScreen =
  document.getElementById("app");

const bottomNav =
  document.getElementById("bottomNav");

/* HELPERS */

function sessao(){

  try{

    return JSON.parse(
      localStorage.getItem("driveSession")
    );

  }catch{

    return null;
  }
}

function sanitizar(texto=""){

  return texto
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

/* USUÁRIOS */

async function carregarUsuarios(){

  usuarios = [];

  const snap = await getDocs(
    collection(db,"usuarios")
  );

  snap.forEach(docItem => {

    usuarios.push({

      id:docItem.id,

      ...docItem.data()
    });
  });
}

/* LOGIN */

window.login = async function(){

  try{

    await carregarUsuarios();

    const usuario =
      document
      .getElementById("loginUser")
      .value
      .trim();

    const senha =
      document
      .getElementById("loginPass")
      .value
      .trim();

    const encontrado =
      usuarios.find(user =>

        user.usuario === usuario &&
        user.senha === senha
      );

    if(!encontrado){

      alert(
        "Usuário ou senha incorretos."
      );

      return;
    }

    localStorage.setItem(

      "driveSession",

      JSON.stringify(encontrado)
    );

    iniciarSistema();

  }catch(err){

    console.error(err);

    alert(
      "Erro ao logar."
    );
  }
};

/* LOGOUT */

window.logout = function(){

  localStorage.removeItem(
    "driveSession"
  );

  loginScreen.style.display =
    "flex";

  appScreen.style.display =
    "none";

  bottomNav.innerHTML = "";
};

/* SISTEMA */

function criarNavbar(user){

  bottomNav.innerHTML = `

    <button onclick="trocarPagina('searchPage')">
      🔎
    </button>

    ${

      user.cargo === "master" ||
      user.cargo === "editor"

      ?

      `
        <button onclick="trocarPagina('fichasPage')">
          📝
        </button>
      `

      :

      ""
    }

    ${

      user.cargo === "master"

      ?

      `
        <button onclick="trocarPagina('adminPage')">
          ⚙️
        </button>
      `

      :

      ""
    }
  `;
}

window.trocarPagina = function(id){

  document
    .getElementById("searchPage")
    .style.display = "none";

  document
    .getElementById("fichasPage")
    .style.display = "none";

  document
    .getElementById("adminPage")
    .style.display = "none";

  document
    .getElementById(id)
    .style.display = "block";
};

async function iniciarSistema(){

  const user = sessao();

  if(!user){

    loginScreen.style.display =
      "flex";

    appScreen.style.display =
      "none";

    return;
  }

  loginScreen.style.display =
    "none";

  appScreen.style.display =
    "block";

  document
    .getElementById("userInfo")
    .innerHTML = `

      ${user.usuario}
      (${user.cargo})
    `;

  criarNavbar(user);

  iniciarRealtime();

  trocarPagina("searchPage");
}

/* REALTIME */

function iniciarRealtime(){

  onSnapshot(

    collection(db,"fichas"),

    snapshot => {

      fichas = [];

      snapshot.forEach(docItem => {

        fichas.push({

          id:docItem.id,

          ...docItem.data()
        });
      });

      renderizarFichas(fichas);
    }
  );
}

/* RENDER */

function renderizarFichas(lista){

  const cards =
    document.getElementById("cards");

  cards.innerHTML = "";

  const user = sessao();

  lista.forEach((ficha,index)=>{

    cards.innerHTML += `

      <div class="card">

        <h2>
          ${ficha.nome}
        </h2>

        <small>
          ${ficha.usuarios || "-"}
        </small>

        <p>

          ${

            sanitizar(
              ficha.descricao || "-"
            )
            .replace(/\\n/g,"<br>")
          }

        </p>

        ${

          user &&
          (
            user.cargo === "master" ||
            user.cargo === "editor"
          )

          ?

          `

            <div class="cardActions">

              <button
                onclick="editarFicha(${index})"
              >
                Editar
              </button>

              <button
                onclick="excluirFicha('${ficha.id}')"
              >
                Excluir
              </button>

            </div>

          `

          :

          ""
        }

      </div>
    `;
  });
}

/* SALVAR */

window.salvarFicha = async function(){

  try{

    const nome =
      document
      .getElementById("nome")
      .value
      .trim();

    const usuarios =
      document
      .getElementById("usuarios")
      .value
      .trim();

    const descricao =
      document
      .getElementById("descricao")
      .value
      .trim();

    if(!nome || !descricao){

      alert(
        "Preencha os campos."
      );

      return;
    }

    if(editandoId){

      await updateDoc(

        doc(
          db,
          "fichas",
          editandoId
        ),

        {
          nome,
          usuarios,
          descricao
        }
      );

    }else{

      await addDoc(

        collection(db,"fichas"),

        {
          nome,
          usuarios,
          descricao
        }
      );
    }

    document
      .getElementById("nome")
      .value = "";

    document
      .getElementById("usuarios")
      .value = "";

    document
      .getElementById("descricao")
      .value = "";

    editandoId = null;

    alert(
      "Ficha salva."
    );

  }catch(err){

    console.error(err);

    alert(
      "Erro ao salvar."
    );
  }
};

/* EDITAR */

window.editarFicha = function(index){

  const ficha =
    fichas[index];

  trocarPagina(
    "fichasPage"
  );

  document
    .getElementById("nome")
    .value = ficha.nome;

  document
    .getElementById("usuarios")
    .value = ficha.usuarios;

  document
    .getElementById("descricao")
    .value = ficha.descricao;

  editandoId =
    ficha.id;
};

/* EXCLUIR */

window.excluirFicha = async function(id){

  const confirmar =
    confirm(
      "Excluir ficha?"
    );

  if(!confirmar) return;

  try{

    await deleteDoc(

      doc(
        db,
        "fichas",
        id
      )
    );

    alert(
      "Ficha excluída."
    );

  }catch(err){

    console.error(err);

    alert(
      "Erro ao excluir."
    );
  }
};

/* CRIAR USUÁRIO */

window.criarUsuario = async function(){

  try{

    const usuario =
      document
      .getElementById("novoUsuario")
      .value
      .trim();

    const senha =
      document
      .getElementById("novaSenha")
      .value
      .trim();

    const cargo =
      document
      .getElementById("novoCargo")
      .value;

    if(!usuario || !senha){

      alert(
        "Preencha os campos."
      );

      return;
    }

    const existe =
      usuarios.find(user =>

        user.usuario
        .toLowerCase()

        ===

        usuario
        .toLowerCase()
      );

    if(existe){

      alert(
        "Usuário já existe."
      );

      return;
    }

    await addDoc(

      collection(db,"usuarios"),

      {
        usuario,
        senha,
        cargo
      }
    );

    await carregarUsuarios();

    alert(
      "Usuário criado."
    );

  }catch(err){

    console.error(err);

    alert(
      "Erro ao criar."
    );
  }
};

/* SEARCH */

document
  .getElementById("searchInput")
  .addEventListener(

    "input",

    ()=>{

      const termo =

        document
        .getElementById("searchInput")
        .value
        .toLowerCase();

      const filtradas =

        fichas.filter(ficha =>

          ficha.nome
          ?.toLowerCase()
          .includes(termo)

          ||

          ficha.descricao
          ?.toLowerCase()
          .includes(termo)

          ||

          ficha.usuarios
          ?.toLowerCase()
          .includes(termo)
        );

      renderizarFichas(
        filtradas
      );
    }
  );

/* INIT */

iniciarSistema();