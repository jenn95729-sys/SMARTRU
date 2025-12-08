/* ============================================================
   CONFIGURAÇÃO
============================================================ */

const API_BASE = "http://localhost:3000";
const DB_SESSION = "sq_session";

// se quiser deixar sempre em dev direto no código: mude para true
const DEV_FLAG_DEFAULT = false;

let usuarioAtual = null;
let pagamentoWatcher = null;

let ultimaRefeicao = null;
let ultimoValorRefeicao = null;

// foto de perfil temporária durante o cadastro (dataURL)
let fotoPerfilTemp = null;

/* ============================================================
   MODO DESENVOLVEDOR
   - Ativa/desativa pelo console:
   - enableDevMode()   -> permite usar o sistema fora do horário
   - disableDevMode()  -> volta ao modo normal
============================================================ */

function isDevMode(){
    const stored = localStorage.getItem("sq_dev_mode");
    if(stored === "1") return true;
    if(stored === "0") return false;
    return DEV_FLAG_DEFAULT;
}

function enableDevMode(){
    localStorage.setItem("sq_dev_mode", "1");
    const campo = document.getElementById("campoRefeicaoDev");
    if (campo) campo.style.display = "block";
    atualizarRefeicaoDevDisponivel();
    alert("Modo desenvolvedor ativado. O sistema funcionará mesmo fora do horário.");
}

function disableDevMode(){
    localStorage.setItem("sq_dev_mode", "0");
    const campo = document.getElementById("campoRefeicaoDev");
    if (campo) campo.style.display = "none";
    alert("Modo desenvolvedor desativado. Horários normais serão respeitados.");
}

/* ============================================================
   CONTROLE DE TELAS
============================================================ */

function abrirTela(id){
    document.querySelectorAll(".tela").forEach(t => t.style.display="none");
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
}

function voltarPrincipal(){
    if(usuarioAtual) abrirTela("tela-home");
    else abrirTela("tela-login");
}

/* ============================================================
   SESSION EM LOCALSTORAGE
============================================================ */

function getSession(){
    const s = localStorage.getItem(DB_SESSION);
    return s ? JSON.parse(s) : null;
}

function setSession(sess){
    localStorage.setItem(DB_SESSION, JSON.stringify(sess));
}

/* ============================================================
   AVATAR
============================================================ */

function atualizarAvatar(){
    const avatar = document.getElementById("avatar-usuario");
    if (!avatar) return;

    if (usuarioAtual && usuarioAtual.fotoPerfil){
        avatar.src = usuarioAtual.fotoPerfil;
        avatar.style.display = "inline-block";
    } else {
        avatar.style.display = "none";
    }
}

/* ============================================================
   INICIALIZAÇÃO
============================================================ */

window.onload = () => {
    const sessao = getSession();

    if(sessao){
        usuarioAtual = sessao;
        const menu = document.getElementById("menu-usuario");
        if (menu) menu.style.display = "flex";

        const spanNome = document.getElementById("nome-usuario");
        if (spanNome) spanNome.textContent = usuarioAtual.nome;

        atualizarAvatar();
        abrirTela("tela-home");
    } else {
        abrirTela("tela-login");
    }

    configurarMenuUsuario();

    const catSel = document.getElementById("cadCategoria");
    if(catSel){
        catSel.addEventListener("change", atualizarInfoCafeCadastro);
        atualizarInfoCafeCadastro();
    }

    const nomeInput = document.getElementById("cadNome");
    if(nomeInput){
        nomeInput.addEventListener("input", (e) => {
            // remove números enquanto digita
            e.target.value = e.target.value.replace(/[0-9]/g, "");
        });
    }

    // bloquear letras em matrícula / SIAPE (login)
    const loginIdInput = document.getElementById("loginId");
    if (loginIdInput){
        loginIdInput.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/\D/g, "");
        });
    }

    // bloquear letras em matrícula / SIAPE (cadastro)
    const cadIdInput = document.getElementById("cadId");
    if (cadIdInput){
        cadIdInput.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/\D/g, "");
        });
    }

    // upload de foto de perfil
    const fotoInput = document.getElementById("cadFoto");
    const previewContainer = document.getElementById("previewFotoContainer");
    const previewImg = document.getElementById("previewFoto");

    if (fotoInput && previewContainer && previewImg) {
        fotoInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) {
                fotoPerfilTemp = null;
                previewContainer.style.display = "none";
                return;
            }
            if (!file.type.startsWith("image/")) {
                alert("Envie apenas arquivos de imagem.");
                fotoInput.value = "";
                fotoPerfilTemp = null;
                previewContainer.style.display = "none";
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                fotoPerfilTemp = reader.result; // dataURL
                previewImg.src = fotoPerfilTemp;
                previewContainer.style.display = "block";
            };
            reader.readAsDataURL(file);
        });
    }

    // mostrar seletor de refeição só em modo desenvolvedor
    const campoRefeicaoDev = document.getElementById("campoRefeicaoDev");
    if (campoRefeicaoDev && isDevMode()) {
        campoRefeicaoDev.style.display = "block";
    }

    atualizarRefeicaoDevDisponivel();
};

