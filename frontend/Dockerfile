FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# For devops/Docker setup, we use the development server for simplicity,
# but for true prod you would build and serve the static files via nginx.
CMD ["npm", "start"]
