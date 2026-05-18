# Deploy

App é um cliente puro da Google File Search API — sem banco de dados, sem volume.

## Requisitos
- Docker 20.10+
- Chave da API Google AI Studio: https://aistudio.google.com/apikey

## Variáveis de ambiente

Crie um arquivo `.env`:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sua_senha_segura
SESSION_SECRET=$(openssl rand -hex 32)
GOOGLE_API_KEY=AIza...
```

## Deploy com Docker

```bash
# Build
docker build -t rag-manager .

# Run
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name rag-manager \
  --restart unless-stopped \
  rag-manager

# Ver logs
docker logs -f rag-manager
```

Acesse `http://seu-ip:3000`.

## Deploy com Docker Compose

```bash
docker compose up -d --build
docker compose logs -f
```

## Atualizar

```bash
git pull
docker compose up -d --build
# ou:
docker rm -f rag-manager
docker build --no-cache -t rag-manager .
docker run -d -p 3000:3000 --env-file .env --name rag-manager --restart unless-stopped rag-manager
```

## EasyPanel

1. App → New Service → App
2. Source: GitHub do projeto
3. Build: Dockerfile
4. Environment: cole todas as variáveis do `.env`
5. Domains: configure seu domínio (HTTPS automático via Traefik)

## Rotas

- `GET  /api/file-stores` — lista stores (do Google)
- `POST /api/file-stores` — cria store no Google
- `DELETE /api/file-stores/:id` — deleta store no Google (com `force=true`)
- `GET  /api/files?storeId=xxx` — lista documentos do store
- `POST /api/files` — upload arquivo + metadados
- `DELETE /api/files/:id?storeId=xxx` — deleta documento
- `POST /api/chat` — chat RAG via `generateContent` + tool `file_search`
- `GET  /api/health` — testa conexão com a API

## Observações

- Nenhum dado é armazenado localmente. Todo estado vem da API Google em tempo real.
- Sessão é cookie HMAC assinado com `SESSION_SECRET` (sem persistência server-side).
- Se mudar `SESSION_SECRET` ou `ADMIN_PASSWORD`, todas as sessões são invalidadas.