/* ============================================================
   LOGIN
============================================================ */

function login(){
    const input = document.getElementById("loginId");
    if (!input){
        alert("Campo de matrícula não encontrado.");
        return;
    }
    const id = input.value.trim();

    if(!id){
        alert("Informe sua matrícula.");
        return;
    }

    if(!/^\d+$/.test(id)){
        alert("A matrícula/SIAPE deve conter apenas números.");
        return;
    }

    const sessao = getSession();
    if(sessao && sessao.id === id){
        usuarioAtual = sessao;

        const menu = document.getElementById("menu-usuario");
        if (menu) menu.style.display = "flex";

        const spanNome = document.getElementById("nome-usuario");
        if (spanNome) spanNome.textContent = usuarioAtual.nome;

        atualizarAvatar();
        atualizarRefeicaoDevDisponivel();
        abrirTela("tela-home");
        return;
    }

    alert("ID ainda não cadastrado neste navegador. Crie um cadastro.");
}

/* ============================================================
   CADASTRO
============================================================ */

function atualizarInfoCafeCadastro(){
    const info = document.getElementById("infoCafeCadastro");
    const sel  = document.getElementById("cadCategoria");
    const campoMatricula = document.getElementById("campoMatricula");
    const campoFotoPerfil = document.getElementById("campoFotoPerfil");
    const cadId = document.getElementById("cadId");

    if(!info || !sel || !campoMatricula || !campoFotoPerfil) return;

    const val = sel.value;
    if(!val){
        info.textContent = "";
        campoMatricula.style.display = "block";
        campoFotoPerfil.style.display = "block";
        return;
    }

    const categoriaNome = val.split("|")[0];

    if (categoriaNome === "Visitante") {
        // visitante: sem matrícula, sem foto
        campoMatricula.style.display = "none";
        campoFotoPerfil.style.display = "none";
        if (cadId) cadId.value = "";
        info.textContent = "Visitantes não precisam informar matrícula ou SIAPE.";
        return;
    } else {
        campoMatricula.style.display = "block";
        campoFotoPerfil.style.display = "block";
    }

    if(categoriaNome.startsWith("FUMP")){
        info.textContent =
            "Você terá direito ao café da manhã sem cobrança, nos RUs que oferecem essa refeição.";
    } else {
        info.textContent =
            "O café da manhã é destinado apenas a estudantes atendidos pela FUMP.";
    }
}

function nomeEhValido(nome){
    const partes = nome.trim().split(/\s+/).filter(p => p.length > 0);
    if(partes.length < 2) return false;

    for(const p of partes){
        if(!/^[A-Za-zÀ-ÖØ-öø-ÿ]{2,}$/.test(p)){
            return false;
        }
    }
    return true;
}

