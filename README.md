> [!WARNING]
> **🚧 Work in Progress** — The frontend and backend are both built and functional, but the project is still being configured and tested. Some features may not work as expected. A stable release is coming soon.

# 🌐 Translat-em: AI Translator Website

A full-stack, AI-powered translation web application built with **FastAPI** and **React**. Translate plain text, documents (PDF), and images (OCR) into 100+ languages powered by a state-of-the-art large language model — all running locally on your machine.

![Tech Stack](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)
![Tech Stack](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=flat-square&logo=react)
![Tech Stack](https://img.shields.io/badge/AI-Advanced%20LLM-4285F4?style=flat-square&logo=google)
![Tech Stack](https://img.shields.io/badge/Database-PostgreSQL%20(Supabase)-336791?style=flat-square&logo=postgresql)
![Tech Stack](https://img.shields.io/badge/Styling-Tailwind%20CSS-38BDF8?style=flat-square&logo=tailwindcss)

---

## ✨ Features

| Feature | Description |
|---|---|
| **Text Translation** | Translate any text into 100+ languages with semantic fidelity |
| **PDF Translation** | Upload a PDF — the app extracts the text and translates it |
| **Image / OCR Translation** | Upload an image with text — OCR extracts it before translating |
| **Auto Language Detection** | Leave source set to "auto" and the AI detects the language |
| **User Authentication** | Secure email/password login with JWT and Google OAuth support |
| **Public Explore Feed** | Browse publicly shared translations with search, filter, and sort |
| **User Profiles** | Personal translation history dashboard with usage stats and account deletion |
| **Visibility Toggle** | Make any translation public or keep it private |
| **Async Processing** | File uploads are processed in the background with a visual progress bar |
| **Smart Model Fallback** | Automatically probes available AI models at startup and uses the best one for your API key |

---

## 🖥️ Tech Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| **FastAPI** | 0.111.1 | REST API framework |
| **Uvicorn** | 0.30.1 | ASGI server |
| **SQLAlchemy** | 2.0.31 | ORM + PostgreSQL database |
| **Pydantic / pydantic-settings** | 2.8.2 / 2.3.4 | Data validation + `.env` loading |
| **google-generativeai** | 0.7.2 | AI language model API client |
| **PyMuPDF** | 1.24.7 | PDF text extraction |
| **PaddleOCR** *(optional)* | 2.8.x | Primary OCR engine for images |
| **Pytesseract** *(optional)* | — | Fallback OCR engine |
| **python-multipart** | 0.0.9 | File upload handling |

### Frontend
| Package | Version | Purpose |
|---|---|---|
| **React** | 18.3.1 | UI framework |
| **Vite** | 5.3.4 | Build tool + dev server |
| **Tailwind CSS** | 3.4.6 | Utility-first styling |
| **Lucide React** | 0.395.0 | Icon library |
| **Pure-state routing** | — | No react-router; navigation via React state |

---

## 🏗️ Architecture

```mermaid
graph LR
    subgraph Frontend [Frontend (React + Vite)]
        UI[User Interface]
        API_Client[API Client]
    end

    subgraph Backend [Backend (FastAPI + Uvicorn)]
        Router[API Routes]
        BackgroundTasks[Background Tasks]
        
        subgraph Core Engines
            LLM[LLM Engine]
            PDF[PDF Engine]
            Vision[Vision Engine]
        end
    end

    subgraph Storage
        DB[(PostgreSQL)]
    end

    subgraph External
        Gemini[Google Gemini API]
    end

    UI <--> API_Client
    API_Client <-->|REST HTTP| Router
    Router <--> DB
    Router -.->|Async Queue| BackgroundTasks
    
    BackgroundTasks --> LLM
    BackgroundTasks --> PDF
    BackgroundTasks --> Vision
    
    LLM <-->|Text Translation| Gemini
```

---

## 📁 Directory Structure

```
Translator_App/
│
├── .env                          ← YOUR API KEY (never committed)
├── .env.example                  ← Safe template — copy to .env
├── .gitignore
├── README.md
│
├── backend/
│   ├── run.py                    ← Convenience server launcher
│   ├── requirements.txt          ← Pinned Python dependencies
│   └── app/
│       ├── main.py               ← FastAPI app factory, CORS, lifespan
│       ├── __init__.py
│       │
│       ├── api/
│       │   ├── routes.py         ← Main REST endpoints (translate, explore, profile)
│       │   └── auth_routes.py    ← Authentication endpoints (login, register, JWT)
│       │
│       ├── core/
│       │   └── config.py         ← Settings loaded from .env via pydantic-settings
│       │
│       ├── models/
│       │   └── database.py       ← SQLAlchemy ORM models (User, Translation)
│       │
│       ├── schemas/
│       │   └── schemas.py        ← Pydantic request/response schemas
│       │
│       └── services/
│           ├── llm_engine.py     ← AI translation engine + model auto-selection
│           ├── pdf_engine.py     ← PDF text extraction (PyMuPDF → pdfplumber fallback)
│           └── vision_engine.py  ← Image OCR (PaddleOCR → pytesseract fallback)
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx              ← React entry point
        ├── App.jsx               ← Root component + pure-state router
        ├── index.css             ← Full design system (tokens, cards, buttons, animations)
        │
        ├── context/
        │   └── AuthContext.jsx   ← Global authentication state
        │
        ├── components/
        │   ├── Navbar.jsx        ← Sticky glassmorphism nav + mobile hamburger
        │   └── ReadMoreModal.jsx ← Modal for long translations
        │
        ├── pages/
        │   ├── Home.jsx          ← Translation Studio (text + file workspaces)
        │   ├── Explore.jsx       ← Public feed with search, filter, sort, pagination
        │   ├── Profile.jsx       ← User dashboard, history, visibility/delete controls
        │   ├── Login.jsx         ← Email/password & Google login
        │   └── Register.jsx      ← User registration
        │
        └── services/
            └── api.js            ← Centralised API client (all fetch calls live here)
```

> **Auto-created at runtime** (not in git):
> - `backend/uploads/` — Uploaded files directory

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+** — [python.org](https://www.python.org/downloads/)
- **Node.js 18+ and npm** — [nodejs.org](https://nodejs.org/)
- **Google Gemini API key** — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) *(free)*

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/Translator_App.git
cd Translator_App
```

---

### Step 2 — Configure your API key

Copy the example env file and fill in your key:

```bash
# Windows PowerShell
copy .env.example .env

# macOS / Linux / WSL
cp .env.example .env
```

Open `.env` and replace the placeholder:

```env
GEMINI_API_KEY=AIzaSy...your_actual_key_here
DATABASE_URL=postgresql://user:password@your_supabase_db_url
```

> **Where to get a key:** Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and click **"Create API key"** — it's free. The key starts with `AIza`. Do **not** paste an OAuth token.

---

### Step 3 — Install Python backend dependencies

From the project root:

```powershell
# Windows (using the project venv)
.venv\Scripts\pip.exe install -r backend\requirements.txt

# Or activate venv first, then pip
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

```bash
# macOS / Linux / WSL
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

> **Note:** `PaddleOCR` and `paddlepaddle` (image OCR) are commented out in `requirements.txt` by default because they are large (~500 MB). The backend degrades gracefully without them — text and PDF translation still work fully. To enable image OCR, uncomment those lines and re-run `pip install`.

---

### Step 4 — Install frontend dependencies

```powershell
# Windows
cd frontend
npm install
cd ..
```

```bash
# macOS / Linux
cd frontend && npm install && cd ..
```

---

### Step 5 — Start the servers

Open **two separate terminals** in the project root:

**Terminal 1 — Backend:**
```powershell
# Windows (using venv Python directly — no activation needed)
.venv\Scripts\python.exe backend\run.py
```
```bash
# macOS / Linux
source .venv/bin/activate
python backend/run.py
```

You should see:
```
[AI Translator] Using Python: .../.venv/Scripts/python.exe
INFO: Uvicorn running on http://0.0.0.0:8000
AI translation model confirmed working: <model-name>
INFO: Application startup complete.
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm run dev
```

---

### Step 6 — Open the app

Navigate to **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🗺️ Pages & Usage

### 🏠 Home — Translation Studio
- **Text tab:** Paste any text, select target language, click **Translate Now**
- **File tab:** Drag-and-drop or click to upload a `.pdf` or image file; the app processes it in the background and shows results when ready
- Copy or download the translated result
- Toggle **Make Public** to share to the Explore feed

### 🔍 Explore — Public Feed
- Browse translations shared by all users
- **Search** by keyword, **filter** by file type (text / pdf / image), **sort** by newest or most viewed
- Click **Read More** to expand a long translation in a modal

### 👤 Profile — Your Dashboard
- View your personal translation history
- See usage stats (total translations, characters processed)
- Toggle public/private visibility per translation
- Delete translations you no longer need

---

## 🔌 API Reference

The backend exposes a REST API at `http://localhost:8000`.
Interactive docs (Swagger UI) are available at **[http://localhost:8000/docs](http://localhost:8000/docs)**.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/translate/text` | Translate plain text |
| `POST` | `/api/translate/file` | Upload and translate a file (async) |
| `GET` | `/api/translate/{id}/status` | Poll file translation status |
| `GET` | `/api/translate/{id}` | Get a single translation |
| `PATCH` | `/api/translate/{id}/visibility` | Toggle public/private |
| `DELETE` | `/api/translate/{id}` | Delete a translation |
| `GET` | `/api/explore` | List public translations (search, filter, sort, paginate) |
| `GET` | `/api/profile/{username}` | Get profile with translation history |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login with username/email & password |
| `POST` | `/api/auth/register/google` | Register with Google |
| `POST` | `/api/auth/login/google` | Login with Google |
| `GET` | `/api/auth/me` | Get currently authenticated user |
| `DELETE`| `/api/auth/me` | Delete user account |

---

## 🛠️ Troubleshooting

### Translation error: 404 model not found
Your API key may only have access to certain AI models. Run this to see exactly which ones are available:
```powershell
.venv\Scripts\python.exe -c "import google.generativeai as genai; genai.configure(api_key='YOUR_KEY'); [print(m.name) for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]"
```
Then update `_CANDIDATE_MODELS` in [`backend/app/services/llm_engine.py`](backend/app/services/llm_engine.py) with a model from that list.

### Translation error: rate limit / quota exceeded
The free tier allows 15 requests/minute. Wait ~60 seconds and try again. The app automatically retries with fallback models.

### `ModuleNotFoundError: No module named 'uvicorn'`
You're running with the wrong Python. Use the venv Python explicitly:
```powershell
.venv\Scripts\python.exe backend\run.py
```

### Frontend can't reach backend ("Network Error")
- Confirm the backend is running on port 8000
- Check Windows Firewall isn't blocking port 8000
- The frontend is hardcoded to `http://localhost:8000` in [`frontend/src/services/api.js`](frontend/src/services/api.js)

---

## 📄 License

MIT — free to use, modify, and distribute.
