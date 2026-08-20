document.addEventListener('DOMContentLoaded', () => {

    // Global State
    let currentSourceType = 'youtube';
    let selectedFile = null;
    let currentResults = null;

    // DOM Elements
    const sourceYtBtn = document.getElementById('source-yt-btn');
    const sourceFileBtn = document.getElementById('source-file-btn');
    const ytSection = document.getElementById('youtube-input-section');
    const fileSection = document.getElementById('file-input-section');
    const ytUrlInput = document.getElementById('youtube-url-input');
    const fileUploadInput = document.getElementById('file-upload-input');
    const dropZone = document.getElementById('drop-zone');
    const fileInfo = document.getElementById('file-info');
    const fileNameSpan = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file');
    const languageSelect = document.getElementById('language-select');
    const processBtn = document.getElementById('process-btn');

    // Progress Elements
    const progressCard = document.getElementById('progress-card');
    const progressStatusText = document.getElementById('progress-status-text');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressPercentage = document.getElementById('progress-percentage');

    const step1Badge = document.getElementById('step-1-badge');
    const step2Badge = document.getElementById('step-2-badge');
    const step3Badge = document.getElementById('step-3-badge');
    const step4Badge = document.getElementById('step-4-badge');

    // Content Display Elements
    const meetingTitle = document.getElementById('meeting-title');
    const meetingSubtitle = document.getElementById('meeting-subtitle');
    const summaryContent = document.getElementById('summary-content');
    const actionItemsContent = document.getElementById('action-items-content');
    const keyDecisionsContent = document.getElementById('key-decisions-content');
    const openQuestionsContent = document.getElementById('open-questions-content');
    const transcriptTextarea = document.getElementById('transcript-textarea');
    const wordCountBadge = document.getElementById('word-count-badge');
    const charCountBadge = document.getElementById('char-count-badge');
    const copyTranscriptBtn = document.getElementById('copy-transcript-btn');

    // Chat Elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const suggestionChips = document.querySelectorAll('.suggestion-chip');

    // Export Elements
    const exportTxtBtn = document.getElementById('export-txt-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    // Tab Navigation
    const mainTabs = document.querySelectorAll('.main-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    // --- Tab Switching ---
    mainTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');

            mainTabs.forEach(t => {
                t.classList.remove('active', 'text-sky-400', 'border-sky-500');
                t.classList.add('text-slate-400', 'border-transparent');
            });
            tab.classList.add('active', 'text-sky-400', 'border-sky-500');
            tab.classList.remove('text-slate-400', 'border-transparent');

            tabContents.forEach(content => {
                if (content.id === `tab-${target}`) {
                    content.classList.remove('hidden');
                    content.classList.add('active');
                } else {
                    content.classList.add('hidden');
                    content.classList.remove('active');
                }
            });
        });
    });

    // --- Source Switcher ---
    sourceYtBtn.addEventListener('click', () => {
        currentSourceType = 'youtube';
        sourceYtBtn.classList.add('bg-gradient-to-r', 'from-sky-600', 'to-indigo-600', 'text-white', 'shadow-md');
        sourceYtBtn.classList.remove('text-slate-400');
        sourceFileBtn.classList.remove('bg-gradient-to-r', 'from-sky-600', 'to-indigo-600', 'text-white', 'shadow-md');
        sourceFileBtn.classList.add('text-slate-400');
        ytSection.classList.remove('hidden');
        fileSection.classList.add('hidden');
    });

    sourceFileBtn.addEventListener('click', () => {
        currentSourceType = 'file';
        sourceFileBtn.classList.add('bg-gradient-to-r', 'from-sky-600', 'to-indigo-600', 'text-white', 'shadow-md');
        sourceFileBtn.classList.remove('text-slate-400');
        sourceYtBtn.classList.remove('bg-gradient-to-r', 'from-sky-600', 'to-indigo-600', 'text-white', 'shadow-md');
        sourceYtBtn.classList.add('text-slate-400');
        fileSection.classList.remove('hidden');
        ytSection.classList.add('hidden');
    });

    // --- File Drag & Drop ---
    dropZone.addEventListener('click', () => fileUploadInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-sky-500');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-sky-500');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-sky-500');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    fileUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        selectedFile = file;
        fileNameSpan.textContent = file.name;
        dropZone.classList.add('hidden');
        fileInfo.classList.remove('hidden');
    }

    removeFileBtn.addEventListener('click', () => {
        selectedFile = null;
        fileUploadInput.value = '';
        fileInfo.classList.add('hidden');
        dropZone.classList.remove('hidden');
    });

    // --- Process & Analyze Call ---
    processBtn.addEventListener('click', async () => {
        const formData = new FormData();
        formData.append('source_type', currentSourceType);
        formData.append('language', languageSelect.value);

        if (currentSourceType === 'youtube') {
            const url = ytUrlInput.value.trim();
            if (!url) {
                alert('Please enter a YouTube video URL.');
                return;
            }
            formData.append('youtube_url', url);
        } else {
            if (!selectedFile) {
                alert('Please select an audio or video file to upload.');
                return;
            }
            formData.append('file', selectedFile);
        }

        // Show progress UI
        processBtn.disabled = true;
        processBtn.classList.add('opacity-50', 'cursor-not-allowed');
        progressCard.classList.remove('hidden');
        
        updateStep(1, 'Downloading & extracting audio...', 20);

        try {
            updateStep(2, 'Transcribing audio with Speech-to-Text...', 50);
            
            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Failed to process audio.');
            }

            updateStep(3, 'Generating executive summary & key takeaways...', 80);
            updateStep(4, 'Building vector RAG index for AI Chat...', 95);
            
            // Store results locally
            currentResults = data;
            renderResults(data);

            updateStep(4, 'Processing Complete!', 100);
            setTimeout(() => progressCard.classList.add('hidden'), 1500);

        } catch (err) {
            let msg = err.message || 'Processing failed.';
            if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
                msg = 'Connection to server lost. Make sure backend is running at http://localhost:8000.';
            }
            alert(`⚠️ Error: ${msg}`);
            progressCard.classList.add('hidden');
        } finally {
            processBtn.disabled = false;
            processBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });

    function updateStep(stepNum, statusText, percent) {
        progressStatusText.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> ${statusText}`;
        progressBarFill.style.width = `${percent}%`;
        progressPercentage.textContent = `${percent}%`;

        // Highlight step badges
        [step1Badge, step2Badge, step3Badge, step4Badge].forEach((b, idx) => {
            if (idx + 1 <= stepNum) {
                b.className = 'text-sky-400 font-bold';
            } else {
                b.className = 'text-slate-500 font-medium';
            }
        });
    }

    function renderResults(data) {
        meetingTitle.innerHTML = `<i class="fa-solid fa-circle-play text-sky-400"></i> ${data.title}`;
        meetingSubtitle.textContent = 'Analysis complete! Explore summaries, takeaways, questions, and AI chat below.';

        summaryContent.textContent = data.summary;
        actionItemsContent.textContent = data.action_items;
        keyDecisionsContent.textContent = data.key_decisions;
        openQuestionsContent.textContent = data.open_questions;

        transcriptTextarea.value = data.transcript;

        const words = data.transcript.trim().split(/\s+/).length;
        const chars = data.transcript.length;
        wordCountBadge.textContent = words.toLocaleString();
        charCountBadge.textContent = chars.toLocaleString();

        // Reset chat stream with welcome message
        chatMessages.innerHTML = `
            <div class="chat-bubble ai bg-slate-900 border border-slate-800 text-slate-200 p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed">
                🤖 I've analyzed <strong>${data.title}</strong>! Ask me any question about the video or audio content.
            </div>
        `;
    }

    // --- Copy Transcript ---
    copyTranscriptBtn.addEventListener('click', () => {
        if (!transcriptTextarea.value) return;
        navigator.clipboard.writeText(transcriptTextarea.value);
        copyTranscriptBtn.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i> <span>Copied!</span>`;
        setTimeout(() => {
            copyTranscriptBtn.innerHTML = `<i class="fa-solid fa-copy"></i> <span>Copy Transcript</span>`;
        }, 2000);
    });

    // --- AI RAG Chat ---
    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.textContent.trim();
            sendChatMessage();
        });
    });

    async function sendChatMessage() {
        const question = chatInput.value.trim();
        if (!question) return;

        if (!currentResults) {
            alert('Please process a video or audio file first.');
            return;
        }

        // Add user message to chat UI
        appendChatMessage('user', question);
        chatInput.value = '';

        // Add typing indicator
        const typingId = appendChatMessage('ai', 'Thinking... <i class="fa-solid fa-spinner animate-spin ml-1"></i>');

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to get answer.');

            // Update AI message
            const typingElem = document.getElementById(typingId);
            if (typingElem) {
                typingElem.innerHTML = `🤖 ${data.answer}`;
            }

        } catch (err) {
            const typingElem = document.getElementById(typingId);
            if (typingElem) {
                typingElem.innerHTML = `⚠️ Error: ${err.message}`;
            }
        }
    }

    function appendChatMessage(role, content) {
        const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        const div = document.createElement('div');
        div.id = msgId;

        if (role === 'user') {
            div.className = 'chat-bubble user bg-gradient-to-r from-sky-600 to-indigo-600 text-white p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ml-auto shadow-md';
            div.innerHTML = `👤 <b>You:</b> ${content}`;
        } else {
            div.className = 'chat-bubble ai bg-slate-900 border border-slate-800 text-slate-200 p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed mr-auto shadow-md';
            div.innerHTML = content;
        }

        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgId;
    }

    // --- Export Handlers ---
    exportTxtBtn.addEventListener('click', () => triggerExport('txt'));
    exportPdfBtn.addEventListener('click', () => triggerExport('pdf'));

    async function triggerExport(format) {
        if (!currentResults) {
            alert('Please process a video or audio file first.');
            return;
        }

        try {
            const res = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentResults, format })
            });

            if (!res.ok) throw new Error('Export failed.');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentResults.title.replace(/\s+/g, '_')}_report.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();

        } catch (err) {
            alert(`Export failed: ${err.message}`);
        }
    }

});
