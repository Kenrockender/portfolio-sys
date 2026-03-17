import { askGemini, analyzePortfolio } from './gemini.js';

// ── Gemini Chat State ─────────────────────────────────────────────
let _geminiHistory = [];  // { role: 'user'|'model', parts: [{text}] }

// ── Buka / Tutup Modal ─────────────────────────────────────────────
window.openGeminiChat = function () {
  document.getElementById('geminiOverlay').style.display = 'block';
  const modal = document.getElementById('geminiModal');
  modal.style.display = 'flex';
  // Sedikit delay untuk animasi
  requestAnimationFrame(() => {
    modal.style.opacity = '0';
    modal.style.transform = 'translateY(20px)';
    modal.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      modal.style.transform = 'translateY(0)';
    });
  });
  document.getElementById('geminiInput').focus();
};

window.closeGeminiChat = function () {
  document.getElementById('geminiOverlay').style.display = 'none';
  document.getElementById('geminiModal').style.display   = 'none';
};

// ── Kirim Pesan ────────────────────────────────────────────────────
window.sendGeminiMessage = async function () {
  const input = document.getElementById('geminiInput');
  const msg   = input.value.trim();
  if (!msg) return;

  input.value = '';
  appendGeminiMsg('user', msg);

  const btn = document.getElementById('geminiSendBtn');
  btn.disabled   = true;
  btn.textContent = '⏳';

  // Tambah loading bubble
  const loadId = appendGeminiMsg('model', '...', true);

  try {
    const reply = await askGemini(msg, _geminiHistory);

    // Hapus loading, tampilkan jawaban
    document.getElementById(loadId)?.remove();
    appendGeminiMsg('model', reply);

    // Simpan ke history untuk context multi-turn
    _geminiHistory.push(
      { role: 'user',  parts: [{ text: msg   }] },
      { role: 'model', parts: [{ text: reply }] }
    );
    // Batasi history 10 pesan terakhir agar tidak over-token
    if (_geminiHistory.length > 20) _geminiHistory = _geminiHistory.slice(-20);

  } catch (e) {
    document.getElementById(loadId)?.remove();
    appendGeminiMsg('model', `⚠️ Error: ${e.message}. Cek API key dan koneksi internet.`);
  }

  btn.disabled    = false;
  btn.textContent = '➤';
};

// ── Auto Analisis ──────────────────────────────────────────────────
window.triggerAutoAnalysis = async function () {
  appendGeminiMsg('user', '⚡ Tolong analisis portofolio saya secara keseluruhan.');
  const loadId = appendGeminiMsg('model', '🔍 Menganalisis portofolio...', true);

  try {
    const analysis = await analyzePortfolio();
    document.getElementById(loadId)?.remove();
    appendGeminiMsg('model', analysis);
  } catch (e) {
    document.getElementById(loadId)?.remove();
    appendGeminiMsg('model', `⚠️ Analisis gagal: ${e.message}`);
  }
};

// ── Helper: Tambah Bubble Chat ─────────────────────────────────────
function appendGeminiMsg(role, text, isLoading = false) {
  const container = document.getElementById('geminiMessages');
  const id        = `gm-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;

  const isUser    = role === 'user';
  const div       = document.createElement('div');
  div.id          = id;
  div.style.cssText = `
    background: ${isUser ? 'var(--crypto)' : 'var(--bg3)'};
    color: ${isUser ? '#fff' : 'var(--text)'};
    border-radius: ${isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px'};
    padding: 10px 14px;
    font-size: 12px;
    line-height: 1.6;
    max-width: 88%;
    align-self: ${isUser ? 'flex-end' : 'flex-start'};
    border: 1px solid ${isUser ? 'transparent' : 'var(--border2)'};
    word-break: break-word;
    white-space: pre-wrap;
  `;

  // Render markdown sederhana (bold, italic, list)
  div.innerHTML = isLoading ? text : renderMiniMarkdown(text);

  container.appendChild(div);
  // Auto-scroll ke bawah
  container.scrollTop = container.scrollHeight;
  return id;
}

// ── Mini Markdown Renderer ─────────────────────────────────────────
function renderMiniMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<strong style="font-size:13px">$1</strong>')
    .replace(/^## (.+)$/gm,  '<strong style="font-size:14px">$1</strong>')
    .replace(/^# (.+)$/gm,   '<strong style="font-size:15px">$1</strong>')
    .replace(/^[-•] (.+)$/gm, '• $1')
    .replace(/\n/g, '<br>');
}