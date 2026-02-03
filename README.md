# SALT - Kitchen Systems

A minimalist technical culinary orchestrator for recipe and kitchen equipment management, integrated with Gemini AI.

## 🛠 Local Development Setup

Follow these steps to run the Salt system in your local environment using the **Simulated Backend** (localStorage).

### 1. Prerequisites
- **Node.js**: v18.0 or higher.
- **npm**: v9.0 or higher.
- **Gemini API Key**: Obtain a key from [Google AI Studio](https://aistudio.google.com/).

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Configuration
Copy the example environment file and add your Gemini API key:
```bash
cp .env.example .env
```
Edit `.env` and set:
`VITE_GEMINI_API_KEY=your_actual_key_here`

### 4. Run the Application
Start the Vite development server:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

---

## 💾 The Simulated Backend
By default, Salt uses the `SaltSimulatedBackend` (defined in `backend/api.ts`).
- **Persistence**: Data is stored in your browser's `localStorage`.
- **Authentication**: Uses a hardcoded session check. Use `daniel@salt.uk` or `chef@salt.kitchen` to log in during development.
- **AI**: Calls real Gemini models for recipe generation and technical equipment extraction.

### Data Portability
Use the **"Export Backup"** button in the sidebar to save your kitchen state as a JSON manifest. This allows you to transfer data between local and hosted environments.

---

## 🚀 Moving to Firebase
If you wish to move from simulation to a cloud environment, refer to the `migration-roadmap.md` for the phased implementation of `SaltFirebaseBackend`.

## 📜 System Guidelines
Salt is built on a strict "Constitution". Refer to these files before making structural changes:
- `guidelines.md`: Global architectural rules.
- `frontend-guidelines.md`: UI/UX standards (British English / Metric).
- `backend-guidelines.md`: AI orchestration and contract implementation.
- `recipe-module-guidelines.md`: Domain logic for the Recipe engine.

---
**v0.1.0-alpha** | Technical Culinary Orchestrator