
/* ==========================================
   SMARTTRACTOR
   Dashboard + Operação + Configurações
========================================== */

// ==========================================
// ELEMENTOS HTML
// ==========================================

const $ = (id) => document.getElementById(id);

const operationSelect = $("operationSelect");

const speedElement = $("speed");
const rpmElement = $("rpm");
const temperatureElement = $("temperature");
const areaElement = $("area");

const scoreElement = $("score");
const scoreStatus = $("scoreStatus");
const scoreDescription = $("scoreDescription");
const scoreCircle = $("scoreCircle");

const analysisText = $("analysisText");
const recommendationText = $("recommendationText");

const alertsContainer = $("alerts");
const alertCount = $("alertCount");

const dataSource = $("dataSource");
const channelIdInput = $("channelId");
const readApiKeyInput = $("readApiKey");

const testConnectionButton = $("testConnection");
const clearConnectionButton = $("clearConnection");

const connectionStatus = $("connectionStatus");
const connectionMessage = $("connectionMessage");
const lastUpdateElement = $("lastUpdate");

const dashboardSource = $("dashboardSource");
const systemStatus = $("systemStatus");

// ==========================================
// ESTADO DO SISTEMA
// ==========================================

const DADOS_INICIAIS_SIMULADOS = {
    speed: 6.8,
    rpm: 1850,
    temperature: 82,
    area: 12.4
};

let speed = DADOS_INICIAIS_SIMULADOS.speed;
let rpm = DADOS_INICIAIS_SIMULADOS.rpm;
let temperature = DADOS_INICIAIS_SIMULADOS.temperature;
let area = DADOS_INICIAIS_SIMULADOS.area;

let simulationTimer = null;
let thingspeakTimer = null;
let requestInProgress = false;
let chartValues = [];

const THINGSPEAK_INTERVAL = 15000;

// ==========================================
// CONFIGURAÇÃO DAS OPERAÇÕES
// ==========================================

const operations = {
    plantio: {
        name: "Plantio",
        minSpeed: 5.5,
        maxSpeed: 7.0,
        minRPM: 1600,
        maxRPM: 2000,
        recommendation:
            "Mantenha a velocidade dentro da faixa configurada, considerando as condições do solo, da máquina e do implemento."
    },

    pulverizacao: {
        name: "Pulverização",
        minSpeed: 5.0,
        maxSpeed: 8.0,
        minRPM: 1500,
        maxRPM: 1900,
        recommendation:
            "Procure manter velocidade constante, respeitando as condições de aplicação e as orientações do fabricante."
    },

    solo: {
        name: "Preparo do solo",
        minSpeed: 4.0,
        maxSpeed: 7.0,
        minRPM: 1700,
        maxRPM: 2200,
        recommendation:
            "Acompanhe a relação entre velocidade e rotação, considerando a profundidade e a resistência do solo."
    },

    fertilizante: {
        name: "Distribuição de fertilizante",
        minSpeed: 5.0,
        maxSpeed: 8.0,
        minRPM: 1600,
        maxRPM: 2000,
        recommendation:
            "Procure manter velocidade estável e conferir a regulagem do distribuidor."
    }
};

const operationCodes = {
    1: "plantio",
    2: "pulverizacao",
    3: "solo",
    4: "fertilizante"
};

// ==========================================
// NAVEGAÇÃO ENTRE ABAS
// ==========================================

const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const target = button.dataset.tab;

        tabButtons.forEach((item) => {
            item.classList.toggle("active", item === button);
        });

        tabContents.forEach((content) => {
            content.classList.toggle("active", content.id === target);
        });
    });
});

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function obterOperacao() {
    return operations[operationSelect.value] || operations.plantio;
}

function numeroValido(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return null;
    }

    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
}

function atualizarHorario(data = new Date()) {
    lastUpdateElement.textContent = data.toLocaleString("pt-BR");
}

function definirStatus(tipo, mensagem) {
    connectionStatus.className = "connection-badge " + tipo;

    if (tipo === "connected") {
        connectionStatus.textContent = "Conectado";
        systemStatus.textContent = "ThingSpeak conectado";
        dashboardSource.textContent = "Dados do ThingSpeak";

    } else if (tipo === "error") {
        connectionStatus.textContent = "Erro de conexão";
        systemStatus.textContent = "Verificar conexão";
        dashboardSource.textContent = "Falha na leitura";

    } else {
        connectionStatus.textContent = "Modo simulado";
        systemStatus.textContent = "Sistema em funcionamento";
        dashboardSource.textContent = "Dados simulados";
    }

    connectionMessage.textContent = mensagem;
}

