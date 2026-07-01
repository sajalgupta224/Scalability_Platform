# RAISE Project - Setup Guide

A step-by-step guide to install dependencies, configure, and run both the **Node.js backend** (Snowflake connection) and the **React frontend**.

---

## Prerequisites

Ensure the following are installed on your machine:

| Tool       | Minimum Version | Check Command      |
| ---------- | --------------- | -------------------|
| Node.js    | >= 18.x         | `node -v`          |
| npm        | >= 9.x          | `npm -v`           |
| Git        | any             | `git --version`    |

---

## 1. Clone the Repository

```bash
git clone <your-repo-url>
cd raise_react
```

The repository has two main directories:

```
raise_react/
├── node/    # Node.js backend (Express + Snowflake)
└── react/   # React frontend (Vite + TypeScript)
```

---

# Part A — Node.js Backend (Snowflake)

The backend is an **Express** server that connects to **Snowflake** using the `snowflake-sdk` driver. It exposes REST APIs consumed by the React frontend.

## A1. Install Backend Dependencies

```bash
cd raise_react/node
npm install
```

Key dependencies:

| Package          | Purpose                                    |
| ---------------- | ------------------------------------------ |
| `express`        | Web framework                              |
| `snowflake-sdk`  | Official Snowflake Node.js driver          |
| `dotenv`         | Loads environment variables from `.env`    |
| `cors`           | Cross-origin resource sharing middleware   |
| `axios`          | HTTP client (used for Snowflake agent APIs)|
| `pdf-lib`        | PDF generation/manipulation                |

---

## A2. Configure Backend Environment Variables

Create a `.env` file inside the `node/` directory:

```env
SNOWFLAKE_USER=<your_snowflake_username>
SNOWFLAKE_PASSWORD=<your_snowflake_password>
SNOWFLAKE_ACCOUNT=<your_account_identifier>
SNOWFLAKE_WAREHOUSE=<your_warehouse>
SNOWFLAKE_DATABASE=<your_database>
SNOWFLAKE_SCHEMA=<your_schema>
PORT=5000
```

| Variable               | Description                                      | Example                          |
| ---------------------- | ------------------------------------------------ | -------------------------------- |
| `SNOWFLAKE_USER`       | Snowflake login username                         | `my_user`                        |
| `SNOWFLAKE_PASSWORD`   | Snowflake login password                         | *(keep secret)*                  |
| `SNOWFLAKE_ACCOUNT`    | Account identifier (org-account format)          | `ORGID-ACCOUNT_NAME`             |
| `SNOWFLAKE_WAREHOUSE`  | Warehouse to use for queries                     | `COMPUTE_WH`                     |
| `SNOWFLAKE_DATABASE`   | Default database                                 | `MY_DB`                          |
| `SNOWFLAKE_SCHEMA`     | Default schema                                   | `PUBLIC`                         |
| `PORT`                 | Port the Express server listens on               | `5000`                           |

> **Note:** Never commit `.env` files containing real credentials to version control.

---

## A3. Snowflake Connection Details

The connection is established in `node/config/database.js` using the `snowflake-sdk` package:

```javascript
import snowflake from "snowflake-sdk";
import dotenv from "dotenv";

dotenv.config();

const connection = snowflake.createConnection({
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USER,
  password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA,
});

connection.connect((err, conn) => {
  if (err) {
    console.error("Unable to connect to Snowflake: " + err.message);
  } else {
    console.log("Connected to Snowflake successfully!");
  }
});
```

A helper function `execQuery` is exported for running SQL queries with parameterized binds:

```javascript
export const execQuery = (sqlText, binds = []) => {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, stmt, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      },
    });
  });
};
```

All controllers import `execQuery` from `config/database.js` to execute SQL against Snowflake.

---

## A4. Start the Backend Server

```bash
cd raise_react/node
node server.js
```

On successful startup you should see:

```
Connected to Snowflake successfully!
Server running on port 5000
```


## A5. Backend Project Structure

```
node/
├── config/
│   └── database.js           # Snowflake connection & execQuery helper
├── controllers/              # Business logic handlers
│   ├── chatbot.controller.js
│   ├── pipeline.controller.js
│   ├── prompt.controller.js
│   ├── snowflake.controller.js
│   ├── snowflakeMeta.controller.js
│   ├── services.controller.js
│   ├── settings.controller.js
│   ├── templates.controller.js
│   └── SemanticView.controller.js
├── routes/                   # Route definitions
│   ├── chatbot.routes.js
│   ├── pipeline.routes.js
│   ├── prompt.routes.js
│   ├── snowflake.routes.js
│   ├── snowflakeMeta.routes.js
│   ├── services.routes.js
│   ├── settings.routes.js
│   ├── templates.routes.js
│   └── SemanticView.routes.js
├── helpers/
│   └── errorLogger.js        # Audit error logging utility
├── docs/
│   └── API_CREATION_GUIDE.md # Guide for creating new API endpoints
├── .env                      # Environment variables (not committed)
├── package.json
└── server.js                 # Main Express server entry point
```

