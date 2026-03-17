# Secretário Escolar

App web que integra **Google Classroom API** e **Anthropic Claude API** para ajudar estudantes a organizar e priorizar suas atividades escolares com suporte de IA.

## Funcionalidades

- Login com Google OAuth 2.0 (Google Classroom)
- Dashboard com contadores: turmas ativas, atividades pendentes, urgentes (≤ 3 dias) e entregues
- Análise automática de prioridades via Claude AI
- Alerta destacado para atividades com prazo próximo
- Lista de atividades ordenada por prazo com status colorido
- Botão "IA" em cada atividade para dicas e orientações detalhadas

## Stack

- React 18 + Vite 5
- Google Identity Services (GSI) — OAuth client-side
- Google Classroom REST API
- Anthropic Claude API (`claude-sonnet-4-20250514`)
- CSS-in-JS inline (zero dependências externas de UI)

## Pré-requisitos

- Node.js 18+
- Conta Google com turmas no Google Classroom
- Google Cloud Project com Classroom API habilitada
- API Key da Anthropic

---

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas chaves:

```env
VITE_GOOGLE_CLIENT_ID=seu_google_client_id_aqui
VITE_ANTHROPIC_API_KEY=sua_anthropic_api_key_aqui
```

### 3. Configurar Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie ou selecione um projeto
3. Ative a **Google Classroom API** em *APIs e Serviços → Biblioteca*
4. Em *APIs e Serviços → Credenciais*, crie um **OAuth 2.0 Client ID** do tipo **Aplicativo da Web**
5. Em **Origens JavaScript autorizadas**, adicione:
   - `http://localhost:5173` (desenvolvimento)
   - Seu domínio de produção (se aplicável)
6. Copie o **Client ID** para `VITE_GOOGLE_CLIENT_ID`

> Tela de consentimento OAuth: configure em *APIs e Serviços → Tela de consentimento OAuth*.
> Durante o desenvolvimento, adicione seu e-mail como "usuário de teste".

### 4. Configurar Anthropic

1. Acesse [console.anthropic.com](https://console.anthropic.com/)
2. Gere uma API Key
3. Cole em `VITE_ANTHROPIC_API_KEY`

> **Nota de segurança:** Esta aplicação chama a Anthropic API diretamente do browser (sem backend).
> A API key ficará exposta no cliente. Use apenas para desenvolvimento ou em ambientes controlados.
> Para produção, roteie as chamadas por um backend próprio.

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:5173`.

### 6. Build de produção

```bash
npm run build
npm run preview
```

---

## Estrutura de arquivos

```
secretario-escolar/
├── index.html
├── vite.config.js
├── package.json
├── .env.example
├── .env                      ← criado por você, não versionar
└── src/
    ├── main.jsx
    ├── App.jsx               ← componente principal + telas
    ├── hooks/
    │   ├── useClassroom.js   ← auth Google + fetch Classroom API
    │   └── useClaudeAI.js    ← chamadas à Claude API
    └── components/
        └── TaskCard.jsx      ← card de atividade + modal IA
```

## Escopos OAuth utilizados

| Escopo | Finalidade |
|--------|-----------|
| `classroom.courses.readonly` | Listar turmas ativas |
| `classroom.coursework.me.readonly` | Listar atividades |
| `classroom.announcements.readonly` | Leitura de anúncios |

---

## Solução de problemas

**"Google Identity Services ainda não carregou"** — aguarde alguns segundos e tente novamente. O script GSI é carregado de forma assíncrona.

**"VITE_ANTHROPIC_API_KEY não configurada"** — verifique se o arquivo `.env` existe e tem a chave correta. Reinicie o servidor de desenvolvimento após editar o `.env`.

**Tela de consentimento OAuth bloqueada** — em fase de teste, adicione seu e-mail como usuário de teste no Google Cloud Console.

**401 da Classroom API** — o token expira após 1 hora. Clique em "Sair" e faça login novamente.
