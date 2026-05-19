// ── State ──────────────────────────────────────────────────
const state = {
  codes: [],      // { code, type, value, maxUses, usedCount, createdAt }
  activeTab: 'all',
};

// ── Alphabet constants ─────────────────────────────────────
const LETTERS_SAFE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // без O
const LETTERS_FULL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS_SAFE  = '23456789';                  // без 0, 1
const DIGITS_FULL  = '0123456789';

// ── Alphabet builder ───────────────────────────────────────
function buildAlphabet(useLetters, useDigits, avoidSimilar) {
  let alpha = '';
  if (useLetters) alpha += avoidSimilar ? LETTERS_SAFE : LETTERS_FULL;
  if (useDigits)  alpha += avoidSimilar ? DIGITS_SAFE  : DIGITS_FULL;
  return alpha || LETTERS_SAFE; // fallback
}

// ── Single code generator ──────────────────────────────────
function randomCode(prefix, length, alphabet) {
  const bodyLen = Math.max(length - prefix.length, 4);
  let code = prefix;
  for (let i = 0; i < bodyLen; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

// ── Label helpers ──────────────────────────────────────────
function typeLabel(type) {
  const map = { discount: 'Скидка', fixed: 'Фикс.скидка', free: 'Бесп.доставка', trial: 'Пробный' };
  return map[type] || type;
}

function typeBadgeClass(type) {
  const map = { discount: 'badge-discount', fixed: 'badge-discount', free: 'badge-free', trial: 'badge-trial' };
  return map[type] || '';
}

function typeValueLabel(type, value) {
  if (type === 'discount') return `${value}%`;
  if (type === 'fixed')    return `−${value}₽`;
  if (type === 'free')     return 'Бесплатно';
  if (type === 'trial')    return `${value} дн.`;
  return '';
}

// ── Generate codes ─────────────────────────────────────────
function generateCodes() {
  const type     = document.getElementById('code-type').value;
  const value    = parseInt(document.getElementById('code-value').value)  || 10;
  const prefix   = document.getElementById('code-prefix').value.trim().toUpperCase();
  const length   = Math.min(Math.max(parseInt(document.getElementById('code-length').value) || 8, 4), 16);
  const count    = Math.min(Math.max(parseInt(document.getElementById('code-count').value)  || 5, 1), 50);
  const maxUses  = Math.min(Math.max(parseInt(document.getElementById('max-uses').value)    || 1, 1), 9999);
  const useLetters  = document.getElementById('use-letters').checked;
  const useDigits   = document.getElementById('use-digits').checked;
  const avoidSim    = document.getElementById('avoid-similar').checked;

  const alphabet = buildAlphabet(useLetters, useDigits, avoidSim);
  const existing = new Set(state.codes.map(c => c.code));
  const newCodes = [];
  let attempts = 0;

  // Generate unique codes; cap attempts to avoid infinite loop on tiny alphabets
  while (newCodes.length < count && attempts < count * 20) {
    attempts++;
    const code = randomCode(prefix, length, alphabet);
    if (!existing.has(code)) {
      existing.add(code);
      newCodes.push({ code, type, value, maxUses, usedCount: 0, createdAt: Date.now() });
    }
  }

  state.codes.unshift(...newCodes);
  renderList();
  updateStats();
  toast(`✦ Сгенерировано ${newCodes.length} кодов`);
}

// ── Validate code ──────────────────────────────────────────
function validateCode() {
  const input = document.getElementById('validate-input').value.trim().toUpperCase();
  const vr    = document.getElementById('vr');

  if (!input) { vr.className = 'validation-result'; return; }

  const entry = state.codes.find(c => c.code === input);

  if (!entry) {
    vr.className = 'validation-result error';
    vr.innerHTML = `<div class="vr-title">✗ Код не найден</div>
      Промокод <span style="font-family:var(--mono)">${input}</span> не существует в базе.`;
    return;
  }

  if (entry.usedCount >= entry.maxUses) {
    vr.className = 'validation-result error';
    vr.innerHTML = `<div class="vr-title">✗ Код исчерпан</div>
      Достигнут лимит использований: ${entry.usedCount}/${entry.maxUses}.`;
    return;
  }

  // Apply: increment usage counter
  entry.usedCount++;
  renderList();
  updateStats();

  vr.className = 'validation-result success';
  vr.innerHTML = `
    <div class="vr-title">✓ Код действителен</div>
    Применена скидка: <strong>${typeLabel(entry.type)} — ${typeValueLabel(entry.type, entry.value)}</strong>
    <div class="vr-meta">
      Использований: <span>${entry.usedCount} / ${entry.maxUses}</span>
      &nbsp;·&nbsp; Создан: <span>${new Date(entry.createdAt).toLocaleDateString('ru-RU')}</span>
    </div>`;

  document.getElementById('validate-input').value = '';
}

// ── Render code list ───────────────────────────────────────
function renderList() {
  const list = document.getElementById('code-list');

  let filtered = state.codes;
  if (state.activeTab === 'active') filtered = filtered.filter(c => c.usedCount < c.maxUses);
  if (state.activeTab === 'used')   filtered = filtered.filter(c => c.usedCount >= c.maxUses);

  if (!filtered.length) {
    const msg = state.codes.length === 0
      ? '🎟 Сгенерируйте коды, чтобы увидеть их здесь'
      : (state.activeTab === 'used' ? '📭 Нет использованных кодов' : '📭 Все коды исчерпаны');
    list.innerHTML = `<div class="empty-state"><div class="icon"></div>${msg}</div>`;
    return;
  }

  list.innerHTML = filtered.map(entry => {
    const exhausted = entry.usedCount >= entry.maxUses;
    return `
      <div class="code-row" style="${exhausted ? 'opacity:0.45;' : ''}">
        <span class="code-text">${entry.code}</span>
        <span class="code-badge ${typeBadgeClass(entry.type)}">${typeLabel(entry.type)} ${typeValueLabel(entry.type, entry.value)}</span>
        <span class="uses-bar">${entry.usedCount}/${entry.maxUses} исп.</span>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm" onclick="copyCode('${entry.code}')" title="Копировать">⎘</button>
          <button class="btn btn-danger-sm" onclick="deleteCode('${entry.code}')" title="Удалить">✕</button>
        </div>
      </div>`;
  }).join('');
}

// ── Update header stats ────────────────────────────────────
function updateStats() {
  const total  = state.codes.length;
  const used   = state.codes.filter(c => c.usedCount >= c.maxUses).length;
  const active = total - used;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-used').textContent   = used;
  document.getElementById('stat-total').textContent  = total;
}

// ── Copy to clipboard ──────────────────────────────────────
function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => toast(`📋 Скопировано: ${code}`));
}

