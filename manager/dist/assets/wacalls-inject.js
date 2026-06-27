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

  function getInstanceName() {
    try {
      const raw = localStorage.getItem('instance') || localStorage.getItem('instanceName') || '';
      return raw.replace(/"/g, '');
    } catch { return ''; }
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
      .wacalls-section {
        margin-top: 24px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        background: rgba(255,255,255,0.03);
        padding: 24px;
        animation: wacalls-fadein 0.35s ease;
      }
      @keyframes wacalls-fadein {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .wacalls-section h3 {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 6px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .wacalls-section h3 .wacalls-icon {
        font-size: 20px;
      }
      .wacalls-section .wacalls-desc {
        font-size: 13px;
        opacity: 0.6;
        margin: 0 0 20px 0;
      }
      .wacalls-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      @media (max-width: 640px) {
        .wacalls-grid { grid-template-columns: 1fr; }
      }
      .wacalls-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .wacalls-field.full {
        grid-column: 1 / -1;
      }
      .wacalls-field label {
        font-size: 12px;
        font-weight: 500;
        opacity: 0.7;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .wacalls-field input, .wacalls-field select {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 14px;
        color: inherit;
        outline: none;
        transition: border-color 0.2s;
      }
      .wacalls-field input:focus, .wacalls-field select:focus {
        border-color: #7c3aed;
      }
      .wacalls-field input::placeholder {
        opacity: 0.35;
      }
      .wacalls-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 16px;
      }
      .wacalls-toggle-row .wacalls-toggle-label {
        font-size: 14px;
        font-weight: 500;
      }
      .wacalls-switch {
        position: relative;
        width: 44px;
        height: 24px;
        cursor: pointer;
      }
      .wacalls-switch input {
        opacity: 0; width: 0; height: 0;
      }
      .wacalls-switch .slider {
        position: absolute;
        inset: 0;
        background: rgba(255,255,255,0.15);
        border-radius: 24px;
        transition: background 0.25s;
      }
      .wacalls-switch .slider::before {
        content: '';
        position: absolute;
        width: 18px;
        height: 18px;
        left: 3px;
        bottom: 3px;
        background: white;
        border-radius: 50%;
        transition: transform 0.25s;
      }
      .wacalls-switch input:checked + .slider {
        background: #7c3aed;
      }
      .wacalls-switch input:checked + .slider::before {
        transform: translateX(20px);
      }
      .wacalls-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
        flex-wrap: wrap;
      }
      .wacalls-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      .wacalls-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .wacalls-btn-primary {
        background: #7c3aed;
        color: white;
      }
      .wacalls-btn-primary:hover:not(:disabled) {
        background: #6d28d9;
      }
      .wacalls-btn-secondary {
        background: rgba(255,255,255,0.08);
        color: inherit;
        border: 1px solid rgba(255,255,255,0.12);
      }
      .wacalls-btn-secondary:hover:not(:disabled) {
        background: rgba(255,255,255,0.14);
      }
      .wacalls-btn-success {
        background: #059669;
        color: white;
      }
      .wacalls-btn-success:hover:not(:disabled) {
        background: #047857;
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
      .wacalls-toast.info { background: #2563eb; }
      .wacalls-divider {
        border: none;
        border-top: 1px solid rgba(255,255,255,0.06);
        margin: 20px 0;
      }

      /* ── Test Call Modal ── */
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
        background: #1e1e2e;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 28px;
        width: 460px;
        max-width: 92vw;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }
      .wacalls-modal h3 {
        margin: 0 0 6px 0;
        font-size: 18px;
        font-weight: 600;
      }
      .wacalls-modal .wacalls-desc {
        font-size: 13px;
        opacity: 0.6;
        margin: 0 0 20px 0;
      }
      .wacalls-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 22px;
      }

      /* ── Direct Call Section ── */
      .wacalls-call-section {
        margin-top: 24px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        background: rgba(255,255,255,0.03);
        padding: 24px;
        animation: wacalls-fadein 0.35s ease;
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
    section.className = 'wacalls-section';
    section.setAttribute(INJECTED_ATTR, 'sip');

    const sipEnable = instance.sipEnable || false;
    const sipHost = instance.sipHost || '';
    const sipPort = instance.sipPort || 5060;
    const sipUser = instance.sipUser || '';
    const sipPassword = instance.sipPassword || '';

    section.innerHTML = `
      <h3><span class="wacalls-icon">📞</span> WaCalls — Configurações SIP / Vapi</h3>
      <p class="wacalls-desc">Configure a integração SIP para ligações via WhatsApp com Vapi.ai. Ative para habilitar chamadas de voz nesta instância.</p>

      <div class="wacalls-toggle-row">
        <span class="wacalls-toggle-label">Habilitar SIP / Chamadas</span>
        <label class="wacalls-switch">
          <input type="checkbox" id="wacalls-sip-enable" ${sipEnable ? 'checked' : ''} />
          <span class="slider"></span>
        </label>
      </div>

      <div class="wacalls-grid" id="wacalls-sip-fields" style="${sipEnable ? '' : 'opacity:0.4;pointer-events:none;'}">
        <div class="wacalls-field">
          <label>SIP Host / Servidor</label>
          <input type="text" id="wacalls-sip-host" value="${sipHost}" placeholder="sip.vapi.ai" />
        </div>
        <div class="wacalls-field">
          <label>Porta SIP</label>
          <input type="number" id="wacalls-sip-port" value="${sipPort}" placeholder="5060" />
        </div>
        <div class="wacalls-field">
          <label>Usuário SIP</label>
          <input type="text" id="wacalls-sip-user" value="${sipUser}" placeholder="user@sip.vapi.ai" />
        </div>
        <div class="wacalls-field">
          <label>Senha / API Key (Vapi Token)</label>
          <input type="password" id="wacalls-sip-password" value="${sipPassword}" placeholder="vapi_xxxxxxxx" />
        </div>
      </div>

      <div class="wacalls-actions">
        <button class="wacalls-btn wacalls-btn-primary" id="wacalls-sip-save">💾 Salvar Configurações</button>
        <button class="wacalls-btn wacalls-btn-success" id="wacalls-sip-test" ${sipEnable ? '' : 'disabled'}>🧪 Testar Ligação (Vapi)</button>
        <button class="wacalls-btn wacalls-btn-secondary" id="wacalls-direct-call-btn">📲 Ligação Direta WhatsApp</button>
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
    section.querySelector('#wacalls-sip-save').addEventListener('click', async () => {
      const instanceId = getInstanceId();
      if (!instanceId) { showToast('ID da instância não encontrado', 'error'); return; }

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
    section.querySelector('#wacalls-sip-test').addEventListener('click', () => {
      openVapiTestModal();
    });

    // Direct WhatsApp Call
    section.querySelector('#wacalls-direct-call-btn').addEventListener('click', () => {
      openDirectCallModal();
    });

    return section;
  }

  // ── Vapi Test Modal ─────────────────────────────────────────────
  function openVapiTestModal() {
    const overlay = document.createElement('div');
    overlay.className = 'wacalls-modal-overlay';
    overlay.innerHTML = `
      <div class="wacalls-modal">
        <h3>🧪 Testar Ligação via Vapi.ai</h3>
        <p class="wacalls-desc">Preencha os dados do Vapi para disparar uma ligação de teste via SIP.</p>
        <div class="wacalls-grid" style="grid-template-columns:1fr;">
          <div class="wacalls-field">
            <label>Assistant ID</label>
            <input type="text" id="wacalls-vapi-assistant" placeholder="ID do assistente Vapi" />
          </div>
          <div class="wacalls-field">
            <label>Phone Number ID</label>
            <input type="text" id="wacalls-vapi-phone" placeholder="ID do número no Vapi" />
          </div>
          <div class="wacalls-field">
            <label>Número do Cliente</label>
            <input type="text" id="wacalls-vapi-customer" placeholder="+5511999999999" />
          </div>
        </div>
        <div class="wacalls-modal-actions">
          <button class="wacalls-btn wacalls-btn-secondary" id="wacalls-vapi-cancel">Cancelar</button>
          <button class="wacalls-btn wacalls-btn-success" id="wacalls-vapi-send">📞 Iniciar Ligação</button>
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

      const instName = getInstanceName();
      if (!instName) {
        showToast('Nome da instância não encontrado. Verifique se está conectada.', 'error');
        return;
      }

      const btn = overlay.querySelector('#wacalls-vapi-send');
      btn.disabled = true;
      btn.textContent = '⏳ Ligando...';

      try {
        const res = await apiFetch(`/instance/${instName}/wacalls/vapi-test`, {
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
  function openDirectCallModal() {
    const overlay = document.createElement('div');
    overlay.className = 'wacalls-modal-overlay';
    overlay.innerHTML = `
      <div class="wacalls-modal">
        <h3>📲 Ligação Direta via WhatsApp</h3>
        <p class="wacalls-desc">Inicia uma ligação VoIP direta pelo WhatsApp conectado nesta instância.</p>
        <div class="wacalls-grid" style="grid-template-columns:1fr;">
          <div class="wacalls-field">
            <label>Número de Telefone</label>
            <input type="text" id="wacalls-direct-phone" placeholder="+5511999999999" />
          </div>
        </div>
        <div class="wacalls-modal-actions">
          <button class="wacalls-btn wacalls-btn-secondary" id="wacalls-direct-cancel">Cancelar</button>
          <button class="wacalls-btn wacalls-btn-success" id="wacalls-direct-send">📞 Ligar</button>
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

      const instName = getInstanceName();
      if (!instName) {
        showToast('Nome da instância não encontrado. Verifique se está conectada.', 'error');
        return;
      }

      const btn = overlay.querySelector('#wacalls-direct-send');
      btn.disabled = true;
      btn.textContent = '⏳ Ligando...';

      try {
        const res = await apiFetch(`/instance/${instName}/wacalls/start`, {
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