function pararTemporizadores() {
    if (simulationTimer !== null) {
        clearInterval(simulationTimer);
        simulationTimer = null;
    }

    if (thingspeakTimer !== null) {
        clearInterval(thingspeakTimer);
        thingspeakTimer = null;
    }
}

// ==========================================
// ATUALIZAÇÃO DOS INDICADORES
// ==========================================

function atualizarIndicadores() {
    speedElement.textContent = speed.toFixed(1);
    rpmElement.textContent = Math.round(rpm);
    temperatureElement.textContent = temperature.toFixed(1);
    areaElement.textContent = area.toFixed(2);

    atualizarGrafico();
    atualizarAnalise();
}

// ==========================================
// GRÁFICO DE VELOCIDADE
// ==========================================

function atualizarGrafico() {
    const speedLine = $("speedLine");

    if (!speedLine) return;

    chartValues.push(speed);

    if (chartValues.length > 12) {
        chartValues.shift();
    }

    const largura = 570;
    const altura = 170;
    const margem = 15;

    const pontos = chartValues.map((valor, indice) => {
        const x = margem +
            (indice * (largura - margem * 2)) /
            Math.max(chartValues.length - 1, 1);

        const valorLimitado = Math.max(0, Math.min(12, valor));

        const y = altura - margem -
            (valorLimitado / 12) * (altura - margem * 2);

        return `${x},${y}`;
    });

    speedLine.setAttribute("points", pontos.join(" "));
}

// ==========================================
// ANÁLISE OPERACIONAL
// ==========================================

function atualizarAnalise() {
    const operation = obterOperacao();

    let score = 100;
    let analysis = "";
    let recommendation = operation.recommendation;

    if (speed < operation.minSpeed) {
        score -= 15;

        analysis =
            "A velocidade está abaixo da faixa configurada para " +
            operation.name.toLowerCase() + ".";

        recommendation =
            "Verifique se a velocidade está adequada às condições da operação e ao implemento utilizado.";

    } else if (speed > operation.maxSpeed) {
        score -= 20;

        analysis =
            "A velocidade está acima da faixa configurada para " +
            operation.name.toLowerCase() + ".";

        recommendation =
            "Avalie a possibilidade de reduzir a velocidade, considerando as condições de trabalho.";

    } else {
        analysis =
            "A velocidade está dentro da faixa configurada para " +
            operation.name.toLowerCase() + ".";
    }

    if (rpm < operation.minRPM) {
        score -= 8;
    } else if (rpm > operation.maxRPM) {
        score -= 10;
    }

    if (temperature > 90) {
        score -= 20;
    } else if (temperature > 85) {
        score -= 10;
    }

    score = Math.max(0, score);

    scoreElement.textContent = score;

    if (score >= 85) {
        scoreStatus.textContent = "Operação eficiente";
        scoreStatus.style.color = "#287541";

        scoreDescription.textContent =
            "Os parâmetros monitorados estão dentro das faixas configuradas.";

    } else if (score >= 70) {
        scoreStatus.textContent = "Operação moderada";
        scoreStatus.style.color = "#9a7218";

        scoreDescription.textContent =
            "Alguns parâmetros podem precisar de ajustes.";

    } else {
        scoreStatus.textContent = "Atenção necessária";
        scoreStatus.style.color = "#a44335";

        scoreDescription.textContent =
            "Existem parâmetros fora das faixas configuradas.";
    }

    scoreCircle.style.background =
        `conic-gradient(#319451 ${score}%, #e6eee8 ${score}%)`;

    analysisText.textContent = analysis;
    recommendationText.textContent = recommendation;

    atualizarAlertas(operation);
}

// ==========================================
// SISTEMA DE ALERTAS
// ==========================================

