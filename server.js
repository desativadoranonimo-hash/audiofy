const express = require('express');
const cors = require('cors');
const ytdlp = require('yt-dlp-exec');
const rateLimit = require('express-rate-limit');
const app = express();

// ─── CORREÇÃO: CORS restrito ao seu domínio em produção ──────────────────────
// Em dev, troque pela URL do seu frontend. Em produção, use o domínio real.
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5500';

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// ─── CORREÇÃO: Rate limit aplicado em ambos os endpoints ────────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,
    message: { error: 'Muitas solicitações. Tente novamente mais tarde.' }
});

// ─── CORREÇÃO: Valida se URL pertence ao YouTube ou TikTok ──────────────────
function isAllowedUrl(url) {
    try {
        const parsed = new URL(url);
        const allowed = ['youtube.com', 'youtu.be', 'www.youtube.com', 'tiktok.com', 'www.tiktok.com'];
        return allowed.some(domain => parsed.hostname === domain);
    } catch {
        return false;
    }
}

// ─── CORREÇÃO: Formata segundos → HH:MM:SS ou MM:SS ─────────────────────────
// A lógica anterior retornava "90:00" em vez de "1:30:00" para vídeos longos.
// Agora enviamos os segundos brutos ao frontend, que formata corretamente.
// (Mantido aqui como utilitário caso precise exibir no log do servidor)
function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Endpoint: informações do vídeo ─────────────────────────────────────────
app.get('/api/info', apiLimiter, async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'URL é obrigatória.' });
    }

    // CORREÇÃO: rejeita URLs que não sejam do YouTube ou TikTok
    if (!isAllowedUrl(videoUrl)) {
        return res.status(400).json({ error: 'Apenas links do YouTube e TikTok são permitidos.' });
    }

    try {
        const info = await ytdlp(videoUrl, {
            dumpSingleJson: true,
            // CORREÇÃO: removido noCheckCertificates — desabilitar SSL abre brecha de segurança
        });

        res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            // CORREÇÃO: enviamos os segundos brutos; o frontend formata corretamente
            durationSeconds: Math.floor(info.duration),
            id: info.id
        });

    } catch (err) {
        console.error('[/api/info]', err.message);
        res.status(500).json({ error: 'Erro ao analisar o vídeo. Verifique o link.' });
    }
});

// ─── Endpoint: download de áudio em stream ──────────────────────────────────
// CORREÇÃO: rate limit adicionado (estava ausente, deixando o endpoint sem proteção)
app.get('/api/download', apiLimiter, async (req, res) => {
    const { url, quality = '192' } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL é obrigatória.' });
    }

    // CORREÇÃO: mesma validação de URL aplicada aqui
    if (!isAllowedUrl(url)) {
        return res.status(400).json({ error: 'Apenas links do YouTube e TikTok são permitidos.' });
    }

    // Qualidades permitidas para evitar injeção de parâmetros
    const allowedQualities = ['128', '192', '320'];
    const safeQuality = allowedQualities.includes(quality) ? quality : '192';

    res.header('Content-Disposition', 'attachment; filename="audiofy_download.mp3"');
    res.header('Content-Type', 'audio/mpeg');

    try {
        const proc = ytdlp.exec(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: safeQuality,
            output: '-',
        });

        // CORREÇÃO: trata erros no stream sem tentar re-enviar headers (já foram enviados)
        proc.stdout.pipe(res);

        proc.on('error', (err) => {
            console.error('[/api/download] erro no processo:', err.message);
            // Headers já enviados; encerra a conexão para o cliente perceber o erro
            if (!res.headersSent) {
                res.status(500).end();
            } else {
                res.end();
            }
        });

        req.on('close', () => {
            // Cliente cancelou o download — mata o processo para não desperdiçar recursos
            if (proc && proc.kill) proc.kill('SIGTERM');
        });

    } catch (err) {
        console.error('[/api/download]', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erro ao processar o download.' });
        } else {
            res.end();
        }
    }
});

// ─── Inicia o servidor ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Audiofy rodando na porta ${PORT}`));
