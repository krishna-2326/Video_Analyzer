import gradio as gr
import os
import tempfile
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import core backend functions
from utils.audio_processor import process_input
from core.transcriber import transcribe_all
from core.summarizer import summarize, generate_title
from core.extractor import extract_action_items, extract_key_decisions, extract_questions
from core.rag_engine import build_rag_chain, ask_question
from utils.exporter import generate_txt_report, generate_pdf_report

# Global session storage for active processed transcript
global_session = {
    "transcript": None,
    "title": None,
    "summary": None,
    "action_items": None,
    "key_decisions": None,
    "open_questions": None,
    "rag_chain": None
}


def process_media(youtube_url, file_obj, language):
    if not os.getenv("MISTRAL_API_KEY"):
        return "⚠️ Error: MISTRAL_API_KEY is missing. Please set it in Space Settings -> Secrets.", "", "", "", "", "No transcript available."

    source = None
    temp_path = None

    try:
        if youtube_url and youtube_url.strip():
            source = youtube_url.strip()
        elif file_obj is not None:
            source = file_obj.name
        else:
            return "⚠️ Error: Please provide a YouTube URL or upload a file.", "", "", "", "", "No transcript available."

        # Step 1: Extract Audio
        chunks = process_input(source)

        # Step 2: Transcribe
        transcript = transcribe_all(chunks, language=language)
        if not transcript or not transcript.strip():
            return "⚠️ Error: Could not extract transcript.", "", "", "", "", "No transcript available."

        # Step 3: Summarize & Insights
        title = generate_title(transcript)
        summary = summarize(transcript)
        action_items = extract_action_items(transcript)
        decisions = extract_key_decisions(transcript)
        questions = extract_questions(transcript)

        # Save to global session
        global_session["title"] = title
        global_session["transcript"] = transcript
        global_session["summary"] = summary
        global_session["action_items"] = action_items
        global_session["key_decisions"] = decisions
        global_session["open_questions"] = questions

        return (
            f"🎬 **{title}**\n\n{summary}",
            action_items,
            decisions,
            questions,
            transcript
        )

    except Exception as exc:
        err_msg = str(exc)
        return f"⚠️ Error: {err_msg}", "", "", "", "No transcript available."


def answer_rag_question(chat_history, question):
    if not global_session["transcript"]:
        chat_history.append((question, "⚠️ Please process a video or audio file first."))
        return chat_history, ""

    if not question or not question.strip():
        return chat_history, ""

    try:
        rag_chain = build_rag_chain(global_session["transcript"])
        answer = ask_question(rag_chain, question.strip())
        chat_history.append((question, answer))
        return chat_history, ""
    except Exception as exc:
        chat_history.append((question, f"⚠️ Error generating answer: {str(exc)}"))
        return chat_history, ""


def export_txt_file():
    if not global_session["transcript"]:
        return None
    data = {
        "title": global_session["title"] or "Summary Report",
        "summary": global_session["summary"] or "",
        "action_items": global_session["action_items"] or "",
        "key_decisions": global_session["key_decisions"] or "",
        "open_questions": global_session["open_questions"] or "",
        "transcript": global_session["transcript"] or "",
    }
    txt_content = generate_txt_report(data)
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".txt", mode="w", encoding="utf-8")
    temp_file.write(txt_content)
    temp_file.close()
    return temp_file.name


def export_pdf_file():
    if not global_session["transcript"]:
        return None
    data = {
        "title": global_session["title"] or "Summary Report",
        "summary": global_session["summary"] or "",
        "action_items": global_session["action_items"] or "",
        "key_decisions": global_session["key_decisions"] or "",
        "open_questions": global_session["open_questions"] or "",
        "transcript": global_session["transcript"] or "",
    }
    pdf_bytes = generate_pdf_report(data)
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", mode="wb")
    temp_file.write(pdf_bytes)
    temp_file.close()
    return temp_file.name


# Create Gradio Blocks UI
with gr.Blocks(theme=gr.themes.Soft(primary_hue="sky", secondary_hue="indigo"), title="VideoIntel AI Studio") as demo:

    gr.Markdown("""
    # 🎬 VideoIntel AI — Video & Audio Intelligence Studio
    Transform YouTube videos and audio files into executive summaries, practical takeaways, key decisions, and an interactive RAG AI assistant.
    """)

    with gr.Row():
        # Left Input Panel
        with gr.Column(scale=4):
            gr.Markdown("### 🎛️ Media Controls")
            yt_url_input = gr.Textbox(label="YouTube Video Link", placeholder="https://www.youtube.com/watch?v=...")
            file_upload_input = gr.File(label="Upload Audio / Video File", file_types=["audio", "video"])
            language_select = gr.Dropdown(choices=["english", "hinglish"], value="english", label="Transcription Engine / Language")
            process_btn = gr.Button("🚀 Process & Analyze", variant="primary")

            gr.Markdown("### 📥 Download Reports")
            with gr.Row():
                txt_export_btn = gr.Button("📄 Export TXT")
                pdf_export_btn = gr.Button("📕 Export PDF")
            download_file_output = gr.File(label="Download Generated File")

        # Right Output Dashboard
        with gr.Column(scale=8):
            with gr.Tabs():
                with gr.TabItem("📊 Summary & Insights"):
                    summary_output = gr.Markdown("### Executive Summary\n\nProcess a video or upload an audio file to view insights.")
                    with gr.Row():
                        action_items_output = gr.Markdown("### ✅ Practical Steps\n\nAwaiting input...")
                        decisions_output = gr.Markdown("### 🔑 Key Decisions\n\nAwaiting input...")
                        questions_output = gr.Markdown("### ❓ Topics & Questions\n\nAwaiting input...")

                with gr.TabItem("💬 Interactive RAG AI Chat"):
                    chatbot = gr.Chatbot(label="AI Video Assistant", height=380)
                    with gr.Row():
                        msg_input = gr.Textbox(placeholder="Ask any question about the video content...", show_label=False, scale=8)
                        send_btn = gr.Button("Send", variant="primary", scale=2)

                with gr.TabItem("📜 Full Transcript"):
                    transcript_output = gr.TextArea(label="Transcript Text", interactive=False, lines=18)

    # Event Wiring
    process_btn.click(
        fn=process_media,
        inputs=[yt_url_input, file_upload_input, language_select],
        outputs=[summary_output, action_items_output, decisions_output, questions_output, transcript_output]
    )

    send_btn.click(
        fn=answer_rag_question,
        inputs=[chatbot, msg_input],
        outputs=[chatbot, msg_input]
    )

    msg_input.submit(
        fn=answer_rag_question,
        inputs=[chatbot, msg_input],
        outputs=[chatbot, msg_input]
    )

    txt_export_btn.click(fn=export_txt_file, inputs=None, outputs=download_file_output)
    pdf_export_btn.click(fn=export_pdf_file, inputs=None, outputs=download_file_output)

if __name__ == "__main__":
    demo.launch()
