/* SmartTractor - primeira camada de perfis e registros locais.
   Os dados ficam neste navegador. Sincronização entre aparelhos exige backend. */
(() => {
  const $ = (id) => document.getElementById(id);
  const DB_KEY = "smarttractor_local_records_v1";
  const FLEET_KEY = "smarttractor_local_fleet_v1";
  let activeRole = null;
  const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = (v) => String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const gate = $("roleGate");
  const roleBar = $("roleBar");
  const operatorPanel = $("operatorPanel");
  const managerPanel = $("managerPanel");
  const tabButtons = [...document.querySelectorAll(".tab-button")];
  const tabContents = [...document.querySelectorAll(".tab-content")];

  function showTab(id) {
    tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === id));
    tabContents.forEach(s => s.classList.toggle("active", s.id === id));
  }
  function setRole(role) {
    activeRole = role; gate.hidden = true; document.body.classList.remove("app-locked"); document.body.classList.add("app-unlocked"); roleBar.hidden = false;
    $("activeRoleLabel").textContent = role === "operator" ? "Perfil: Operador" : "Perfil: Gerente";
    operatorPanel.hidden = role !== "operator"; managerPanel.hidden = role !== "manager";
    $("recordsTitle").textContent = role === "operator" ? "Área do operador" : "Área do gerente";
    $("recordsSubtitle").textContent = role === "operator" ? "Registre seu trabalho, paradas e manutenções." : "Consulte fazendas, frota e registros da equipe.";
    const managementTab = tabButtons.find(b => b.dataset.tab === "registros");
    if (managementTab) managementTab.hidden = false;
    showTab("registros"); refreshAll();
  }
  document.querySelectorAll(".role-choice").forEach(b => b.addEventListener("click", () => setRole(b.dataset.role)));
  $("changeRole").addEventListener("click", () => { gate.hidden = false; document.body.classList.add("app-locked"); document.body.classList.remove("app-unlocked"); roleBar.hidden = true; activeRole = null; });

  function refreshMachineOptions() {
    const select = $("operatorMachine"); const current = select.value;
    const fleet = read(FLEET_KEY);
    select.innerHTML = '<option value="">Selecione uma máquina</option>' + fleet.map(m => `<option value="${esc(m.machine)}">${esc(m.machine)} — ${esc(m.category)} (${esc(m.farm)})</option>`).join("");
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }
  function farmsFromData() {
    const farms = new Set([...read(FLEET_KEY).map(x => x.farm), ...read(DB_KEY).map(x => x.farm)].filter(Boolean));
    return [...farms].sort((a,b) => a.localeCompare(b,"pt-BR"));
  }
  function refreshFarmFilter() {
    const sel = $("farmFilter"); const old = sel.value;
    sel.innerHTML = '<option value="">Todas as fazendas</option>' + farmsFromData().map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join("");
    if ([...sel.options].some(o => o.value === old)) sel.value = old;
  }
  function refreshManager() {
    refreshFarmFilter();
    const filter = $("farmFilter").value;
    const records = read(DB_KEY).filter(r => !filter || r.farm === filter).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    const fleet = read(FLEET_KEY).filter(m => !filter || m.farm === filter);
    $("managerSummary").textContent = `${records.length} registro(s) de operação e ${fleet.length} máquina(s) na seleção atual.`;
    $("fleetList").innerHTML = fleet.length ? fleet.map(m => `<article class="record-card"><strong>${esc(m.machine)} — ${esc(m.category)}</strong><p>Fazenda: ${esc(m.farm)} · Modelo: ${esc(m.model || "Não informado")}</p></article>`).join("") : '<p class="empty-state">Nenhuma máquina cadastrada nesta seleção.</p>' ;
    $("managerRecords").innerHTML = records.length ? records.map(r => `<article class="record-card"><strong>${esc(r.operator)} · ${esc(r.operation)}</strong><p><b>Fazenda:</b> ${esc(r.farm)} · <b>Máquina:</b> ${esc(r.machine)}</p><p><b>Data:</b> ${esc(new Date(r.workDate).toLocaleString("pt-BR"))} · <b>Rádio:</b> ${esc(r.radio || "Não informado")}</p><p><b>Parada:</b> ${esc(r.stopReason || "Não informada")}</p><p><b>Manutenção:</b> ${esc(r.maintenance || "Não informada")}</p><p><b>Falha / causa:</b> ${esc(r.failure || "Não informada")}</p><p><b>Observações:</b> ${esc(r.notes || "—")}</p><div class="rating-row"><label>Nota (0–10) <input type="number" min="0" max="10" step="0.5" value="${r.rating ?? ""}" data-rating="${r.id}" aria-label="Nota do funcionário"></label><button type="button" data-save-rating="${r.id}">Salvar avaliação</button><span>${r.rating == null ? "Sem avaliação" : `Nota atual: ${r.rating}/10`}</span></div></article>`).join("") : '<p class="empty-state">Ainda não há registros de operadores. Os registros aparecerão aqui quando forem feitos neste aparelho.</p>' ;
    $("managerRecords").querySelectorAll("[data-save-rating]").forEach(btn => btn.addEventListener("click", () => {
      const id = btn.dataset.saveRating; const input = $("managerRecords").querySelector(`[data-rating="${id}"]`); const value = Number(input.value);
      if (!input.value || !Number.isFinite(value) || value < 0 || value > 10) { alert("Informe uma nota entre 0 e 10."); return; }
      const all = read(DB_KEY); const item = all.find(x => x.id === id); if (item) { item.rating = value; write(DB_KEY, all); refreshManager(); }
    }));
  }
  function refreshAll() { refreshMachineOptions(); refreshManager(); }

  $("operatorForm").addEventListener("submit", (ev) => {
    ev.preventDefault(); const form = new FormData(ev.currentTarget);
    const record = Object.fromEntries(form.entries());
    if (!record.machine) { $("operatorFeedback").textContent = "Cadastre ou selecione uma máquina antes de salvar."; return; }
    record.id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    record.createdAt = new Date().toISOString(); record.rating = null;
    const all = read(DB_KEY); all.push(record); write(DB_KEY, all);
    $("operatorFeedback").textContent = "Registro salvo neste aparelho. Para compartilhar com o gerente em outro celular, será necessário ativar a sincronização online.";
    ev.currentTarget.reset(); $("operatorForm").elements.workDate.value = new Date().toISOString().slice(0,16); refreshAll();
  });
  $("fleetForm").addEventListener("submit", (ev) => {
    ev.preventDefault(); const item = Object.fromEntries(new FormData(ev.currentTarget).entries());
    const fleet = read(FLEET_KEY); if (fleet.some(m => m.machine.toLowerCase() === item.machine.toLowerCase() && m.farm.toLowerCase() === item.farm.toLowerCase())) { alert("Essa identificação já está cadastrada nesta fazenda."); return; }
    item.id = String(Date.now()); item.createdAt = new Date().toISOString(); fleet.push(item); write(FLEET_KEY, fleet); ev.currentTarget.reset(); refreshAll();
  });
  $("farmFilter").addEventListener("change", refreshManager);
  $("operatorForm").elements.workDate.value = new Date().toISOString().slice(0,16);
  // Mantém a aba de gestão visível apenas depois da escolha do perfil.
  const managementTab = tabButtons.find(b => b.dataset.tab === "registros"); if (managementTab) managementTab.hidden = true;
  refreshAll();
})();
