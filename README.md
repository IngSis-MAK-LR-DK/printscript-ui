# Printscript UI

This is a React project using Vite and Node.js 20. This README will guide you on how to set up and start the project locally.

## Prerequisites

Before you begin, ensure you have met the following requirements:

- You have installed Node.js 20 or later
- You have installed npm

## Getting Started

To get a local copy up and running, follow these steps:

### 1. Fork this Repository in your github account

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/printscript-ui.git
```

###  3. Navigate to the Project Directory
```bash
cd printscript-ui
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Start the Development Server

```bash
npm run dev
```

This will start the Vite development server. You can now open your browser and navigate to http://localhost:5173/ to see the application running.

## Build production version

To use this UI in production you should use an optimized and static version, this command will generate this version in `dist` directory:  

```bash
npm run build
```

## Cypress

To start cypress, make sure that the UI is running and enter: 

```bash
npm run cypress
```

## Configuration

The UI logs in with Auth0 and talks to the snippet handler. Both are configured **at runtime**, so
the same Docker image works in every environment (dev, prod): nothing environment-specific is baked
into the build.

| Docker env var | `npm run dev` (`.env`) | What it is |
|---|---|---|
| `AUTH0_DOMAIN` | `VITE_AUTH0_DOMAIN` | Tenant domain, without `https://` |
| `AUTH0_CLIENT_ID` | `VITE_AUTH0_CLIENT_ID` | Client ID of the Auth0 *Single Page Application* |
| `AUTH0_AUDIENCE` | `VITE_AUTH0_AUDIENCE` | Identifier of the `snippet-searcher` API |
| `BACKEND_URL` | `VITE_BACKEND_URL` | Public URL of the snippet handler, without trailing slash |

For local development create a `.env` file with the `VITE_*` variables (`VITE_BACKEND_URL` defaults
to `http://localhost:8080`).

With Docker, pass the first column; the container refuses to start if one is missing:

```bash
docker run -p 80:80 \
  -e AUTH0_DOMAIN=<tenant>.us.auth0.com -e AUTH0_CLIENT_ID=<client_id> \
  -e AUTH0_AUDIENCE=<api_identifier> -e BACKEND_URL=http://localhost:8080 \
  ghcr.io/ingsis-mak-lr-dk/printscript-ui:latest
```

At startup `docker-entrypoint.d/40-runtime-config.sh` writes `/config.js` from those variables, and
`src/config.ts` reads it. None of them is a secret: they end up in the JavaScript the browser downloads.

The URL where the UI is served must be listed in the Auth0 application as an allowed callback URL,
logout URL and web origin.

If you get a 401 loop when getting the token:
* Change application type in Auth0 to "Regular Web Application"
* In Application Settings > Credentials > "Authentication Method" select "None"

## Start working

1. Fork the Project
2. Do your magic

## Contributing

1. Create your Feature Branch in this repo (git checkout -b feature/AmazingFeature)
2. Commit your Changes (git commit -m 'Add some AmazingFeature')
3. Push to the Branch (git push origin feature/AmazingFeature)
4. Open a Pull Request

## Tasks

- [ ] Integrate Auth0 UI and private routes
- [ ] Integrate your endpoints to the UI (Create custom "SnippetOperations")
- [ ] Dockerize
- [ ] CI/CD
- [ ] Sockets*