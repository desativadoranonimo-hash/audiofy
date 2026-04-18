const API_BASE = "http://localhost:3000/api";
let currentUrl = "";

// ─── Toast de erro (substitui alert()) ───────────────────────────────────────
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── Formata segundos em HH:MM:SS ou MM:SS ───────────────────────────────────
// CORREÇÃO: a lógica anterior quebrava para vídeos com mais de 59 min (ex: 90min → "90:00")
function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Valida se URL é do YouTube ou TikTok ────────────────────────────────────
// CORREÇÃO: evita enviar URLs arbitrárias ao backend
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        const allowed = ['youtube.com', 'youtu.be', 'www.youtube.com', 'tiktok.com', 'www.tiktok.com'];
        return allowed.some(domain => parsed.hostname === domain);
    } catch {
        return false;
    }
}

// ─── Analisa o vídeo e exibe o card de resultado ──────────────────────────────
async function analyzeVideo() {
    const url = document.getElementById('urlInput').value.trim();
    const loader = document.getElementById('loader');
    const resultCard = document.getElementById('resultCard');
    const btn = document.getElementById('btnAction');

    if (!url) {
        showToast('Por favor, cole uma URL válida.');
        return;
    }

    // CORREÇÃO: validação de URL no frontend antes de chamar o backend
    if (!isValidUrl(url)) {
        showToast('URL inválida. Use links do YouTube ou TikTok.');
        return;
    }

    // Reset de UI
    loader.classList.remove('hidden');
    resultCard.classList.add('hidden');
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        const response = await fetch(`${API_BASE}/info?url=${encodeURIComponent(url)}`);

        // CORREÇÃO: trata respostas HTTP com erro (4xx, 5xx) além de erros de rede
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Erro ${response.status} ao analisar o vídeo.`);
        }

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Preenche o card
        document.getElementById('videoTitle').textContent = data.title;
        document.getElementById('thumb').src = data.thumbnail;
        document.getElementById('thumb').alt = data.title;
        // CORREÇÃO: usa função de formatação correta (backend agora envia segundos brutos)
        document.getElementById('duration').textContent = `Duração: ${formatDuration(data.durationSeconds)}`;

        currentUrl = url;
        resultCard.classList.remove('hidden');

    } catch (err) {
        // CORREÇÃO: substitui alert() por toast não-bloqueante
        showToast(err.message || 'Erro ao analisar o vídeo.');
    } finally {
        loader.classList.add('hidden');
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// ─── Inicia o download ────────────────────────────────────────────────────────
function startDownload() {
    if (!currentUrl) {
        showToast('Nenhum vídeo analisado. Cole uma URL primeiro.');
        return;
    }

    const quality = document.getElementById('quality').value;
    const status = document.getElementById('downloadStatus');
    const btn = document.getElementById('btnDownload');

    // Feedback visual durante o download
    status.classList.remove('hidden');
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    // Cria um link oculto para disparar o download
    const a = document.createElement('a');
    a.href = `${API_BASE}/download?url=${encodeURIComponent(currentUrl)}&quality=${quality}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Re-habilita botão após alguns segundos (o download continua em segundo plano)
    setTimeout(() => {
        status.classList.add('hidden');
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }, 4000);
}

// ─── Permitir Enter no input ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('urlInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') analyzeVideo();
    });
});