function salvarCadastro(){
    const nomeInput = document.getElementById("cadNome");
    const idInput   = document.getElementById("cadId");
    const catSel    = document.getElementById("cadCategoria");

    let nome         = nomeInput ? nomeInput.value.trim() : "";
    let id           = idInput ? idInput.value.trim() : "";
    let categoriaRAW = catSel ? catSel.value : "";

    if(!nomeEhValido(nome)){
        alert("Informe um nome completo válido (nome e sobrenome, apenas letras).");
        return;
    }

    if(!categoriaRAW){
        alert("Preencha a categoria.");
        return;
    }

    if(id && !/^\d+$/.test(id)){
        alert("A matrícula/SIAPE deve conter apenas números.");
        return;
    }

    let [categoria, preco] = categoriaRAW.split("|");
    preco = parseFloat(preco);

    if(!id && categoria !== "Visitante"){
        alert("Se você não informar matrícula/SIAPE, selecione a categoria Visitante.");
        return;
    }

    if(!id && categoria === "Visitante"){
        // visitante: ID interno qualquer, não será usado pra login
        id = String(Date.now());
    }

    usuarioAtual = {
        id,
        nome,
        categoria,
        preco,
        ticket: null,
        refeicao: null,
        valorRefeicao: null,
        ru: null,
        fotoPerfil: fotoPerfilTemp || null
    };

    setSession(usuarioAtual);

    const menu = document.getElementById("menu-usuario");
    if (menu) menu.style.display = "flex";

    const spanNome = document.getElementById("nome-usuario");
    if (spanNome) spanNome.textContent = usuarioAtual.nome;

    atualizarAvatar();
    atualizarRefeicaoDevDisponivel();
    abrirTela("tela-home");
}

/* ============================================================
   UTILITÁRIO FUMP
============================================================ */

function isUsuarioFump(){
    return (
        usuarioAtual &&
        usuarioAtual.categoria &&
        usuarioAtual.categoria.startsWith("FUMP")
    );
}

function atualizarRefeicaoDevDisponivel(){
    const refeicaoDevSel = document.getElementById("refeicaoDev");
    if (!refeicaoDevSel) return;

    const fump = isUsuarioFump();

    for (const opt of refeicaoDevSel.options) {
        if (opt.value === "cafe") {
            opt.disabled = !fump;
        }
    }
}

/* ============================================================
   PERFIL
============================================================ */

function abrirTelaPerfil(){
    if (!usuarioAtual){
        alert("Faça login ou cadastro.");
        abrirTela("tela-login");
        return;
    }

    const nomeSpan      = document.getElementById("perfil_nome");
    const idSpan        = document.getElementById("perfil_id");
    const catSpan       = document.getElementById("perfil_categoria");
    const refSpan       = document.getElementById("perfil_refeicao");
    const fotoContainer = document.getElementById("perfil_foto_container");
    const fotoImg       = document.getElementById("perfil_foto");

    if (nomeSpan) nomeSpan.textContent = usuarioAtual.nome || "-";

    let idTexto = "-";
    if (usuarioAtual.categoria && usuarioAtual.categoria.startsWith("Visitante")){
        idTexto = "Visitante (sem matrícula)";
    } else if (usuarioAtual.id) {
        idTexto = usuarioAtual.id;
    }
    if (idSpan) idSpan.textContent = idTexto;

    if (catSpan) catSpan.textContent = usuarioAtual.categoria || "-";

    const refMap = {
        cafe: "Café da manhã",
        almoco: "Almoço",
        jantar: "Jantar"
    };
    if (refSpan){
        refSpan.textContent = refMap[usuarioAtual.refeicao] || "Nenhuma refeição registrada nesta sessão";
    }

    if (fotoContainer && fotoImg){
        if (usuarioAtual.fotoPerfil){
            fotoImg.src = usuarioAtual.fotoPerfil;
            fotoContainer.style.display = "block";
        } else {
            fotoContainer.style.display = "none";
        }
    }

    abrirTela("tela-perfil");
}

/* ============================================================
   HORÁRIOS POR RU / REFEIÇÃO
   - Aos sábados: apenas RU Setorial I e RU Saúde, e só ALMOÇO.
============================================================ */