---

# Part B — React Frontend

## B1. Install Frontend Dependencies

```bash
cd raise_react/react
npm install
```

This installs all dependencies listed in `package.json`, including:

- **React 19** with TypeScript
- **Vite 7** (build tool and dev server)
- **MUI v7** (UI component library)
- **Axios** (HTTP client)
- **Recharts** and **D3** (charting)
- **Sass** (SCSS styling)
- ESLint, Prettier, Husky (dev tooling)

---

## B2. Configure Frontend Environment Variables

Create a `.env` file in the `react/` directory (if it doesn't already exist):

```bash
# On macOS/Linux
cp .env.example .env

# On Windows (Command Prompt)
copy .env.example .env
```

If there is no `.env.example`, create `.env` manually with the following content:

```env
VITE_API_BASE_URL=http://localhost:5000
```

| Variable             | Description                         | Default                    |
| -------------------- | ----------------------------------- | -------------------------- |
| `VITE_API_BASE_URL`  | Backend API base URL                | `http://localhost:5000`    |

> **Note:** All Vite environment variables must be prefixed with `VITE_` to be accessible in the browser.

---

## B3. Start the Frontend Development Server

```bash
npm run dev
```

The app will start at **http://localhost:3000**.

The dev server supports hot module replacement (HMR) -- changes to your code are reflected instantly in the browser without a full reload.

---

## B4. Available Scripts

| Command              | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server on port 3000               |
| `npm start`          | Alias for `npm run dev`                              |
| `npm run build`      | Type-check with TypeScript, then build for production|
| `npm run preview`    | Preview the production build locally                 |
| `npm run lint`       | Run ESLint on all `.ts` and `.tsx` files             |
| `npm run lint:fix`   | Run ESLint and auto-fix issues                       |
| `npm run format`     | Format code with Prettier                            |
| `npm test`           | Run tests with Vitest                                |
| `npm run type-check` | Run TypeScript type checking (no emit)               |

---

## B5. Build for Production

```bash
npm run build
```

This runs TypeScript compilation followed by a Vite production build. The output is placed in the `dist/` folder.

To preview the production build locally:

```bash
npm run preview
```

---


## B8. Frontend Project Structure

```
react/
├── public/               # Static assets
├── src/
│   ├── api/              # Axios client, endpoints, error handling
│   ├── assets/           # SVG icons and images
│   ├── components/       # Reusable UI components
│   ├── config/           # Environment config (Zod validation)
│   ├── constants/        # App-wide constants
│   ├── context/          # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── layout/           # Layout wrapper
│   ├── pages/            # Page-level components
│   ├── routes/           # Route definitions
│   ├── styles/           # Global SCSS (variables, mixins, tokens)
│   ├── theme/            # MUI theme configuration
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── App.tsx           # Root component
│   └── main.tsx          # Entry point
├── .env                  # Environment variables
├── .prettierrc           # Prettier config
├── eslint.config.js      # ESLint flat config
├── tsconfig.json         # TypeScript config
├── vite.config.ts        # Vite config
├── Dockerfile            # Docker build
├── nginx.conf            # Nginx production config
└── package.json          # Dependencies and scripts
```

---

# Part C — Running the Full Stack

To run the complete application, start both servers. **The backend must be started first** since the frontend depends on it for all API calls.

1. **Terminal 1 — Start Backend first:**
   ```bash
   cd raise_react/node
   node server.js
   ```
   Wait until you see `Connected to Snowflake successfully!` before proceeding.

2. **Terminal 2 — Then start Frontend:**
   ```bash
   cd raise_react/react
   npm run dev
   ```

The React app at `http://localhost:3000` will make API calls to the Node backend at `http://localhost:5000`.

```
Browser (localhost:3000)  ──HTTP──>  Express/Node (localhost:5000)  ──snowflake-sdk──>  Snowflake
```

---

# Troubleshooting

### Backend: `Unable to connect to Snowflake`

- Verify `.env` values in `node/.env` are correct (account, user, password).
- Check the account identifier format — it should be `ORGID-ACCOUNT_NAME` (with a hyphen, not underscore).
- Ensure the warehouse is not suspended.

### Backend: Port 5000 is already in use

- Change `PORT` in `node/.env`, or kill the process using port 5000.

### Frontend: `npm install` fails

- Ensure you are using Node.js >= 18. Run `node -v` to check.
- Delete `node_modules` and `package-lock.json`, then retry:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```
  On Windows:
  ```cmd
  rmdir /s /q node_modules
  del package-lock.json
  npm install
  ```

### Frontend: Port 3000 is already in use

- Change the port in `vite.config.ts` under `server.port`, or kill the process using port 3000.

### Frontend: Pre-commit hook fails

- Run `npm run lint:fix` and `npm run format` to auto-fix issues before committing.
- Run `npm run type-check` to see TypeScript errors.

### Frontend: Environment variable not accessible in code

- Ensure the variable name starts with `VITE_`.
- Restart the dev server after changing `.env`.
