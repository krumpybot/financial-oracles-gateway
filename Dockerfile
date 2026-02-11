# Multi-service Dockerfile for Financial Oracles Gateway
FROM python:3.12-slim as python-base

# Install Python dependencies for all oracles
RUN pip install --no-cache-dir \
    fastapi uvicorn httpx aiofiles python-dateutil \
    fuzzywuzzy python-Levenshtein aiosqlite slowapi

# SEC Oracle dependencies
RUN pip install --no-cache-dir beautifulsoup4 lxml

# Copy oracle code
COPY --from=oracles /oracles /oracles

# Bun base for gateway
FROM oven/bun:1 as gateway

WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY tsconfig.json ./

# Final multi-process image
FROM python:3.12-slim

# Install bun
RUN apt-get update && apt-get install -y curl unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy gateway
COPY --from=gateway /app ./gateway

# Copy oracles
COPY ../skills/public/sec-oracle/scripts ./sec-oracle
COPY ../skills/public/sanctions-oracle/scripts ./sanctions-oracle
COPY ../skills/public/perp-dex-agent/scripts ./perp-dex

# Install Python deps
RUN pip install --no-cache-dir \
    fastapi uvicorn httpx aiofiles python-dateutil \
    fuzzywuzzy python-Levenshtein aiosqlite slowapi \
    beautifulsoup4 lxml

# Start script
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 3000 8001 8002

CMD ["./start.sh"]
