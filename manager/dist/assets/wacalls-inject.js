/**
 * WaCalls Manager Injection - SIP/Vapi Call Settings & Test
 * Injeta a seção de configurações SIP e teste de ligações no Manager do Evolution GO.
 */
(function () {
  'use strict';

  const POLL_INTERVAL = 800;
  const INJECTED_ATTR = 'data-wacalls-injected';

  // ── Helpers ──────────────────────────────────────────────────────
  function getApiKey() {
    try {
      const raw = localStorage.getItem('apikey') || localStorage.getItem('token') || '';
      return raw.replace(/"/g, '');
    } catch { return ''; }
  }

  function getInstanceId() {
    const m = location.pathname.match(/instances\/([a-f0-9-]+)/i);
    return m ? m[1] : null;
  }

  async function apiFetch(path, opts = {}) {
    const key = getApiKey();
    const base = location.origin;
    const res = await fetch(`${base}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        ...(opts.headers || {}),
      },
    });
    return res.json();
  }

  // ── CSS (injeta uma vez) ─────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('wacalls-styles')) return;
    const style = document.createElement('style');
    style.id = 'wacalls-styles';
    style.textContent = `
      .wacalls-container {
        animation: wacalls-fadein 0.35s ease;
      }
      @keyframes wacalls-fadein {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .wacalls-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
      }
      .wacalls-switch input { opacity: 0; width: 0; height: 0; }
      .wacalls-slider {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: hsl(var(--input));
        transition: .4s;
        border-radius: 34px;
      }
      .wacalls-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: hsl(var(--background));
        transition: .4s;
        border-radius: 50%;
      }
      .wacalls-switch input:checked + .wacalls-slider {
        background-color: hsl(var(--primary));
      }
      .wacalls-switch input:focus + .wacalls-slider {
        box-shadow: 0 0 1px hsl(var(--primary));
      }
      .wacalls-switch input:checked + .wacalls-slider:before {
        transform: translateX(20px);
      }
      .wacalls-toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 14px 20px;
        border-radius: 10px;
        font-size: 14px;
        color: white;
        z-index: 99999;
        animation: wacalls-fadein 0.3s ease;
        max-width: 400px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      }
      .wacalls-toast.success { background: #059669; }
      .wacalls-toast.error { background: #dc2626; }
      
      /* Modais */
      .wacalls-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
        z-index: 99990;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: wacalls-fadein 0.2s ease;
      }
      .wacalls-modal {
        background: hsl(var(--card));
        color: hsl(var(--card-foreground));
        border: 1px solid hsl(var(--border));
        border-radius: 12px;
        padding: 24px;
        width: 460px;
        max-width: 92vw;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }
    `;
    document.head.appendChild(style);
  }

  // ── Toast ────────────────────────────────────────────────────────
  function showToast(msg, type = 'info') {
    const existing = document.querySelectorAll('.wacalls-toast');
    existing.forEach(e => e.remove());
    const el = document.createElement('div');
    el.className = `wacalls-toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ── SIP Settings Section ─────────────────────────────────────────
  function buildSipSection(instance) {
    const section = document.createElement('div');
    section.className = 'wacalls-container space-y-6 mt-6';
    section.setAttribute(INJECTED_ATTR, 'sip');

    let sipEnable = instance.sipEnable || false;
    let sipHost = instance.sipHost || '';
    let sipPort = instance.sipPort || '';
    let sipUser = instance.sipUser || '';
    let sipPassword = instance.sipPassword || '';

    // Auto-generate default SIP values if they are empty
    if (!sipHost) sipHost = window.location.hostname;
    if (!sipPort) sipPort = 5060;
    if (!sipUser) sipUser = instance.name || instance.instanceName;
    if (!sipPassword) sipPassword = instance.token || '';

    section.innerHTML = `
      <div class="rounded-xl border bg-card text-card-foreground shadow">
        <div class="p-6">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xl">📞</span>
            <h3 class="text-lg font-semibold tracking-tight">WaCalls — Configurações SIP</h3>
          </div>
          <p class="text-sm text-muted-foreground mb-6">Configure a integração SIP para ligações via WhatsApp. Ative para habilitar chamadas de voz nesta instância.</p>

          <div class="flex items-center justify-between py-3 border-b border-border mb-4">
            <span class="text-sm font-medium">Habilitar SIP / Chamadas</span>
            <label class="wacalls-switch">
              <input type="checkbox" id="wacalls-sip-enable" ${sipEnable ? 'checked' : ''} />
              <span class="wacalls-slider"></span>
            </label>
          </div>

          <div id="wacalls-sip-fields" class="grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity" style="${sipEnable ? '' : 'opacity:0.4;pointer-events:none;'}">
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">SIP Host / Servidor</label>
              <input type="text" id="wacalls-sip-host" value="${sipHost}" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Porta SIP</label>
              <input type="number" id="wacalls-sip-port" value="${sipPort}" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Usuário SIP</label>
              <input type="text" id="wacalls-sip-user" value="${sipUser}" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Senha / API Key (Vapi Token)</label>
              <input type="password" id="wacalls-sip-password" value="${sipPassword}" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button type="button" id="wacalls-sip-save" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              💾 Salvar Configurações SIP
            </button>
          </div>
        </div>
      </div>

      <div class="rounded-xl border bg-card text-card-foreground shadow mt-6">
        <div class="p-6">
          <h3 class="text-lg font-semibold tracking-tight mb-2">WaCalls — Integração Vapi e Ligações</h3>
          <p class="text-sm text-muted-foreground mb-6">Teste de chamadas SIP e Ligações VoIP direto pelo WhatsApp.</p>

          <div class="flex gap-4 flex-wrap">
            <button type="button" id="wacalls-sip-test" ${sipEnable ? '' : 'disabled'} class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-emerald-600 text-white hover:bg-emerald-700 h-10 px-4 py-2">
              🧪 Testar Ligação (Vapi)
            </button>
            <button type="button" id="wacalls-direct-call-btn" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              📲 Ligação Direta WhatsApp
            </button>
          </div>
        </div>
      </div>
    `;

    // Toggle enable/disable
    const toggle = section.querySelector('#wacalls-sip-enable');
    const fields = section.querySelector('#wacalls-sip-fields');
    const testBtn = section.querySelector('#wacalls-sip-test');
    toggle.addEventListener('change', () => {
      const on = toggle.checked;
      fields.style.opacity = on ? '' : '0.4';
      fields.style.pointerEvents = on ? '' : 'none';
      testBtn.disabled = !on;
    });

    // Save
    section.querySelector('#wacalls-sip-save').addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const instanceId = instance.id;
      if (!instanceId) { showToast('ID da instância não encontrado (banco de dados)', 'error'); return; }

      const payload = {
        alwaysOnline: instance.alwaysOnline || false,
        rejectCall: instance.rejectCall || false,
        msgRejectCall: instance.msgRejectCall || '',
        readMessages: instance.readMessages || false,
        ignoreGroups: instance.ignoreGroups || false,
        ignoreStatus: instance.ignoreStatus || false,
        sipEnable: toggle.checked,
        sipHost: section.querySelector('#wacalls-sip-host').value,
        sipPort: parseInt(section.querySelector('#wacalls-sip-port').value) || 5060,
        sipUser: section.querySelector('#wacalls-sip-user').value,
        sipPassword: section.querySelector('#wacalls-sip-password').value,
      };

      try {
        const res = await apiFetch(`/instance/${instanceId}/advanced-settings`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (res.error) throw new Error(res.error);
        showToast('Configurações SIP salvas com sucesso!', 'success');
      } catch (err) {
        showToast('Erro ao salvar: ' + err.message, 'error');
      }
    });

    // Test Vapi Call
    section.querySelector('#wacalls-sip-test').addEventListener('click', (e) => {
      e.preventDefault();
      openVapiTestModal(instance);
    });

    // Direct WhatsApp Call
    section.querySelector('#wacalls-direct-call-btn').addEventListener('click', (e) => {
      e.preventDefault();
      openDirectCallModal(instance);
    });

    return section;
  }

  // ── Vapi Test Modal ─────────────────────────────────────────────
  function openVapiTestModal(instance) {
    const overlay = document.createElement('div');
    overlay.className = 'wacalls-modal-overlay';
    overlay.innerHTML = `
      <div class="wacalls-modal">
        <h3 class="text-lg font-semibold tracking-tight mb-2">🧪 Testar Ligação via Vapi.ai</h3>
        <p class="text-sm text-muted-foreground mb-6">Preencha os dados do Vapi para disparar uma ligação de teste via SIP.</p>
        
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">Assistant ID</label>
            <input type="text" id="wacalls-vapi-assistant" placeholder="ID do assistente Vapi" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Phone Number ID</label>
            <input type="text" id="wacalls-vapi-phone" placeholder="ID do número no Vapi" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Número do Cliente</label>
            <input type="text" id="wacalls-vapi-customer" placeholder="+5511999999999" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button type="button" id="wacalls-vapi-cancel" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">Cancelar</button>
          <button type="button" id="wacalls-vapi-send" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 h-10 px-4 py-2">📞 Iniciar Ligação</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#wacalls-vapi-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#wacalls-vapi-send').addEventListener('click', async () => {
      const assistantId = overlay.querySelector('#wacalls-vapi-assistant').value.trim();
      const phoneNumberId = overlay.querySelector('#wacalls-vapi-phone').value.trim();
      const customerNumber = overlay.querySelector('#wacalls-vapi-customer').value.trim();

      if (!assistantId || !phoneNumberId || !customerNumber) {
        showToast('Todos os campos são obrigatórios', 'error');
        return;
      }

      if (!instance.name) {
        showToast('Nome da instância não encontrado. Verifique se está conectada.', 'error');
        return;
      }

      const btn = overlay.querySelector('#wacalls-vapi-send');
      btn.disabled = true;
      btn.textContent = '⏳ Ligando...';

      try {
        const res = await apiFetch(`/instance/${instance.name}/wacalls/vapi-test`, {
          method: 'POST',
          body: JSON.stringify({ assistantId, phoneNumberId, customerNumber }),
        });
        if (res.error) throw new Error(res.error);
        showToast('Ligação Vapi iniciada com sucesso!', 'success');
        overlay.remove();
      } catch (err) {
        showToast('Erro: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '📞 Iniciar Ligação';
      }
    });
  }

  // ── Direct WhatsApp Call Modal ──────────────────────────────────
  function openDirectCallModal(instance) {
    const overlay = document.createElement('div');
    overlay.className = 'wacalls-modal-overlay';
    overlay.innerHTML = `
      <div class="wacalls-modal">
        <h3 class="text-lg font-semibold tracking-tight mb-2">📲 Ligação Direta via WhatsApp</h3>
        <p class="text-sm text-muted-foreground mb-6">Inicia uma ligação VoIP direta pelo WhatsApp conectado nesta instância.</p>
        
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">Número de Telefone</label>
            <input type="text" id="wacalls-direct-phone" placeholder="+5511999999999" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button type="button" id="wacalls-direct-cancel" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">Cancelar</button>
          <button type="button" id="wacalls-direct-send" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 h-10 px-4 py-2">📞 Ligar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#wacalls-direct-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#wacalls-direct-send').addEventListener('click', async () => {
      const phone = overlay.querySelector('#wacalls-direct-phone').value.trim();
      if (!phone) {
        showToast('Informe o número de telefone', 'error');
        return;
      }

      if (!instance.name) {
        showToast('Nome da instância não encontrado. Verifique se está conectada.', 'error');
        return;
      }

      const btn = overlay.querySelector('#wacalls-direct-send');
      btn.disabled = true;
      btn.textContent = '⏳ Ligando...';

      try {
        const res = await apiFetch(`/instance/${instance.name}/wacalls/start`, {
          method: 'POST',
          body: JSON.stringify({ phone }),
        });
        if (res.error) throw new Error(res.error);
        showToast(`Ligação iniciada! Call ID: ${res.call?.callId || 'N/A'}`, 'success');
        overlay.remove();
      } catch (err) {
        showToast('Erro: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '📞 Ligar';
      }
    });
  }

  // ── Instance data fetcher (para pegar SIP settings atuais) ──────
  async function fetchInstanceData() {
    const instanceId = getInstanceId();
    if (!instanceId) return null;
    try {
      const data = await apiFetch(`/instance/info/${instanceId}`);
      return data.instance || data;
    } catch { return null; }
  }

  // ── Injection logic ─────────────────────────────────────────────
  let lastPath = '';

  async function tryInject() {
    const path = location.pathname;

    // Só injeta na tela de settings de uma instância
    if (!path.match(/instances\/[a-f0-9-]+\/settings/i)) {
      lastPath = path;
      return;
    }

    // Já foi injetado?
    if (document.querySelector(`[${INJECTED_ATTR}="sip"]`)) {
      // Se o path mudou, remover para reinjetar
      if (path !== lastPath) {
        document.querySelector(`[${INJECTED_ATTR}="sip"]`).remove();
      } else {
        return;
      }
    }
    lastPath = path;

    // Aguarda a tela de settings carregar (procura por forms/cards existentes)
    const settingsContainer = document.querySelector('main') ||
                              document.querySelector('[class*="settings"]') ||
                              document.querySelector('[class*="Settings"]') ||
                              document.querySelector('#root > div > div:last-child') ||
                              document.querySelector('[class*="content"]');

    if (!settingsContainer) return;

    // Buscar dados da instância
    const instance = await fetchInstanceData();
    if (!instance) return;

    // Buscar o melhor container para inserir
    const forms = settingsContainer.querySelectorAll('form, [class*="card"], [class*="Card"], [class*="section"], [class*="panel"]');
    let insertTarget = settingsContainer;
    if (forms.length > 0) {
      insertTarget = forms[forms.length - 1].parentElement || settingsContainer;
    }

    const sipSection = buildSipSection(instance);
    insertTarget.appendChild(sipSection);
  }

  // ── Main loop ────────────────────────────────────────────────────
  function init() {
    injectStyles();
    setInterval(tryInject, POLL_INTERVAL);
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
