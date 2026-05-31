# AI Code Reviewer

A local-only prototype for reviewing a single source code file with a React frontend, FastAPI backend, and a locally running Ollama model.

The app lets a developer upload one supported source file, sends it to the backend, asks Ollama for a strict senior-engineer style review, and displays the result in a readable format.

## Tech Stack

- Frontend: React, Vite, JavaScript, CSS Modules
- Backend: Python, FastAPI
- LLM: Ollama local HTTP API
- Storage: none
- Authentication: none
- Database: none
- Docker: none

## Project Structure

```text
code-reviewer/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── package.json
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        └── App.module.css
```

## Requirements

- Python 3.10+
- Node.js 18+
- npm
- Ollama installed locally
- The configured Ollama model available locally

Default model:

```text
gemma4:e2b
```

Default Ollama API URL:

```text
http://localhost:11434/api/generate
```

## Setup

### 1. Install and Start Ollama

Start Ollama:

```bash
ollama serve
```

In another terminal, pull the model:

```bash
ollama pull gemma4:e2b
```

If you want to use a different model, set `OLLAMA_MODEL` in the backend environment.

### 2. Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Optional environment configuration:

```bash
cp .env.example .env
```

Edit `.env` if needed:

```text
OLLAMA_MODEL=gemma4:e2b
OLLAMA_URL=http://localhost:11434/api/generate
```

Run the backend:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend URL:

```text
http://127.0.0.1:5173/
```

## Supported File Types

- `.py`
- `.js`
- `.jsx`
- `.ts`
- `.tsx`
- `.java`
- `.c`
- `.cpp`
- `.go`
- `.rs`
- `.php`

Maximum upload size:

```text
1 MB
```

## API

### Review Code

```text
POST /api/review
```

Request type:

```text
multipart/form-data
```

Field:

```text
file
```

The backend validates:

- Exactly one uploaded file
- Non-empty file
- Maximum size of 1 MB
- Supported file extension

Files are read in memory and are not stored permanently.

## Review Output

When Ollama returns valid structured JSON, the frontend displays:

- Overall score
- Category scores
- Summary
- Issues
- Security warnings
- Recommendations
- Final advice

If the model response cannot be parsed into the expected structure, the backend returns a fallback response with `raw_review`. The frontend formats JSON-like raw responses into readable tables when possible.

## Troubleshooting

### Blank Frontend Page

Restart the Vite server:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Then refresh the browser.

### Backend Says Ollama Is Unavailable

Make sure Ollama is running:

```bash
ollama serve
```

Make sure the model exists locally:

```bash
ollama list
```

If the model is missing:

```bash
ollama pull gemma4:e2b
```

### Frontend Cannot Reach Backend

Confirm the backend is running on:

```text
http://127.0.0.1:8000
```

The frontend sends review requests to:

```text
http://localhost:8000/api/review
```

## Build

Build the frontend:

```bash
cd frontend
npm run build
```

Check backend syntax:

```bash
cd backend
python3 -m py_compile main.py
```
