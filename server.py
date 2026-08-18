import os
import tempfile
import shutil
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# Import backend modules
from utils.audio_processor import process_input
from core.transcriber import transcribe_all
from core.summarizer import summarize, generate_title
from core.extractor import extract_action_items, extract_key_decisions, extract_questions
from core.rag_engine import build_rag_chain, ask_question
from utils.exporter import generate_txt_report, generate_pdf_report

app = FastAPI(title="AI Video Agent API", version="2.0.0")

# CORS middleware for cross-origin frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory storage for current processed session
session_data = {
    "title": None,
    "transcript": None,
    "summary": None,
    "action_items": None,
    "key_decisions": None,
    "open_questions": None,
    "rag_chain": None,
}


class ChatRequest(BaseModel):
    question: str


class ExportRequest(BaseModel):
    format: str  # "pdf" or "txt"
    title: Optional[str] = None
    summary: Optional[str] = None
    action_items: Optional[str] = None
    key_decisions: Optional[str] = None
    open_questions: Optional[str] = None
    transcript: Optional[str] = None


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "mistral_key_configured": bool(os.getenv("MISTRAL_API_KEY")),
        "sarvam_key_configured": bool(os.getenv("SARVAM_API_KEY")),
    }


@app.post("/api/process")
def process_video_or_audio(
    source_type: str = Form(...),  # "youtube" or "file"
    youtube_url: Optional[str] = Form(None),
    language: str = Form("english"),
    file: Optional[UploadFile] = File(None),
):
    # Securely read MISTRAL_API_KEY from backend environment
    if not os.getenv("MISTRAL_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="MISTRAL_API_KEY is not configured on the backend server. Please check your .env file.",
        )

    temp_path = None
    source = None

    try:
        if source_type == "youtube":
            if not youtube_url or not youtube_url.strip():
                raise HTTPException(status_code=400, detail="YouTube URL is required.")
            source = youtube_url.strip()
        elif source_type == "file":
            if not file:
                raise HTTPException(status_code=400, detail="No file was uploaded.")

            # Save uploaded file temporarily
            ext = os.path.splitext(file.filename)[1] or ".mp4"
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            shutil.copyfileobj(file.file, temp_file)
            temp_file.close()
            temp_path = temp_file.name
            source = temp_path
        else:
            raise HTTPException(status_code=400, detail="Invalid source_type.")

        # Step 1: Process Audio & Chunking
        chunks = process_input(source)

        # Step 2: Transcribe
        transcript = transcribe_all(chunks, language=language)
        if not transcript or not transcript.strip():
            raise HTTPException(
                status_code=500, detail="Failed to extract audio transcript."
            )

        # Step 3: Title & Summary
        title = generate_title(transcript)
        summary = summarize(transcript)

        # Step 4: Extract Insights
        action_items = extract_action_items(transcript)
        decisions = extract_key_decisions(transcript)
        questions = extract_questions(transcript)

        # Step 5: RAG Vector Indexing
        rag_chain = build_rag_chain(transcript)

        # Store in global session state
        session_data["title"] = title
        session_data["transcript"] = transcript
        session_data["summary"] = summary
        session_data["action_items"] = action_items
        session_data["key_decisions"] = decisions
        session_data["open_questions"] = questions
        session_data["rag_chain"] = rag_chain

        return {
            "success": True,
            "title": title,
            "summary": summary,
            "action_items": action_items,
            "key_decisions": decisions,
            "open_questions": questions,
            "transcript": transcript,
        }

    except Exception as exc:
        err_str = str(exc)
        if "401" in err_str or "Invalid API Key" in err_str:
            raise HTTPException(
                status_code=401,
                detail="Invalid Mistral API Key. Please update your API key in settings.",
            )
        raise HTTPException(status_code=500, detail=f"Processing failed: {err_str}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.post("/api/chat")
def chat_with_meeting(req: ChatRequest):
    if not session_data["transcript"]:
        raise HTTPException(
            status_code=400, detail="No processed transcript available. Please process a video first."
        )

    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        # Re-build RAG chain dynamically to guarantee fresh context
        rag_chain = build_rag_chain(session_data["transcript"])
        answer = ask_question(rag_chain, req.question.strip())
        return {"success": True, "answer": answer}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"RAG Chat error: {str(exc)}")


@app.post("/api/export")
def export_report(req: ExportRequest):
    data = {
        "title": req.title or session_data["title"] or "Meeting Summary",
        "summary": req.summary or session_data["summary"] or "",
        "action_items": req.action_items or session_data["action_items"] or "",
        "key_decisions": req.key_decisions or session_data["key_decisions"] or "",
        "open_questions": req.open_questions or session_data["open_questions"] or "",
        "transcript": req.transcript or session_data["transcript"] or "",
    }

    clean_filename = data["title"].replace(" ", "_").replace("/", "_")

    if req.format.lower() == "pdf":
        pdf_bytes = generate_pdf_report(data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={clean_filename}_report.pdf"
            },
        )
    else:
        txt_content = generate_txt_report(data)
        return Response(
            content=txt_content,
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={clean_filename}_report.txt"
            },
        )


# Serve Static Frontend Application at root "/"
os.makedirs("static", exist_ok=True)
app.mount("/", StaticFiles(directory="static", html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