function obterJanelaHorario(ru, refeicao){
    const agora = new Date();
    const diaSemana = agora.getDay(); // 0 dom, 6 sáb
    const sabado = (diaSemana === 6);

    const h = (hi, mi, hf, mf) => ({
        inicio: hi * 60 + mi,
        fim: hf * 60 + mf
    });

    // SÁBADO: apenas almoço no Setorial I e Saúde
    if(sabado){
        if(refeicao !== "almoco") return null;

        switch(ru){
            case "setorial1":
                return h(11, 0, 13, 0);
            case "saude":
                return h(11, 30, 13, 0);
            default:
                return null;
        }
    }

    // DIAS NORMAIS (segunda a sexta)
    switch(ru){
        case "setorial1":
            if(refeicao === "cafe") return null;
            if(refeicao === "almoco"){
                return h(10, 30, 14, 0);
            }
            if(refeicao === "jantar"){
                return h(17, 10, 19, 0);
            }
            break;

        case "setorial2":
            if(refeicao === "cafe"){
                return h(6, 45, 8, 0);
            }
            if(refeicao === "almoco"){
                return h(10, 30, 14, 0);
            }
            if(refeicao === "jantar"){
                return null;
            }
            break;

        case "saude":
            if(refeicao === "cafe"){
                return h(7, 0, 8, 0);
            }
            if(refeicao === "almoco"){
                return h(10, 30, 14, 0);
            }
            if(refeicao === "jantar"){
                return h(17, 10, 19, 0);
            }
            break;

        case "direito":
            if(refeicao === "cafe"){
                return h(7, 0, 8, 0);
            }
            if(refeicao === "almoco"){
                return h(11, 0, 14, 0);
            }
            if(refeicao === "jantar"){
                return h(17, 30, 19, 0);
            }
            break;
    }

    return null;
}

function checarHorarioRefeicao(ru, refeicao){
    const janela = obterJanelaHorario(ru, refeicao);
    if(!janela) return false;

    const agora = new Date();
    const minutos = agora.getHours() * 60 + agora.getMinutes();

    return (minutos >= janela.inicio && minutos <= janela.fim);
}

function detectarRefeicaoAtual(ru){
    const opcoes = ["cafe", "almoco", "jantar"];

    for(const r of opcoes){
        if(checarHorarioRefeicao(ru, r)){
            return r;
        }
    }

    return null;
}

function haAlgumRuAbertoAgora(){
    const rus = ["setorial1", "setorial2", "saude", "direito"];
    for(const ru of rus){
        if(detectarRefeicaoAtual(ru)){
            return true;
        }
    }
    return false;
}

function garantirHorarioAbertoOuHorarios(){
    if(isDevMode()) return true;

    if(haAlgumRuAbertoAgora()) return true;

    alert("No momento nenhum Restaurante Universitário está em funcionamento. Consulte os horários de atendimento.");
    abrirTela("tela-horarios");
    return false;
}

/* ============================================================
   ABERTURA DA TELA DE PAGAMENTO (bloqueia se fechado)
============================================================ */

function abrirTelaPagamento(){
    if(!usuarioAtual){
        alert("Faça login ou cadastro.");
        abrirTela("tela-login");
        return;
    }

    if(!garantirHorarioAbertoOuHorarios()) return;

    abrirTela("tela-status");
    atualizarStatusTela();
}

/* ============================================================
   STATUS VISUAL
============================================================ */

async function atualizarStatusTela(){
    if(!usuarioAtual) return;

    const nomeEl = document.getElementById("st_nome");
    const catEl  = document.getElementById("st_categoria");
    const precoEl = document.getElementById("st_preco");
    const ticketEl = document.getElementById("st_ticket");
    const pagEl = document.getElementById("st_pagamento");

    if (nomeEl) nomeEl.textContent = usuarioAtual.nome;
    if (catEl)  catEl.textContent  = usuarioAtual.categoria || "-";

    const valor = usuarioAtual.valorRefeicao != null
        ? usuarioAtual.valorRefeicao
        : usuarioAtual.preco;

    if (precoEl) {
        precoEl.textContent = valor != null ? "R$ " + valor.toFixed(2) : "-";
    }

    if (ticketEl) ticketEl.textContent = usuarioAtual.ticket || "—";

    let statusPag = "Não gerado";
    if(usuarioAtual.ticket){
        try {
            const res = await fetch(`${API_BASE}/api/status/${usuarioAtual.ticket}`);
            const data = await res.json();
            statusPag = data.pago ? "Pago" : "Pendente";
        } catch(e){
            console.error(e);
            statusPag = "Erro ao consultar";
        }
    }
    if (pagEl) pagEl.textContent = statusPag;
}

/* ============================================================
   FLUXO AUTOMÁTICO APÓS PAGAMENTO
============================================================ */

