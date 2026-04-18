const express = require('express');
const cors = require('cors');
const ytdlp = require('yt-dlp-exec');
const rateLimit = require('express-rate-limit');
const path = require('path');
const app = express();

// ─── CORS restrito ao domínio do Render ──────────────────────────────────────
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://audiofy-7dmg.onrender.com';

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// ─── Serve o index.html e script.js como site estático ───────────────────────
app.use(express.static(path.join(__dirname)));

// ─── Rate limit aplicado em ambos os endpoints ───────────────────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Muitas solicitações. Tente novamente mais tarde.' }
});

// ─── Valida se URL pertence ao YouTube ou TikTok ─────────────────────────────
function isAllowedUrl(url) {
    try {
        const parsed = new URL(url);
        const allowed = ['youtube.com', 'youtu.be', 'www.youtube.com', 'tiktok.com', 'www.tiktok.com'];
        return allowed.some(domain => parsed.hostname === domain);
    } catch {
        return false;
    }
}

// ─── Endpoint: informações do vídeo ──────────────────────────────────────────
app.get('/api/info', apiLimiter, async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'URL é obrigatória.' });
    }

    if (!isAllowedUrl(videoUrl)) {
        return res.status(400).json({ error: 'Apenas links do YouTube e TikTok são permitidos.' });
    }

    try {
        const info = await ytdlp(videoUrl, {
            dumpSingleJson: true,
        });

        res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            durationSeconds: Math.floor(info.duration),
            id: info.id
        });

    } catch (err) {
        console.error('[/api/info]', err.message);
        res.status(500).json({ error: 'Erro ao analisar o vídeo. Verifique o link.' });
    }
});

// ─── Endpoint: download de áudio em stream ───────────────────────────────────
app.get('/api/download', apiLimiter, async (req, res) => {
    const { url, quality = '192' } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL é obrigatória.' });
    }

    if (!isAllowedUrl(url)) {
        return res.status(400).json({ error: 'Apenas links do YouTube e TikTok são permitidos.' });
    }

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

        proc.stdout.pipe(res);

        proc.on('error', (err) => {
            console.error('[/api/download] erro no processo:', err.message);
            if (!res.headersSent) {
                res.status(500).end();
            } else {
                res.end();
            }
        });

        req.on('close', () => {
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

// ─── Inicia o servidor ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Audiofy rodando na porta ${PORT}`));
