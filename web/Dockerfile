# --- Etapa 1: construir la app de React ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# --- Etapa 2: servir los archivos ya construidos ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# --- Etapa 1: construir la app de React ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# --- Etapa 2: servir los archivos ya construidos ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80   