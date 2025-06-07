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

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in the values for your local setup. The file defines `DATABASE_URL` along with the Twilio credentials used for sending SMS.

   You can create a free account at [Twilio](https://www.twilio.com/). After verifying your phone number, retrieve the **Account SID**, **Auth Token**, and a phone number from the Twilio Console. Add these values to your `.env` file.

3. **Database migration**

   The project uses Drizzle ORM. To apply the schema to the local Postgres container, run:

   ```bash
   npm run db:push
   ```

4. **Development server**

   Start the dev server with:

   ```bash
   npm run dev
   ```

   The Vite dev server runs inside the container and forwards port `5001` on your host to port `5000` in the container.
   Open `http://localhost:5001` in your browser to view the app.

5. **Production build**

   To create a production build and start it locally:

   ```bash
  npm run build
  npm start
  ```

## Authentication

The API uses session-based authentication with Passport's `passport-local` strategy.
You can create an account and log in directly from the web interface. The application now includes `/login` and `/signup` pages that integrate with the `/api/signup` and `/api/login` endpoints.
Once logged in, all other `/api` routes require an authenticated session. You can sign out via the UI or by calling `POST /api/logout`.

## Twilio Webhook Configuration

To receive delivery status updates from Twilio you need to configure a Status Callback URL.

1. Open the Twilio Console and edit your phone number or Messaging Service.
2. Set the **Status Callback URL** to `http://localhost:5001/api/twilio/webhook` when running locally (replace the host when deploying).
3. Choose **HTTP POST** as the request method.

Twilio signs webhook requests using your `TWILIO_AUTH_TOKEN`. Ensure this environment variable is set so the server can verify incoming callbacks.

## Devcontainer

If you use VS Code with the Dev Containers extension, the provided `.devcontainer` setup will automatically start the app and database services. The compose file maps port `5000` inside the container to `5001` on your host so it doesn't conflict with other services.


## Troubleshooting

If the devcontainer fails to start and Docker reports that port 5000 is already in use, you may have an old container still running with the previous port mapping. Remove it and try again:

```bash
docker compose -f .devcontainer/docker-compose.yml down
```

Then reopen the dev container so it can recreate the services with the updated mapping of host port 5001 to container port 5000.
