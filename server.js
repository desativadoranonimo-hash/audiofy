const express = require('express');
const cors = require('cors');
const ytdlp = require('yt-dlp-exec');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const os = require('os');
const app = express();

// ─── CORS configurado para desenvolvimento e produção ──────────────────────────
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(cors({ 
  origin: isDevelopment ? true : (process.env.FRONTEND_ORIGIN || 'https://audiofy-7dmg.onrender.com'),
  credentials: true
}));
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
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            socketTimeout: 30
        });

        res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            durationSeconds: Math.floor(info.duration),
            id: info.id
        });

    } catch (err) {
        console.error('[/api/info]', err.message);
        
        // Mensagem de erro específica para proteção do YouTube
        if (err.message.includes('Sign in to confirm')) {
            return res.status(403).json({ error: 'Este vídeo está protegido pelo YouTube. Tente outro vídeo.' });
        }
        
        res.status(500).json({ error: 'Erro ao analisar o vídeo. Verifique o link.' });
    }
});

// ─── Endpoint: download de áudio com conversão correta ───────────────────────
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
        // Criar arquivo temporário
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `audiofy_${Date.now()}_%(title)s.%(ext)s`);
        const audioFile = path.join(tempDir, `audiofy_${Date.now()}.m4a`);
        const mp3File = path.join(tempDir, `audiofy_${Date.now()}.mp3`);

        // Passo 1: Baixar apenas o áudio com yt-dlp
        const downloadProc = spawn('yt-dlp', [
            url,
            '-f', 'bestaudio',
            '--extract-audio',
            '--audio-format', 'm4a',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            '--socket-timeout', '30',
            '-o', audioFile
        ]);

        downloadProc.on('close', (code) => {
            if (code !== 0) {
                console.error(`[/api/download] yt-dlp falhou com código ${code}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Erro ao baixar o áudio.' });
                }
                // Limpar arquivos temporários
                try { fs.unlinkSync(audioFile); } catch (e) {}
                try { fs.unlinkSync(mp3File); } catch (e) {}
                return;
            }

            // Passo 2: Converter para MP3 com ffmpeg
            const ffmpegArgs = [
                '-i', audioFile,
                '-q:a', '0',
                '-map', 'a',
                mp3File
            ];

            const convertProc = spawn('ffmpeg', ffmpegArgs);

            convertProc.on('close', (code) => {
                if (code !== 0) {
                    console.error(`[/api/download] ffmpeg falhou com código ${code}`);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Erro ao converter para MP3.' });
                    }
                    // Limpar arquivos temporários
                    try { fs.unlinkSync(audioFile); } catch (e) {}
                    try { fs.unlinkSync(mp3File); } catch (e) {}
                    return;
                }

                // Passo 3: Enviar o arquivo MP3
                try {
                    const fileStream = fs.createReadStream(mp3File);
                    fileStream.pipe(res);

                    fileStream.on('end', () => {
                        // Limpar arquivos temporários após envio
                        try { fs.unlinkSync(audioFile); } catch (e) {}
                        try { fs.unlinkSync(mp3File); } catch (e) {}
                    });

                    fileStream.on('error', (err) => {
                        console.error('[/api/download] erro ao enviar arquivo:', err.message);
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'Erro ao enviar arquivo.' });
                        }
                        // Limpar arquivos temporários
                        try { fs.unlinkSync(audioFile); } catch (e) {}
                        try { fs.unlinkSync(mp3File); } catch (e) {}
                    });
                } catch (err) {
                    console.error('[/api/download] erro ao ler arquivo:', err.message);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Erro ao processar arquivo.' });
                    }
                    // Limpar arquivos temporários
                    try { fs.unlinkSync(audioFile); } catch (e) {}
                    try { fs.unlinkSync(mp3File); } catch (e) {}
                }
            });

            convertProc.stderr.on('data', (data) => {
                console.error('[ffmpeg stderr]:', data.toString());
            });
        });

        downloadProc.stderr.on('data', (data) => {
            console.error('[yt-dlp stderr]:', data.toString());
        });

        // Limpar se cliente desconectar
        req.on('close', () => {
            try { fs.unlinkSync(audioFile); } catch (e) {}
            try { fs.unlinkSync(mp3File); } catch (e) {}
        });

    } catch (err) {
        console.error('[/api/download]', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erro ao processar o download.' });
        }
    }
});

// ─── Inicia o servidor ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Audiofy rodando na porta ${PORT}`);
  console.log(`Modo: ${isDevelopment ? 'DESENVOLVIMENTO (CORS aberto)' : 'PRODUCAO'}`);
});
