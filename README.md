# Audiofy - Conversor de Vídeos para MP3

Um site moderno e rápido que converte vídeos do YouTube e TikTok para MP3 de alta qualidade.

## 🚀 Características

- ✨ Interface moderna e responsiva
- 🎵 Suporte para YouTube e TikTok
- 📊 Qualidade de áudio até 320 kbps
- ⚡ Conversão rápida e sem anúncios
- 🔒 Sem necessidade de cadastro
- 📱 Funciona em dispositivos móveis

## 📋 Pré-requisitos

- Node.js 14+ instalado
- npm ou yarn
- `yt-dlp` instalado no sistema (necessário para conversão)

### Instalando yt-dlp

**No Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install yt-dlp
```

**No macOS (com Homebrew):**
```bash
brew install yt-dlp
```

**No Windows:**
```bash
pip install yt-dlp
```

## 🔧 Instalação

1. Clone ou extraia o projeto:
```bash
cd audiofy-project
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor:
```bash
npm start
```

O servidor rodará em `http://localhost:3000`

## 🎯 Como Usar

1. Abra o navegador e acesse `http://localhost:3000`
2. Cole o link de um vídeo do YouTube ou TikTok
3. Clique em "Converter"
4. Selecione a qualidade desejada (128, 192 ou 320 kbps)
5. Clique em "Baixar MP3"

## 🔐 Segurança

- CORS configurado para aceitar apenas requisições de localhost em desenvolvimento
- Rate limiting implementado (máximo 10 requisições por 15 minutos)
- Validação de URLs no frontend e backend
- Apenas YouTube e TikTok são permitidos

## 📦 Dependências

- **express**: Framework web
- **cors**: Middleware para CORS
- **yt-dlp-exec**: Wrapper para yt-dlp
- **express-rate-limit**: Rate limiting

## 🐛 Correções Implementadas

Este projeto foi corrigido para resolver os seguintes problemas:

1. **CORS restritivo**: Agora aceita localhost em desenvolvimento
2. **Classes CSS**: Corrigidas as classes `.visible` e `.hidden` para loader e card
3. **Tratamento de imagens**: Melhorado o fallback para thumbnails que não carregam
4. **Validação de URL**: Implementada validação robusta no frontend e backend
5. **Tratamento de erros**: Melhorado com mensagens de erro mais claras

## 🚀 Deploy em Produção

Para fazer deploy no Render ou outro serviço:

1. Configure a variável de ambiente `FRONTEND_ORIGIN` com o domínio do seu site
2. Configure `NODE_ENV=production`
3. Certifique-se de que `yt-dlp` está instalado no servidor

Exemplo para Render:
```
FRONTEND_ORIGIN=https://seu-dominio.onrender.com
NODE_ENV=production
```

## 📝 Licença

Use com responsabilidade e respeite os direitos autorais.

## ⚠️ Aviso Legal

Este projeto é fornecido "como está". O usuário é responsável por respeitar os direitos autorais e os termos de serviço das plataformas (YouTube e TikTok).
