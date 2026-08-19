import streamlit as st
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

# Page Configuration
st.set_page_config(
    page_title="AI Video & Meeting Agent",
    page_icon="🎬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for Modern Premium Styling
st.markdown("""
<style>
    /* Main Theme Tweaks */
    .stApp {
        background-color: #0B0F17;
        color: #F1F5F9;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    
    /* Header Card */
    .main-header {
        background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
        border: 1px solid #334155;
        border-radius: 16px;
        padding: 24px 32px;
        margin-bottom: 24px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .main-header h1 {
        color: #38BDF8;
        font-size: 2.2rem;
        font-weight: 700;
        margin: 0 0 8px 0;
    }
    .main-header p {
        color: #94A3B8;
        font-size: 1rem;
        margin: 0;
    }

    /* Metric & Card Components */
    .content-card {
        background: #1E293B;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
    }
    .card-title {
        color: #38BDF8;
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Tab Customization */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: #0F172A;
        padding: 6px;
        border-radius: 12px;
        border: 1px solid #1E293B;
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 8px;
        color: #94A3B8;
        font-weight: 500;
        padding: 8px 16px;
    }
    .stTabs [aria-selected="true"] {
        background-color: #0284C7 !important;
        color: #FFFFFF !important;
    }

    /* Chat message styling */
    .chat-bubble-user {
        background-color: #0284C7;
        color: white;
        padding: 12px 16px;
        border-radius: 16px 16px 2px 16px;
        margin-left: auto;
        max-width: 80%;
        margin-bottom: 10px;
    }
    .chat-bubble-ai {
        background-color: #1E293B;
        border: 1px solid #334155;
        color: #F1F5F9;
        padding: 12px 16px;
        border-radius: 16px 16px 16px 2px;
        max-width: 85%;
        margin-bottom: 10px;
    }

    /* Badge */
    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
    }
    .badge-success { background: #064E3B; color: #34D399; border: 1px solid #059669; }
    .badge-warning { background: #78350F; color: #FBBF24; border: 1px solid #D97706; }
</style>
""", unsafe_allow_html=True)


# Session state initialization
if "result" not in st.session_state:
    st.session_state.result = None
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []


# Main Header
st.markdown("""
<div class="main-header">
    <h1>🎬 AI Video & Meeting Agent</h1>
    <p>Transform YouTube videos and audio files into smart summaries, actionable tasks, key decisions, and an interactive RAG AI assistant.</p>
</div>
""", unsafe_allow_html=True)


# Sidebar Configuration
with st.sidebar:
    st.title("⚙️ Input & Settings")

    # API Keys inputs & indicator
    env_mistral = os.getenv("MISTRAL_API_KEY", "")
    mistral_key = st.text_input("Mistral API Key:", value=env_mistral, type="password", help="Get your free key from https://console.mistral.ai/")

    if mistral_key:
        os.environ["MISTRAL_API_KEY"] = mistral_key.strip()
        st.markdown('<span class="status-badge badge-success">✓ Mistral API Key Set</span>', unsafe_allow_html=True)
    else:
        st.markdown('<span class="status-badge badge-warning">⚠️ Enter Mistral API Key</span>', unsafe_allow_html=True)

    st.divider()

    input_mode = st.radio("Choose Input Source:", ["YouTube URL 🔗", "Upload File 📁"])

    source_input = None
    temp_file_path = None

    if input_mode == "YouTube URL 🔗":
        source_input = st.text_input("Enter YouTube Video Link:", placeholder="https://www.youtube.com/watch?v=...")
    else:
        uploaded_file = st.file_uploader(
            "Upload Audio / Video File",
            type=["mp4", "mp3", "wav", "m4a", "mkv", "avi"]
        )
        if uploaded_file is not None:
            # Save uploaded file to temp path
            tfile = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{uploaded_file.name}")
            tfile.write(uploaded_file.read())
            tfile.close()
            source_input = tfile.name
            temp_file_path = tfile.name

    language = st.selectbox(
        "Transcription Engine / Language",
        ["english", "hinglish"],
        help="Select 'english' for Whisper local model, or 'hinglish' for Sarvam AI Hindi-to-English translation."
    )

    st.divider()

    process_btn = st.button("🚀 Process & Analyze", type="primary", use_container_width=True)

    if process_btn:
        if not source_input:
            st.error("Please provide a valid YouTube URL or upload a file.")
        elif not mistral_key:
            st.error("MISTRAL_API_KEY is not configured in your .env file.")
        else:
            with st.spinner("Processing video/audio... Please wait."):
                status_container = st.empty()

                try:
                    # Step 1: Audio Processing
                    status_container.info("⏳ Step 1/5: Downloading / Extracting Audio...")
                    chunks = process_input(source_input)

                    # Step 2: Transcription
                    def update_progress(msg):
                        status_container.info(f"⏳ Step 2/5: {msg}")

                    status_container.info(f"⏳ Step 2/5: Transcribing audio using {language.capitalize()} engine...")
                    transcript = transcribe_all(chunks, language=language, progress_callback=update_progress)

                    if not transcript or not transcript.strip():
                        st.error("Could not extract any transcript from the audio.")
                    else:
                        # Step 3: Summarization & Title
                        status_container.info("⏳ Step 3/5: Generating title and executive summary...")
                        title = generate_title(transcript)
                        summary = summarize(transcript)

                        # Step 4: Extract Insights
                        status_container.info("⏳ Step 4/5: Extracting action items, key decisions, and questions...")
                        action_items = extract_action_items(transcript)
                        decisions = extract_key_decisions(transcript)
                        questions = extract_questions(transcript)

                        # Step 5: Build RAG Chain
                        status_container.info("⏳ Step 5/5: Building Vector Index for RAG AI Chat...")
                        rag_chain = build_rag_chain(transcript)

                        status_container.success("✅ Processing Complete!")

                        # Save results in session state
                        st.session_state.result = {
                            "title": title,
                            "transcript": transcript,
                            "summary": summary,
                            "action_items": action_items,
                            "key_decisions": decisions,
                            "open_questions": questions,
                            "rag_chain": rag_chain
                        }
                        st.session_state.chat_history = []

                except Exception as exc:
                    err_msg = str(exc)
                    if "401" in err_msg or "Invalid API Key" in err_msg:
                        status_container.error("❌ **Invalid Mistral API Key (HTTP 401)**. The current API key was rejected by Mistral. Please enter a new/valid key in the sidebar. Get a key at [console.mistral.ai](https://console.mistral.ai/).")
                    else:
                        status_container.error(f"❌ An error occurred during processing: {err_msg}")
                finally:
                    # Clean up temp upload file if created
                    if temp_file_path and os.path.exists(temp_file_path):
                        try:
                            os.remove(temp_file_path)
                        except Exception:
                            pass


# Main Content Area
if st.session_state.result is None:
    st.info("👋 Welcome! Select your input source in the sidebar and click **Process & Analyze** to get started.")

    # Feature Grid Highlight
    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown("""
        <div class="content-card">
            <div class="card-title">📝 Smart Summaries</div>
            <p style="color: #94A3B8;">Automatic chunked map-reduce summarization powered by Mistral AI.</p>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown("""
        <div class="content-card">
            <div class="card-title">✅ Action & Decision Mining</div>
            <p style="color: #94A3B8;">Automatically extract task descriptions, owners, deadlines, and open questions.</p>
        </div>
        """, unsafe_allow_html=True)
    with col3:
        st.markdown("""
        <div class="content-card">
            <div class="card-title">💬 Interactive RAG Chat</div>
            <p style="color: #94A3B8;">Ask any questions directly to your video/meeting context with vector search.</p>
        </div>
        """, unsafe_allow_html=True)

else:
    res = st.session_state.result

    # Meeting Title Banner
    st.markdown(f"## 📌 {res['title']}")

    # Tabs Layout
    tab1, tab2, tab3, tab4 = st.tabs([
        "📊 Summary & Insights",
        "💬 Chat with Meeting",
        "📜 Full Transcript",
        "📥 Export Report"
    ])

    # Tab 1: Executive Summary & Extracted Insights
    with tab1:
        st.subheader("📋 Executive Summary")
        st.markdown(f"<div class='content-card'>{res['summary']}</div>", unsafe_allow_html=True)

        col_a, col_b, col_c = st.columns(3)
        with col_a:
            st.markdown("### ✅ Action Items")
            st.markdown(f"<div class='content-card'>{res['action_items']}</div>", unsafe_allow_html=True)

        with col_b:
            st.markdown("### 🔑 Key Decisions")
            st.markdown(f"<div class='content-card'>{res['key_decisions']}</div>", unsafe_allow_html=True)

        with col_c:
            st.markdown("### ❓ Open Questions")
            st.markdown(f"<div class='content-card'>{res['open_questions']}</div>", unsafe_allow_html=True)

    # Tab 2: RAG Interactive Chat
    with tab2:
        st.subheader("💬 Ask AI Anything About This Video / Meeting")
        st.caption("The assistant answers questions grounded strictly in the context of this meeting transcript.")

        # Quick Suggestion Buttons
        st.markdown("**Suggested Questions:**")
        cols = st.columns(4)
        selected_suggestion = None
        if cols[0].button("What are the next steps?"):
            selected_suggestion = "What are the recommended next steps?"
        if cols[1].button("Summarize key decisions"):
            selected_suggestion = "Can you summarize the key decisions?"
        if cols[2].button("What were the main deadlines?"):
            selected_suggestion = "What were the main deadlines mentioned?"
        if cols[3].button("Who were the main speakers?"):
            selected_suggestion = "Who were the key speakers or participants?"

        st.divider()

        # Display Existing Chat History
        for message in st.session_state.chat_history:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

        # Determine prompt input (either from chat_input or suggestion button)
        prompt_input = st.chat_input("Ask a question about the transcript...") or selected_suggestion

        if prompt_input:
            # 1. Add and display user message
            st.session_state.chat_history.append({"role": "user", "content": prompt_input})
            with st.chat_message("user"):
                st.markdown(prompt_input)

            # 2. Generate and display assistant answer
            with st.chat_message("assistant"):
                with st.spinner("Analyzing meeting transcript..."):
                    try:
                        # Re-build RAG chain dynamically on transcript to guarantee fresh context
                        rag_chain = build_rag_chain(res["transcript"])
                        answer = ask_question(rag_chain, prompt_input)
                    except Exception as err:
                        answer = f"⚠️ Could not generate answer: {str(err)}"
                    st.markdown(answer)

            # 3. Save assistant answer to history
            st.session_state.chat_history.append({"role": "assistant", "content": answer})
            st.rerun()

    # Tab 3: Full Transcript View
    with tab3:
        st.subheader("📜 Full Transcript")

        # Stats bar
        word_count = len(res['transcript'].split())
        char_count = len(res['transcript'])
        reading_time = max(1, round(word_count / 200))

        st.caption(f"📊 **Stats:** {word_count:,} words | {char_count:,} characters | ~{reading_time} min read")
        st.text_area("Transcript text:", value=res['transcript'], height=400)

    # Tab 4: Export Options
    with tab4:
        st.subheader("📥 Download Meeting Reports")
        st.write("Export the generated title, summary, action items, decisions, questions, and transcript into your preferred format.")

        txt_data = generate_txt_report(res)
        pdf_data = generate_pdf_report(res)

        col_dl1, col_dl2 = st.columns(2)
        with col_dl1:
            st.download_button(
                label="📄 Download Plain Text (.txt)",
                data=txt_data,
                file_name=f"{res['title'].replace(' ', '_')}_report.txt",
                mime="text/plain",
                use_container_width=True
            )

        with col_dl2:
            st.download_button(
                label="📕 Download Structured PDF (.pdf)",
                data=pdf_data,
                file_name=f"{res['title'].replace(' ', '_')}_report.pdf",
                mime="application/pdf",
                use_container_width=True
            )
