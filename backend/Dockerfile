FROM node:20-alpine AS base

WORKDIR /app

# Set production env by default in the image
ENV NODE_ENV=production

# create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

COPY . .

# Ensure correct ownership
RUN chown -R appuser:appgroup /app

# Install small runtime tools used by healthchecks
RUN apk add --no-cache curl

USER appuser

EXPOSE 5000

# Basic container-level healthcheck (k8s probes preferred)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
	CMD curl -f http://localhost:5000/ || exit 1

CMD ["node", "server.js"]