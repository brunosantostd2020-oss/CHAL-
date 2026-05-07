# 🌿 Chalé Gratitude — Sistema de Reservas

Site completo com checkout, calendário de disponibilidade, painel admin e banco de dados SQLite rodando em Node.js.

---

## 🚀 Deploy no Railway (passo a passo)

### 1. Suba o projeto no GitHub

No CMD / Terminal, dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "feat: Chalé Gratitude sistema de reservas"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gratitude-chale.git
git push -u origin main
```

---

### 2. Crie o projeto no Railway

1. Acesse **[railway.app](https://railway.app)** e faça login com o GitHub
2. Clique em **"New Project"**
3. Escolha **"Deploy from GitHub repo"**
4. Selecione o repositório `gratitude-chale`
5. O Railway detecta automaticamente o Node.js e faz o build

---

### 3. Configure as variáveis de ambiente

No painel do Railway, vá em **Variables** e adicione:

| Variável | Valor |
|----------|-------|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | `coloque_uma_string_longa_e_aleatoria_aqui` |
| `ADMIN_PASSWORD` | `sua_senha_segura` |
| `WHATSAPP_NUMBER` | `5532985003002` |

---

### 4. Adicione um Volume (banco de dados persistente)

> ⚠️ **IMPORTANTE:** Sem volume, os dados são apagados a cada deploy.

1. No painel do Railway, clique em **"+ New"** → **"Volume"**
2. Monte o volume no serviço com o caminho: `/data`
3. No campo **"Mount Path"**, coloque exatamente: `/data`
4. O Railway vai definir `RAILWAY_VOLUME_MOUNT_PATH=/data` automaticamente
5. O banco `chale.db` será salvo em `/data/chale.db` e **nunca será perdido**

---

### 5. Acesse o site

Após o deploy (± 2 minutos), o Railway fornece uma URL como:
```
https://gratitude-chale-production.up.railway.app
```

- **Site público:** `https://sua-url.up.railway.app`
- **Painel Admin:** clique no botão ⚙ Admin (senha configurada em `ADMIN_PASSWORD`)

---

## 💻 Rodar localmente (CMD)

```bash
# 1. Instale as dependências
npm install

# 2. Copie e edite o .env
copy .env.example .env

# 3. Rode o servidor
npm start

# Acesse: http://localhost:3000
```

---

## 📁 Estrutura do projeto

```
gratitude-chale/
├── public/
│   └── index.html        ← Site + Admin (front-end)
├── src/
│   ├── server.js         ← Servidor Express
│   ├── routes.js         ← API REST (14 rotas)
│   └── database.js       ← Banco SQLite
├── data/
│   └── .gitkeep          ← Banco criado aqui automaticamente
├── railway.toml          ← Configuração do Railway
├── nixpacks.toml         ← Build config (compila better-sqlite3)
├── .env.example          ← Modelo de variáveis
├── .gitignore
├── package.json
└── README.md
```

---

## 📡 API REST

### Públicas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check (Railway) |
| GET | `/api/rooms` | Lista acomodações |
| GET | `/api/services` | Lista serviços |
| GET | `/api/price-tiers` | Tabela de preços |
| GET | `/api/availability?start=&end=` | Disponibilidade |
| GET | `/api/blocked-dates` | Datas bloqueadas |
| POST | `/api/reservations` | Cria reserva |
| POST | `/api/auth/login` | Login admin |

### Admin (Bearer Token)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/stats` | Estatísticas |
| GET/PATCH | `/api/admin/reservations` | Reservas |
| GET/PUT | `/api/admin/config` | Configurações |
| POST/PUT/DELETE | `/api/admin/rooms/:id` | Acomodações |
| POST/DELETE | `/api/admin/services/:id` | Serviços |
| POST/DELETE | `/api/admin/price-tiers/:id` | Preços |
| POST/DELETE | `/api/admin/blocked-dates` | Calendário |

---

## 🛠️ Tecnologias

- **Node.js 20** + **Express** — servidor
- **better-sqlite3** — banco SQLite sem servidor externo
- **bcryptjs** — senhas criptografadas
- **jsonwebtoken** — autenticação JWT
- **HTML/CSS/JS puro** — front-end sem framework
