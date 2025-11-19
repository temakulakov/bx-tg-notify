# Базовый образ
FROM node:20-alpine

# Устанавливаем curl для healthcheck
RUN apk add --no-cache curl

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем исходники
COPY . .

# Компилируем проект (для продакшена)
RUN npm run build

# Открываем порт (значение будет переопределено docker-compose)
EXPOSE 3000

# По умолчанию запускаем prod версию
CMD ["node", "dist/main.js"]