function atualizarAlertas(operation) {
    const alerts = [];

    if (speed > operation.maxSpeed) {
        alerts.push("Velocidade acima da faixa configurada para esta operação.");
    }

    if (speed < operation.minSpeed) {
        alerts.push("Velocidade abaixo da faixa configurada para esta operação.");
    }

    if (temperature > 90) {
        alerts.push("Temperatura elevada. Verifique o sistema de arrefecimento.");
    } else if (temperature > 85) {
        alerts.push("Temperatura acima do limite de atenção configurado.");
    }

    if (rpm > operation.maxRPM) {
        alerts.push("Rotação acima da faixa configurada para esta operação.");
    } else if (rpm < operation.minRPM) {
        alerts.push("Rotação abaixo da faixa configurada para esta operação.");
    }

    alertsContainer.replaceChildren();

    if (alerts.length === 0) {
        const item = document.createElement("div");
        item.className = "alert success";

        const icon = document.createElement("span");
        icon.textContent = "✓";

        const content = document.createElement("div");

        const title = document.createElement("strong");
        title.textContent = "Sistema funcionando normalmente";

        const text = document.createElement("p");
        text.textContent =
            "Nenhuma anomalia identificada nos parâmetros monitorados.";

        content.append(title, text);
        item.append(icon, content);
        alertsContainer.appendChild(item);

    } else {
        alerts.forEach((message) => {
            const item = document.createElement("div");
            item.className = "alert";

            const icon = document.createElement("span");
            icon.textContent = "⚠️";

            const content = document.createElement("div");

            const title = document.createElement("strong");
            title.textContent = "Atenção";

            const text = document.createElement("p");
            text.textContent = message;

            content.append(title, text);
            item.append(icon, content);
            alertsContainer.appendChild(item);
        });
    }

    alertCount.textContent = alerts.length;
}

// ==========================================
// SIMULAÇÃO DE DADOS
// ==========================================

function atualizarDadosSimulados() {
    speed += Math.random() * 0.6 - 0.3;
    rpm += Math.floor(Math.random() * 80 - 40);
    temperature += Math.random() * 1.2 - 0.6;
    area += 0.01;

    speed = Math.max(4, Math.min(9, speed));
    rpm = Math.max(1500, Math.min(2300, rpm));
    temperature = Math.max(75, Math.min(95, temperature));

    atualizarIndicadores();
    atualizarHorario();
}

// ==========================================
// LIMPAR INDICADORES AO AGUARDAR THINGSPEAK
// ==========================================

function limparIndicadoresAguardandoThingSpeak() {
    speedElement.textContent = "--";
    rpmElement.textContent = "--";
    temperatureElement.textContent = "--";
    areaElement.textContent = "--";

    scoreElement.textContent = "--";
    scoreStatus.textContent = "Aguardando dados";

    scoreDescription.textContent =
        "Os indicadores serão preenchidos após a leitura do ThingSpeak.";

    analysisText.textContent =
        "Aguardando dados do ThingSpeak.";

    recommendationText.textContent =
        "A recomendação aparecerá quando os dados forem recebidos.";

    alertsContainer.textContent =
        "Aguardando leitura do canal.";

    alertCount.textContent = "0";

    const speedLine = $("speedLine");

    if (speedLine) {
        speedLine.setAttribute("points", "");
    }

    chartValues = [];

    if (scoreCircle) {
        scoreCircle.style.background =
            "conic-gradient(#e6eee8 0%, #e6eee8 100%)";
    }
}

// ==========================================
// LEITURA DO THINGSPEAK
// ==========================================

