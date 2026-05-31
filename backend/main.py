import json
import os
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.datastructures import UploadFile


load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:e2b")
MAX_FILE_SIZE = 1 * 1024 * 1024
SUPPORTED_EXTENSIONS = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript JSX",
    ".ts": "TypeScript",
    ".tsx": "TypeScript TSX",
    ".java": "Java",
    ".c": "C",
    ".cpp": "C++",
    ".go": "Go",
    ".rs": "Rust",
    ".php": "PHP",
}


class Issue(BaseModel):
    category: str
    severity: Literal["low", "medium", "high"]
    line: str | None = None
    problem: str
    recommendation: str


class CategoryScores(BaseModel):
    readability: int | float
    maintainability: int | float
    efficiency: int | float
    logging: int | float
    security: int | float
    exception_handling: int | float
    coding_standards: int | float


class ReviewResponse(BaseModel):
    overall_score: int | float | None
    summary: str
    category_scores: CategoryScores | None = None
    issues: list[Issue] = Field(default_factory=list)
    security_warnings: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    final_advice: str | None = None
    raw_review: str | None = None


app = FastAPI(title="AI Code Reviewer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["POST"],
    allow_headers=["*"],
)


def detect_language(filename: str) -> tuple[str, str]:
    extension = Path(filename).suffix.lower()
    language = SUPPORTED_EXTENSIONS.get(extension)
    if not language:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension. Supported extensions: {supported}",
        )
    return extension, language


async def read_upload(upload: UploadFile) -> bytes:
    content = bytearray()

    while True:
        chunk = await upload.read(64 * 1024)
        if not chunk:
            break

        content.extend(chunk)
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="File size must be maximum 1 MB.",
            )

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    return bytes(content)


def build_review_prompt(language: str, filename: str, code: str) -> str:
    return f"""You are a strict senior software engineer and secure code reviewer.

Review the following code carefully.

Programming language:
{language}

File name:
{filename}

Evaluate the code based on:
1. Code readability
2. Code maintainability
3. Efficiency
4. Logging
5. Basic security
6. Exception handling
7. Hardcoded credentials, API keys, tokens, passwords, and secrets
8. General good coding standards

Give an overall score out of 10.
Give category-wise scores out of 10.
Give specific issues based on the actual code.
Mention line numbers only if clearly identifiable.
Do not give generic advice.
Do not rewrite the full code.
Do not generate improved code.
Only provide review, issues, warnings, and recommendations.

Return valid JSON only.
Do not include markdown.
Do not include explanation outside JSON.

Code:
{code}"""


async def request_ollama(prompt: str) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            response = await client.post(OLLAMA_URL, json=payload)
            response.raise_for_status()
    except (httpx.RequestError, httpx.HTTPStatusError):
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running or the model is unavailable.",
        ) from None

    try:
        data = response.json()
    except ValueError:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running or the model is unavailable.",
        ) from None

    raw_review = data.get("response")
    if not isinstance(raw_review, str) or not raw_review.strip():
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running or the model is unavailable.",
        )

    return raw_review.strip()


def parse_review(raw_review: str) -> dict:
    try:
        parsed = json.loads(raw_review)
        return ReviewResponse.model_validate(parsed).model_dump()
    except (json.JSONDecodeError, ValueError):
        return {
            "overall_score": None,
            "summary": "Structured parsing failed. Showing the raw model response.",
            "category_scores": None,
            "issues": [],
            "security_warnings": [],
            "recommendations": [],
            "final_advice": None,
            "raw_review": raw_review,
        }


async def extract_single_file(request: Request) -> UploadFile:
    try:
        form = await request.form()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Request must be multipart/form-data with one uploaded file.",
        ) from None

    files = [value for value in form.values() if isinstance(value, UploadFile)]
    if len(files) != 1:
        raise HTTPException(
            status_code=400,
            detail="Upload exactly one source code file.",
        )

    return files[0]


@app.post("/api/review", response_model=ReviewResponse)
async def review_code(request: Request) -> dict:
    upload = await extract_single_file(request)

    if not upload.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a name.")

    _, language = detect_language(upload.filename)
    content = await read_upload(upload)
    code = content.decode("utf-8", errors="replace")
    prompt = build_review_prompt(language, upload.filename, code)
    raw_review = await request_ollama(prompt)

    return parse_review(raw_review)
