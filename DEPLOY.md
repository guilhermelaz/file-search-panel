# Deploy VPS com Docker

## Requisitos
- Docker 20.10+
- Docker Compose 2.0+
- VPS com pelo menos 512MB RAM (recomendado 1GB)

## Deploy com Docker Compose

### 1. Clone o repositório na VPS
```bash
git clone <seu-repo>
cd my-app
```

### 2. Configure as variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

Exemplo de `.env`:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sua_senha_segura
DATABASE_URL=file:./data/dev.db
```

### 3. Build e start
```bash
docker compose up -d --build
```

### 4. Verifique os logs
```bash
docker compose logs -f
```

### 5. Acesse
```
http://seu-ip:3000
```

## Comandos úteis

```bash
# Stop
docker compose down

# Restart
docker compose restart

# Ver logs
docker compose logs -f

# Atualizar (após git pull)
docker compose up -d --build

# Backup do banco SQLite
docker compose exec app tar -czf - /app/data > backup-$(date +%Y%m%d).tar.gz
```

## Segurança

- Use senha forte para `ADMIN_PASSWORD`
- Configure firewall (porta 3000 ou reverse proxy com nginx)
- Use HTTPS via reverse proxy (nginx/caddy)
- Faça backups regulares do diretório `data/`

## Docker apenas (sem compose)

```bash
# Build
docker build -t rag-manager .

# Run com volume para persistir dados
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=sua_senha \
  --name rag-manager \
  rag-manager
```