async function lerThingSpeak() {
    if (requestInProgress) return false;

    const channelId = channelIdInput.value.trim();
    const readApiKey = readApiKeyInput.value.trim();

    if (!/^\d+$/.test(channelId)) {
        definirStatus("error", "Informe um Channel ID numérico válido.");
        return false;
    }

    if (!readApiKey) {
        definirStatus("error", "Digite a Read API Key do canal privado.");
        return false;
    }

    requestInProgress = true;

    testConnectionButton.disabled = true;
    testConnectionButton.textContent = "Conectando...";

    try {
        let url =
            `https://api.thingspeak.com/channels/${encodeURIComponent(channelId)}/feeds.json?results=1`;

        url += `&api_key=${encodeURIComponent(readApiKey)}`;

        const resposta = await fetch(url, {
            method: "GET",
            cache: "no-store"
        });

        if (!resposta.ok) {
            throw new Error(
                "Não foi possível acessar o canal. Confira o Channel ID e a Read API Key."
            );
        }

        const dados = await resposta.json();

        if (!dados.feeds || dados.feeds.length === 0) {
            throw new Error(
                "Conexão realizada, mas o canal ainda não possui registros. Envie um registro para o ThingSpeak."
            );
        }

        const registro = dados.feeds[dados.feeds.length - 1];

        const novaVelocidade = numeroValido(registro.field1);
        const novoRPM = numeroValido(registro.field2);
        const novaTemperatura = numeroValido(registro.field3);
        const novaArea = numeroValido(registro.field4);
        const codigoOperacao = numeroValido(registro.field5);

        if (
            novaVelocidade === null ||
            novoRPM === null ||
            novaTemperatura === null ||
            novaArea === null
        ) {
            throw new Error(
                "Dados incompletos. Confira se os Fields 1, 2, 3 e 4 estão preenchidos."
            );
        }

        if (
            novaVelocidade < 0 || novaVelocidade > 100 ||
            novoRPM < 0 || novoRPM > 10000 ||
            novaTemperatura < -50 || novaTemperatura > 200 ||
            novaArea < 0
        ) {
            throw new Error(
                "O canal retornou valores fora dos limites esperados."
            );
        }

        // Atualiza os indicadores com os dados recebidos do ThingSpeak.
        speed = novaVelocidade;
        rpm = novoRPM;
        temperature = novaTemperatura;
        area = novaArea;

        if (
            codigoOperacao !== null &&
            Number.isInteger(codigoOperacao) &&
            operationCodes[codigoOperacao]
        ) {
            operationSelect.value = operationCodes[codigoOperacao];
        }

        atualizarIndicadores();

        const dataRegistro = registro.created_at
            ? new Date(registro.created_at)
            : new Date();

        atualizarHorario(
            Number.isNaN(dataRegistro.getTime())
                ? new Date()
                : dataRegistro
        );

        definirStatus(
            "connected",
            "Dados recebidos com sucesso do ThingSpeak."
        );

        return true;

    } catch (erro) {
        definirStatus("error", erro.message);
        return false;

    } finally {
        requestInProgress = false;

        testConnectionButton.disabled = false;
        testConnectionButton.textContent = "Testar conexão";
    }
}

// ==========================================
// MODO SIMULADO
// ==========================================

function iniciarModoSimulado() {
    pararTemporizadores();

    dataSource.value = "simulation";

    speed = DADOS_INICIAIS_SIMULADOS.speed;
    rpm = DADOS_INICIAIS_SIMULADOS.rpm;
    temperature = DADOS_INICIAIS_SIMULADOS.temperature;
    area = DADOS_INICIAIS_SIMULADOS.area;

    chartValues = [];

    definirStatus(
        "simulated",
        "O dashboard está utilizando dados simulados."
    );

    atualizarIndicadores();
    atualizarHorario();

    simulationTimer = setInterval(
        atualizarDadosSimulados,
        2500
    );
}

// ==========================================
// MODO THINGSPEAK
// ==========================================

async function iniciarModoThingSpeak() {
    pararTemporizadores();

    dataSource.value = "thingspeak";

    // Retira os valores fictícios da tela.
    limparIndicadoresAguardandoThingSpeak();

    // Tenta novamente a cada 15 segundos,
    // mesmo se a primeira leitura falhar.
    thingspeakTimer = setInterval(
        lerThingSpeak,
        THINGSPEAK_INTERVAL
    );

    // Faz uma leitura imediatamente.
    await lerThingSpeak();
}

// ==========================================
// EVENTOS DOS CONTROLES
// ==========================================

operationSelect.addEventListener("change", () => {
    atualizarAnalise();
});

dataSource.addEventListener("change", () => {
    if (dataSource.value === "thingspeak") {
        iniciarModoThingSpeak();
    } else {
        iniciarModoSimulado();
    }
});

testConnectionButton.addEventListener("click", () => {
    if (dataSource.value !== "thingspeak") {
        dataSource.value = "thingspeak";
    }

    iniciarModoThingSpeak();
});

clearConnectionButton.addEventListener("click", () => {
    pararTemporizadores();

    channelIdInput.value = "";
    readApiKeyInput.value = "";

    iniciarModoSimulado();

    connectionMessage.textContent =
        "Configurações limpas. O sistema voltou ao modo simulado.";
});

// ==========================================
// OLHINHO DA API KEY
// ==========================================

const apiKeyInput = $("readApiKey");
const toggleApiKey = $("toggleApiKey");

if (apiKeyInput && toggleApiKey) {
    toggleApiKey.addEventListener("click", () => {
        const mostrar = apiKeyInput.type === "password";

        if (mostrar) {
            apiKeyInput.type = "text";
            toggleApiKey.textContent = "🙈";
            toggleApiKey.title = "Ocultar API Key";
        } else {
            apiKeyInput.type = "password";
            toggleApiKey.textContent = "👁";
            toggleApiKey.title = "Mostrar API Key";
        }
    });
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

atualizarIndicadores();
iniciarModoSimulado();
