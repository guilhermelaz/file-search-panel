# Deploy VPS - Docker Manual

## Requisitos
- Docker 20.10+
- VPS com pelo menos 512MB RAM (recomendado 1GB)
- Porta 3000 disponível

## Deploy Simples (apenas Dockerfile)

### 1. Envie os arquivos para a VPS

Opção A - Git clone:
```bash
git clone <seu-repo>
cd my-app
```

Opção B - SCP/rsync da sua máquina local:
```bash
rsync -avz --exclude 'node_modules' --exclude '.next' ./my-app/ user@seu-vps:/opt/rag-app/
ssh user@seu-vps
cd /opt/rag-app
```

### 2. Configure as variáveis de ambiente
```bash
cp .env.example .env
nano .env  # ou vim .env
```

Edite o `.env`:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sua_senha_segura_aqui
DATABASE_URL=file:./data/dev.db
```

### 3. Build e Run

```bash
# Build da imagem (pode demorar alguns minutos)
docker build -t rag-manager .

# Run com volume para persistir dados
mkdir -p data

docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  --name rag-manager \
  --restart unless-stopped \
  rag-manager
```

### 4. Verifique se funcionou
```bash
# Ver logs
docker logs -f rag-manager

# Deve mostrar:
# [START] Ensuring data directory exists...
# [START] Running Prisma migrations...
# [START] Starting Next.js server...
# Ready on http://localhost:3000
```

### 5. Acesse
```
http://seu-ip:3000
```

---

## Comandos úteis

```bash
# Ver status
docker ps

# Ver logs
docker logs rag-manager
docker logs -f rag-manager  # follow

# Parar
docker stop rag-manager

# Remover container
docker rm -f rag-manager

# Restart
docker restart rag-manager

# Atualizar (após git pull ou alterações)
docker rm -f rag-manager
docker build --no-cache -t rag-manager .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env --name rag-manager --restart unless-stopped rag-manager

# Entrar no container
docker exec -it rag-manager sh

# Backup do banco SQLite
docker exec rag-manager cat /app/data/dev.db > backup-$(date +%Y%m%d).db

# Ver versão do Prisma no container
docker exec rag-manager npx prisma --version
```

---

## Com Docker Compose (alternativa)

Se preferir usar compose:

```bash
# Crie o arquivo .env
cp .env.example .env
# Edite o .env

# Suba o serviço
docker compose up -d --build

# Ver logs
docker compose logs -f
```

---

## Troubleshooting

### Porta 3000 ocupada
```bash
# Ver o que está usando a porta
lsof -i :3000
docker ps | grep 3000

# Use outra porta (ex: 3001)
docker run -d -p 3001:3000 -v $(pwd)/data:/app/data --env-file .env --name rag-manager --restart unless-stopped rag-manager
```

### Erro de permissão no data/
```bash
# Ajuste permissões
chmod 777 data
docker restart rag-manager
```

### Limpar tudo e recomeçar
```bash
docker stop rag-manager
docker rm -f rag-manager
docker rmi rag-manager
rm -rf data/
mkdir data
# Refaça o build e run
```

---

## Segurança

- Troque a senha padrão `ADMIN_PASSWORD`
- Configure firewall: `ufw allow 3000/tcp` (ou porta que escolheu)
- Use HTTPS via reverse proxy (nginx/caddy/traefik)
- Faça backups regulares do diretório `data/`
