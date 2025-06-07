# SMS Marketing Development Environment

This project relies on Node.js and Docker for local development. Follow these steps to get a local instance running.

## Prerequisites
- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) with Compose support

## Setup
1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Database migration**

   The project uses Drizzle ORM. To apply the schema to the local Postgres container, run:

   ```bash
   npm run db:push
   ```

3. **Development server**

   Start the dev server with:

   ```bash
   npm run dev
   ```

   The Vite dev server runs inside the container and forwards port `5001` on your host to port `5000` in the container.
   Open `http://localhost:5001` in your browser to view the app.

4. **Production build**

   To create a production build and start it locally:

   ```bash
   npm run build
   npm start
   ```

## Devcontainer

If you use VS Code with the Dev Containers extension, the provided `.devcontainer` setup will automatically start the app and database services. The compose file maps port `5000` inside the container to `5001` on your host so it doesn't conflict with other services.


## Troubleshooting

If the devcontainer fails to start and Docker reports that port 5000 is already in use, you may have an old container still running with the previous port mapping. Remove it and try again:

```bash
docker compose -f .devcontainer/docker-compose.yml down
```

Then reopen the dev container so it can recreate the services with the updated mapping of host port 5001 to container port 5000.