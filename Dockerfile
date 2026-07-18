FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["python3", "server.py"]
