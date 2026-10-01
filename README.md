# Company Password Vault

A full-stack, role-based password management application for organizations.

## Tech Stack

| Layer    | Technology                         |
| -------- | ---------------------------------- |
| Frontend | React 18 · Vite · Tailwind CSS v3 |
| Backend  | Node.js · Express                  |
| Database | MongoDB · Mongoose ODM             |

## Project Structure

```
company-password-vault/
├── client/          # React + Vite frontend
│   ├── src/
│   │   ├── pages/   # Route pages (Home, Login, Dashboard, 404)
│   │   ├── App.jsx  # Root component with React Router
│   │   └── main.jsx # Entry point
│   └── ...
├── server/          # Express backend
│   └── src/
│       ├── config/  # Database config
│       ├── routes/  # API routes
│       └── server.js
├── .env.example     # Environment variable template
└── README.md
```

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB (local or Atlas)

### 1. Clone & configure environment

```bash
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

### 2. Start the server

```bash
cd server
npm install
npm run dev
```

### 3. Start the client

```bash
cd client
npm install
npm run dev
```

The client runs on `http://localhost:5173` and proxies API requests to `http://localhost:5000`.

### 4. Verify

Open `http://localhost:5173` — the home page shows a live API health status indicator.

You can also test the API directly:

```bash
curl http://localhost:5000/api/health
```
