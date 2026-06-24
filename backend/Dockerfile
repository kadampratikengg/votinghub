FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production


RUN addgroup -S appgroup && adduser -S appuser -G appgroup


COPY package*.json ./


RUN npm ci --omit=dev


COPY . .


RUN chown -R appuser:appgroup /app


RUN apk add --no-cache curl


USER appuser


EXPOSE 5000


HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
CMD curl -f http://localhost:5000/ || exit 1


CMD ["node","server.js"]