async function onPagamentoConfirmado(){
    if (pagamentoWatcher) {
        clearInterval(pagamentoWatcher);
        pagamentoWatcher = null;
    }

    await atualizarStatusTela();

    alert("Pagamento confirmado! Seu QR-CODE de acesso ao RU foi liberado.");

    gerarQRCode();
}

/* ============================================================
   PAGAMENTO PIX (sem fila)
============================================================ */

async function pagarPix(){
    if(!usuarioAtual){
        alert("Faça login ou cadastro.");
        return;
    }

    const ruSelect = document.getElementById("ruSelecionado");
    const ru = ruSelect ? ruSelect.value : "";
    if(!ru){
        alert("Selecione a unidade do RU.");
        return;
    }

    // refeição: se estiver em modo dev e tiver seleção manual, usa ela; senão, detecta pelo horário
    let refeicao = null;

    const refeicaoDevSel = document.getElementById("refeicaoDev");
    if (isDevMode() && refeicaoDevSel && refeicaoDevSel.value) {
        // força refeição escolhida para teste
        refeicao = refeicaoDevSel.value; // "cafe", "almoco" ou "jantar"
    } else {
        // comportamento normal: detecta pelo horário e RU
        refeicao = detectarRefeicaoAtual(ru);
    }

    if(!refeicao){
        if(isDevMode()){
            // fallback: se mesmo assim não tiver nada, simula almoço
            refeicao = "almoco";
        } else {
            alert("No momento o RU selecionado está fechado. Consulte os horários de funcionamento.");
            abrirTela("tela-horarios");
            return;
        }
    }

    let valor = usuarioAtual.preco;
    const fump = isUsuarioFump();

    if(refeicao === "cafe"){
        if(!fump){
            alert("O café da manhã é exclusivo para estudantes atendidos pela FUMP (níveis I, II e III).");
            abrirTela("tela-horarios");
            return;
        } else {
            // café da manhã para FUMP: gratuito
            valor = 0;
        }
    }

    // guarda infos
    ultimaRefeicao = refeicao;
    ultimoValorRefeicao = valor;
    usuarioAtual.refeicao = refeicao;
    usuarioAtual.valorRefeicao = valor;
    usuarioAtual.ru = ru;
    setSession(usuarioAtual);

    // cria ticket se ainda não existir
    if(!usuarioAtual.ticket){
        try {
            const resTicket = await fetch(`${API_BASE}/api/ticket`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nome: usuarioAtual.nome,
                    id: usuarioAtual.categoria === "Visitante" ? null : usuarioAtual.id,
                    categoria: usuarioAtual.categoria,
                    preco: valor,
                    ru,
                    refeicao,
                    fotoPerfil: usuarioAtual.fotoPerfil || null
                })
            });

            const dataTicket = await resTicket.json();
            usuarioAtual.ticket = dataTicket.ticket;
            setSession(usuarioAtual);
        } catch(e){
            console.error(e);
            alert("Erro ao criar pedido. Tente novamente.");
            return;
        }
    }

    // SE VALOR FOR 0, NÃO GERAR QR PIX
    if (valor <= 0){
        try {
            // marca como pago no backend reaproveitando o endpoint de simulação
            await fetch(`${API_BASE}/api/simular-pago`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticket: usuarioAtual.ticket })
            });
        } catch(e){
            console.error(e);
            alert("Erro ao confirmar a refeição gratuita. Tente novamente.");
            return;
        }

        await onPagamentoConfirmado();
        return; // não gera PIX
    }

    // fluxo normal: refeição paga -> gera PIX
    const res = await fetch(`${API_BASE}/api/pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: usuarioAtual.ticket })
    });

    const data = await res.json();

    const pixArea = document.getElementById("pixArea");
    if (pixArea) pixArea.style.display = "block";

    const pixDiv = document.getElementById("pix-qrcode");
    if (pixDiv){
        pixDiv.innerHTML = "";
        new QRCode(pixDiv, {
            text: data.payload,
            width: 220,
            height: 220,
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    const copiaCola = document.getElementById("pix-copia-cola");
    if (copiaCola) copiaCola.value = data.payload;

    await atualizarStatusTela();

    if (pagamentoWatcher) clearInterval(pagamentoWatcher);

    pagamentoWatcher = setInterval(async () => {
        try {
            const resp = await fetch(`${API_BASE}/api/status/${usuarioAtual.ticket}`);
            const st = await resp.json();
            if (st.pago) await onPagamentoConfirmado();
        } catch (e) {
            console.error("Erro ao checar status do pagamento:", e);
        }
    }, 4000);
}

async function simularPagamento(){
    if(!usuarioAtual || !usuarioAtual.ticket){
        alert("Nenhum pagamento em andamento.");
        return;
    }

    await fetch(`${API_BASE}/api/simular-pago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: usuarioAtual.ticket })
    });

    await onPagamentoConfirmado();
}

