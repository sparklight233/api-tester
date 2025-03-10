# 构建阶段
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 生产阶段
FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/backend ./backend
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
# 创建上传目录
RUN mkdir -p uploads
EXPOSE 5000
CMD ["node", "backend/server.js"]