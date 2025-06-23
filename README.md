# SMS Marketing Development Environment

This project relies on Node.js and Docker for local development. The steps below walk through cloning the repo, configuring your environment and starting the dev server.

## Prerequisites
- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) with Compose support

## Setup
1. **Clone and enter the repository**

   ```bash
   git clone https://github.com/your-org/sms-marketing.git
   cd sms-marketing
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create the `.env` file**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and provide a valid `DATABASE_URL` along with your Twilio
   credentials (`TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`). The
   `SESSION_SECRET` can be any random string.

4. **Start Postgres**

   ```bash
   docker compose -f .devcontainer/docker-compose.yml up -d db
   ```

   This launches a local Postgres container listening on port `5432`.

5. **Run database migrations**

   ```bash
   npm run db:push
   ```

6. **Seed sample data (optional)**

   ```bash
   npm run seed
   ```

   This command also creates a demo business with sample data for testing.
   Use your Clerk account to sign in via Google or magic link.

7. **Start the development server**

   ```bash
   npm run dev
   ```

   The Vite dev server forwards port `5001` on your host to `5000` inside the
   container. Open <http://localhost:5001> in your browser to view the app.

8. **Production build**

   To create a production build and start it locally:

   ```bash
   npm run build
   npm start
   ```

9. **Reset the database**

   Run the reset script from **inside the dev container** to wipe any existing
   data and recreate the schema:

   ```bash
   ./scripts/reset-db.sh [--seed]
   ```

 Pass `--seed` to automatically populate the database with the sample data.

## Server Structure

The `server` directory is organized by responsibility:

```
server/
  config/         - database configuration
  db/             - storage layer and seed/reset scripts
  middlewares/    - Express middleware functions
  routes/         - API route registrations
  services/       - business logic and external integrations
  utils/          - shared utility modules
  index.ts        - application entry point
  vite.ts         - development server setup
```

This layout separates concerns so that adding new features or updating
existing ones is easier to reason about.

## Authentication

Authentication is provided by [Clerk.dev](https://clerk.dev) using Google OAuth or magic links.
The React app is wrapped in `ClerkProvider` and renders Clerk's `<SignIn />` and
`<SignUp />` components. Configure your publishable key by setting
`VITE_CLERK_PUBLISHABLE_KEY` in `.env`.

## Twilio Webhook Configuration

To receive delivery status updates from Twilio you need to configure a Status Callback URL.

1. Open the Twilio Console and edit your phone number or Messaging Service.
2. Set the **Status Callback URL** to `http://localhost:5001/api/twilio/webhook` when running locally (replace the host when deploying).
3. Choose **HTTP POST** as the request method.

Twilio signs webhook requests using your `TWILIO_AUTH_TOKEN`. Ensure this environment variable is set so the server can verify incoming callbacks.

## Coupon Redemption

Coupons can only be redeemed by contacts who actually received them in a campaign.
When calling `POST /api/coupons/:code/redeem`, include the customer's `phoneNumber`.
The server normalizes this number before looking up the contact so formats like
`(555) 123-4567` or `+1 555-123-4567` are accepted.
You may optionally provide a `note` field which will be stored with the
redemption. The server verifies that the contact was part of the campaign's
recipients and records the redemption alongside the contact for auditing purposes.

## Devcontainer

If you use VS Code with the Dev Containers extension, the provided `.devcontainer` setup will automatically start the app and database services. The compose file maps port `5000` inside the container to `5001` on your host so it doesn't conflict with other services.


## Troubleshooting

If the devcontainer fails to start and Docker reports that port 5000 is already in use, you may have an old container still running with the previous port mapping. Remove it (and the data volume) and try again:

```bash
docker compose -f .devcontainer/docker-compose.yml down -v
```

You can run this command inside the dev container now that the Docker CLI is available, or from your host terminal if preferred. Then reopen the dev container so it can recreate the services with the updated mapping of host port 5001 to container port 5000.

## Logging

The server writes JSON logs to `logs/app.log` by default. Set the `LOG_FILE` environment variable to change the path or `LOG_SERVICE_URL` to POST logs to a remote service.
Control verbosity with `LOG_LEVEL` (`error`, `warn`, `info`, or `debug`).