/* ============================================================
   QR-CODE DE ACESSO AO RU (só se pago e dentro de horário)
============================================================ */

async function gerarQRCode(){
    if(!usuarioAtual || !usuarioAtual.ticket){
        alert("Nenhum pagamento encontrado para este usuário.");
        return;
    }

    // se tivermos RU salvo, checa se RU está aberto agora (exceto no modo dev)
    if(usuarioAtual.ru && !isDevMode()){
        const refeicaoAgora = detectarRefeicaoAtual(usuarioAtual.ru);
        if(!refeicaoAgora){
            alert("No momento o RU está fechado. Consulte os horários antes de acessar o QR Code.");
            abrirTela("tela-horarios");
            return;
        }
    }

    const res = await fetch(`${API_BASE}/api/status/${usuarioAtual.ticket}`);
    const data = await res.json();

    if(!data.pago){
        alert("Pagamento ainda não confirmado. Pague via PIX antes de gerar o QR-CODE do RU.");
        return;
    }

    abrirTela("tela-qrcode");

    const div = document.getElementById("qrcode");
    if (div) div.innerHTML = "";

    const payload = "SQRU|" + usuarioAtual.ticket;

    const qrNome = document.getElementById("qr_nome");
    const qrCat  = document.getElementById("qr_categoria");
    const qrPreco = document.getElementById("qr_preco");

    if (qrNome)  qrNome.textContent  = usuarioAtual.nome;
    if (qrCat)   qrCat.textContent   = usuarioAtual.categoria || "-";
    if (qrPreco) {
        const v = usuarioAtual.valorRefeicao != null
            ? usuarioAtual.valorRefeicao
            : (usuarioAtual.preco != null ? usuarioAtual.preco : null);
        qrPreco.textContent = (v != null) ? "R$ " + v.toFixed(2) : "-";
    }

    // foto de perfil no QR (se houver)
    const fotoContainer = document.getElementById("qr_foto_container");
    const fotoImg = document.getElementById("qr_foto");
    if (fotoContainer && fotoImg) {
        if (usuarioAtual.fotoPerfil) {
            fotoImg.src = usuarioAtual.fotoPerfil;
            fotoContainer.style.display = "block";
        } else {
            fotoContainer.style.display = "none";
        }
    }

    if (div){
        new QRCode(div, {
            text: payload,
            width: 280,
            height: 280,
            correctLevel: QRCode.CorrectLevel.L
        });
    }
}

function abrirQRCode(){
    if(!usuarioAtual){
        alert("Faça login ou cadastro.");
        abrirTela("tela-login");
        return;
    }

    if(!isDevMode() && !haAlgumRuAbertoAgora()){
        alert("No momento nenhum Restaurante Universitário está em funcionamento. Consulte os horários de atendimento.");
        abrirTela("tela-horarios");
        return;
    }

    gerarQRCode();
}

/* ============================================================
   LOGOUT
============================================================ */

function logout(){
    usuarioAtual = null;
    if (pagamentoWatcher) {
        clearInterval(pagamentoWatcher);
        pagamentoWatcher = null;
    }
    localStorage.removeItem(DB_SESSION);
    const menu = document.getElementById("menu-usuario");
    if (menu) menu.style.display = "none";
    atualizarAvatar();
    abrirTela("tela-login");
}

/* ============================================================
   MENU SUPERIOR
============================================================ */

function configurarMenuUsuario(){
    const menu = document.getElementById("menu-usuario");
    if (!menu) return;

    menu.addEventListener("click", (e)=>{
        e.stopPropagation();
        menu.classList.toggle("menu-aberto");
    });

    document.addEventListener("click", ()=>{
        menu.classList.remove("menu-aberto");
    });
}