// ── Delete single code ─────────────────────────────────────
function deleteCode(code) {
  state.codes = state.codes.filter(c => c.code !== code);
  renderList();
  updateStats();
  toast('Код удалён');
}

// ── Clear all codes ────────────────────────────────────────
function clearAll() {
  if (!state.codes.length) return;
  if (!confirm('Удалить все коды?')) return;
  state.codes = [];
  renderList();
  updateStats();
  document.getElementById('vr').className = 'validation-result';
}

// ── Switch tab ─────────────────────────────────────────────
function switchTab(tab, btn) {
  state.activeTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderList();
}

// ── Export CSV (with BOM for Excel compatibility) ──────────
function exportCSV() {
  if (!state.codes.length) { toast('Нет кодов для экспорта'); return; }

  const rows = [['Код', 'Тип', 'Значение', 'Макс.исп.', 'Использовано', 'Создан']];
  state.codes.forEach(c => rows.push([
    c.code,
    typeLabel(c.type),
    typeValueLabel(c.type, c.value),
    c.maxUses,
    c.usedCount,
    new Date(c.createdAt).toLocaleDateString('ru-RU'),
  ]));

  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'promocodes.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('📥 CSV сохранён');
}

// ── Toast notification ─────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Dynamic label for "value" field ───────────────────────
document.getElementById('code-type').addEventListener('change', function () {
  const config = {
    discount: { label: 'Размер скидки (%)',       enabled: true,  max: 100   },
    fixed:    { label: 'Размер скидки (₽)',        enabled: true,  max: 99999 },
    free:     { label: '(поле не используется)',   enabled: false, max: 1     },
    trial:    { label: 'Длительность (дней)',      enabled: true,  max: 365   },
  };
  const { label, enabled, max } = config[this.value];
  document.getElementById('value-label').textContent = label;
  const inp = document.getElementById('code-value');
  inp.disabled     = !enabled;
  inp.max          = max;
  inp.style.opacity = enabled ? '1' : '0.4';
});
