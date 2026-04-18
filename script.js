// ─── Detecta se está rodando em produção (Render) ou local ───────────────────
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

let currentUrl = '';

// ─── Toast de erro ────────────────────────────────────────────────────────────
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── Formata segundos em HH:MM:SS ou MM:SS ───────────────────────────────────
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
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        const allowed = [
            'youtube.com', 'youtu.be', 'www.youtube.com',
            'tiktok.com', 'www.tiktok.com', 'm.tiktok.com'
        ];
        return allowed.some(domain => parsed.hostname === domain);
    } catch {
        return false;
    }
}

// ─── Analisa o vídeo ──────────────────────────────────────────────────────────
async function analyzeVideo() {
    const url = document.getElementById('urlInput').value.trim();
    const loader = document.getElementById('loader');
    const card = document.getElementById('resultCard');
    const btn = document.getElementById('btnAction');

    if (!url) {
        showToast('Cole uma URL primeiro.');
        return;
    }
    if (!isValidUrl(url)) {
        showToast('URL inválida. Use links do YouTube ou TikTok.');
        return;
    }

    loader.classList.add('visible');
    card.classList.remove('visible');
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/info?url=${encodeURIComponent(url)}`);

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Erro ${response.status} ao analisar o vídeo.`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        // Preenche o card com os dados
        document.getElementById('videoTitle').textContent = data.title;
        document.getElementById('duration').textContent = `⏱ ${formatDuration(data.durationSeconds)}`;

        const thumb = document.getElementById('thumb');
        const placeholder = document.getElementById('thumbPlaceholder');

        if (data.thumbnail) {
            thumb.src = data.thumbnail;
            thumb.alt = data.title;
            thumb.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            thumb.style.display = 'none';
            placeholder.style.display = 'flex';
        }

        currentUrl = url;
        card.classList.add('visible');

    } catch (err) {
        showToast(err.message || 'Erro ao analisar o vídeo.');
    } finally {
        loader.classList.remove('visible');
        btn.disabled = false;
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

    status.classList.add('visible');
    btn.disabled = true;

    const a = document.createElement('a');
    a.href = `${API_BASE}/download?url=${encodeURIComponent(currentUrl)}&quality=${quality}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Reabilita após alguns segundos (download continua em segundo plano)
    setTimeout(() => {
        status.classList.remove('visible');
        btn.disabled = false;
    }, 4000);
}

// ─── Enter no input dispara conversão ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('urlInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') analyzeVideo();
    });
});
