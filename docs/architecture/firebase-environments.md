# Firebase Environments & Deployment Architecture

This document defines the definitive architecture for running Salt across three distinct environments. Adhering to this structure prevents the common "Mixed Content", "CORS", and "Auth Domain" issues.

## 1. The Three Environments

### A. Local Development (Standard)
*   **Environment:** Developer's local machine (`localhost`).
*   **Networking:** Direct TCP/HTTP connections to local emulator ports.
*   **Connection Protocol:** `http://localhost:<port>`

### B. Cloud Workstation (Proxied Development)
*   **Environment:** Google Cloud Workstations, Project IDX, or Gitpod.
*   **Networking:** Served via HTTPS on a public domain. Local ports are not directly exposed; they are accessed via subdomains (e.g., `8080-xyz.dev`) or a reverse proxy.
*   **Constraint:** The browser blocks `http://` requests from an `https://` page (Mixed Content).
*   **Solution:** **The Unified HTTPS Proxy Strategy**. We route traffic through the Vite Development Server (`port 3000`), which then proxies to the backend emulators over `http`.

### C. Production (Live)
*   **Environment:** Firebase Hosting & Cloud Services.
*   **Networking:** Standard Firebase SDK connections to Google's global infrastructure.
*   **Connection Protocol:** `https://firebasestorage.googleapis.com`, `https://firestore.googleapis.com`

---

## 2. Environment Detection & Configuration

The application automatically detects the environment in `backend/firebase.ts` and `backend/firebase-backend.ts`.

### Logic Flow (`backend/firebase.ts`)

1.  **Check Hostname:**
    *   If `localhost` or `127.0.0.1` -> **Local Development**.
    *   If matching regex `/^(\d+)-/` (e.g., `3000-xyz.dev`) -> **Cloud Workstation**.
    *   Else -> **Production**.

### Emulator Connection Strategy

| Service | Local (HTTP) | Cloud Workstation (HTTPS Proxy) | Production |
| :--- | :--- | :--- | :--- |
| **Auth** | `http://localhost:9099` | `https://<site-url>/identitytoolkit...` (Proxied) | Firebase Auth |
| **Firestore** | `localhost:8080` | `https://<site-url>/google.firestore...` (Proxied) | Cloud Firestore |
| **Storage** | `localhost:9199` | `https://<site-url>/v0/b/...` (Proxied) | Cloud Storage |
| **Functions** | `localhost:5001` | `https://<site-url>/<project-id>/...` (Proxied) | Cloud Functions |

---

## 3. The Proxy Layer (Cloud Workstation)

In Cloud Workstation mode, the **Vite Server (`vite.config.ts`)** acts as the API Gateway. It intercepts requests made to the frontend URL and forwards them to the local emulators running inside the container.

### `vite.config.ts` Configuration

```typescript
server: {
  proxy: {
    // Auth
    '/identitytoolkit.googleapis.com': { target: 'http://127.0.0.1:9099', changeOrigin: true },
    '/securetoken.googleapis.com': { target: 'http://127.0.0.1:9099', changeOrigin: true },
    '/emulator/auth': { target: 'http://127.0.0.1:9099', changeOrigin: true },
    
    // Firestore (WebSocket enabled)
    '/google.firestore.v1.Firestore': { target: 'http://127.0.0.1:8080', changeOrigin: true, ws: true },
    
    // Storage
    '/v0': { target: 'http://127.0.0.1:9199', changeOrigin: true },
    
    // Functions
    '/gen-lang-client-0015061880': { target: 'http://127.0.0.1:5001', changeOrigin: true }
  }
}
```

---

## 4. Special Handling: Firebase Storage

Storage is unique because the SDK generates download URLs that point directly to the storage host.

### The Problem
The SDK might generate a URL like `http://9199-xyz.dev/...`. Since the app is on `https://3000-xyz.dev`, the browser blocks this resource load (Mixed Content).

### The Solution (`backend/firebase-backend.ts`)

We bypass the SDK's URL generation for **Uploads** and **Downloads** in dev mode.

#### 1. Image Resolution (`resolveImagePath`)
Instead of `getDownloadURL()`, we manually construct a relative URL that hits the Vite Proxy.
*   **Result:** `/v0/b/<bucket>/o/<path>?alt=media`
*   **Browser Action:** Request to `https://3000-xyz.dev/v0/...` -> Vite Proxy -> `http://localhost:9199/...` (Success).

#### 2. Image Upload (`uploadRecipeImage`)
We manually use `fetch` to POST to the proxy URL.
*   **Crucial Security Step:** The proxy request is "external" to the SDK, so we must manually attach the **Auth Token**.
    ```typescript
    const token = await auth.currentUser?.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
    ```

---

## 5. Security Rules

*   **Firestore:** `firestore.rules` must allow read/write based on `request.auth`.
*   **Storage:** `storage.rules` must allow read/write based on `request.auth`.
*   **Note:** In Cloud Workstation mode, even though the connection is proxied, the Firebase Emulator Suite correctly interprets the `Authorization` header passed by the manual fetch or the proxied SDK request.

## 6. Deployment Checklist

When moving from Dev to Prod:
1.  **Env Vars:** Ensure no `VITE_` variables force dev mode.
2.  **Build:** Run `npm run build`. The `import.meta.env.DEV` check in the code will evaluate to `false`, causing the app to use the standard Firebase SDK methods (Direct connection to Google Cloud).
3.  **Deploy:** `firebase deploy`.
