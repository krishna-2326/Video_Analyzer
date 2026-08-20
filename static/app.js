document.addEventListener('DOMContentLoaded', () => {

    // Global State
    let currentSourceType = 'youtube';
    let selectedFile = null;
    let currentResults = null;
    let tapeTimerInterval = null;
    let tapeSeconds = 0;

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

    // Progress & Tape Counter Elements
    const progressCard = document.getElementById('progress-card');
    const progressStatusText = document.getElementById('progress-status-text');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressPercentage = document.getElementById('progress-percentage');

    const tapeCounter = document.getElementById('tape-counter');
    const tapeTimeDisplay = document.getElementById('tape-time-display');
    const tapeStatusText = document.getElementById('tape-status-text');
    const recDot = document.getElementById('rec-dot');

    const step1Badge = document.getElementById('step-1-badge');
    const step2Badge = document.getElementById('step-2-badge');
    const step3Badge = document.getElementById('step-3-badge');
    const step4Badge = document.getElementById('step-4-badge');

    // Content Display Elements
    const meetingTitle = document.getElementById('meeting-title');
    const meetingSubtitle = document.getElementById('meeting-subtitle');
    const summaryContent = document.getElementById('summary-content');

    const subActions = document.getElementById('sub-actions');
    const subDecisions = document.getElementById('sub-decisions');
    const subQuestions = document.getElementById('sub-questions');

    const transcriptTextarea = document.getElementById('transcript-textarea');
    const transcriptSearch = document.getElementById('transcript-search');
    const wordCountBadge = document.getElementById('word-count-badge');
    const charCountBadge = document.getElementById('char-count-badge');
    const copyTranscriptBtn = document.getElementById('copy-transcript-btn');

    // Studio Switcher Elements
    const studioChatTab = document.getElementById('studio-chat-tab');
    const studioTranscriptTab = document.getElementById('studio-transcript-tab');
    const studioChatView = document.getElementById('studio-chat-view');
    const studioTranscriptView = document.getElementById('studio-transcript-view');
    const transcriptStats = document.getElementById('transcript-stats');

    // Chat Elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const suggestionChips = document.querySelectorAll('.suggestion-chip');

    // Export Elements
    const exportTxtBtn = document.getElementById('export-txt-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    // --- Tape Counter Timer Utility ---
    function startTapeCounter() {
        stopTapeCounter();
        tapeSeconds = 0;
        if (tapeCounter) tapeCounter.classList.remove('hidden');
        if (recDot) recDot.className = 'w-2 h-2 rounded-full bg-[#C6402B] animate-pulse';

        tapeTimerInterval = setInterval(() => {
            tapeSeconds++;
            const hrs = String(Math.floor(tapeSeconds / 3600)).padStart(2, '0');
            const mins = String(Math.floor((tapeSeconds % 3600) / 60)).padStart(2, '0');
            const secs = String(tapeSeconds % 60).padStart(2, '0');
            if (tapeTimeDisplay) tapeTimeDisplay.textContent = `${hrs}:${mins}:${secs}`;
        }, 1000);
    }

    function stopTapeCounter(finalStatus = 'READY') {
        if (tapeTimerInterval) {
            clearInterval(tapeTimerInterval);
            tapeTimerInterval = null;
        }
        if (tapeStatusText) tapeStatusText.textContent = finalStatus;
        if (recDot) recDot.className = 'w-2 h-2 rounded-full bg-[#8A8578]';
    }

    // --- Sub-Insight Tabs ---
    const subInsightTabs = document.querySelectorAll('.sub-insight-tab');
    subInsightTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-sub');

            subInsightTabs.forEach(t => {
                t.classList.remove('active', 'text-[#14171C]', 'border-[#C6402B]');
                t.classList.add('text-[#8A8578]', 'border-transparent');
            });
            tab.classList.add('active', 'text-[#14171C]', 'border-[#C6402B]');
            tab.classList.remove('text-[#8A8578]', 'border-transparent');

            [subActions, subDecisions, subQuestions].forEach(el => {
                if (el.id === `sub-${target}`) {
                    el.classList.remove('hidden');
                    el.classList.add('active');
                } else {
                    el.classList.add('hidden');
                    el.classList.remove('active');
                }
            });
        });
    });

    // --- Studio View Switcher ---
    studioChatTab.addEventListener('click', () => {
        studioChatTab.classList.add('active', 'text-[#14171C]', 'bg-[#F7F4EE]');
        studioChatTab.classList.remove('text-[#8A8578]');
        studioTranscriptTab.classList.remove('active', 'text-[#14171C]', 'bg-[#F7F4EE]');
        studioTranscriptTab.classList.add('text-[#8A8578]');

        studioChatView.classList.remove('hidden');
        studioTranscriptView.classList.add('hidden');
        transcriptStats.classList.add('hidden');
    });

    studioTranscriptTab.addEventListener('click', () => {
        studioTranscriptTab.classList.add('active', 'text-[#14171C]', 'bg-[#F7F4EE]');
        studioTranscriptTab.classList.remove('text-[#8A8578]');
        studioChatTab.classList.remove('active', 'text-[#14171C]', 'bg-[#F7F4EE]');
        studioChatTab.classList.add('text-[#8A8578]');

        studioTranscriptView.classList.remove('hidden');
        studioChatView.classList.add('hidden');
        transcriptStats.classList.remove('hidden');
    });

    // --- Source Switcher ---
    sourceYtBtn.addEventListener('click', () => {
        currentSourceType = 'youtube';
        sourceYtBtn.classList.add('bg-[#14171C]', 'text-white');
        sourceYtBtn.classList.remove('text-[#5A564C]');
        sourceFileBtn.classList.remove('bg-[#14171C]', 'text-white');
        sourceFileBtn.classList.add('text-[#5A564C]');
        ytSection.classList.remove('hidden');
        fileSection.classList.add('hidden');
    });

    sourceFileBtn.addEventListener('click', () => {
        currentSourceType = 'file';
        sourceFileBtn.classList.add('bg-[#14171C]', 'text-white');
        sourceFileBtn.classList.remove('text-[#5A564C]');
        sourceYtBtn.classList.remove('bg-[#14171C]', 'text-white');
        sourceYtBtn.classList.add('text-[#5A564C]');
        fileSection.classList.remove('hidden');
        ytSection.classList.add('hidden');
    });

    // --- File Drag & Drop ---
    dropZone.addEventListener('click', () => fileUploadInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-[#14171C]');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-[#14171C]');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-[#14171C]');
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
                alert('Please enter a YouTube video link.');
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

        // Show progress UI & start Tape Counter
        processBtn.disabled = true;
        processBtn.classList.add('opacity-50', 'cursor-not-allowed');
        progressCard.classList.remove('hidden');

        startTapeCounter();
        updateStep(1, 'EXTRACTING AUDIO', 20);

        try {
            updateStep(2, 'TRANSCRIBING AUDIO', 50);

            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Processing failed.');
            }

            updateStep(3, 'SUMMARIZING CONTENT', 80);
            updateStep(4, 'INDEXING VECTOR DATABASE', 95);

            // Store results locally
            currentResults = data;
            renderResults(data);

            updateStep(4, 'TRANSCRIBED', 100);
            stopTapeCounter('TRANSCRIBED');

            setTimeout(() => progressCard.classList.add('hidden'), 1200);

        } catch (err) {
            let msg = err.message || 'Processing failed.';
            if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
                msg = 'Connection to server lost. Make sure backend is running at http://localhost:8000.';
            }
            alert(`Error: ${msg}`);
            stopTapeCounter('FAILED');
            progressCard.classList.add('hidden');
        } finally {
            processBtn.disabled = false;
            processBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });

    function updateStep(stepNum, statusText, percent) {
        progressStatusText.textContent = statusText;
        if (tapeStatusText) tapeStatusText.textContent = statusText;
        progressBarFill.style.width = `${percent}%`;
        progressPercentage.textContent = `${percent}%`;

        [step1Badge, step2Badge, step3Badge, step4Badge].forEach((b, idx) => {
            if (idx + 1 <= stepNum) {
                b.className = 'text-[#14171C] font-bold';
            } else {
                b.className = 'text-[#8A8578] font-normal';
            }
        });
    }

    function renderResults(data) {
        meetingTitle.textContent = data.title;
        meetingSubtitle.textContent = 'Transcript and insights ready.';

        summaryContent.textContent = data.summary;
        subActions.textContent = data.action_items;
        subDecisions.textContent = data.key_decisions;
        subQuestions.textContent = data.open_questions;

        transcriptTextarea.value = data.transcript;

        const words = data.transcript.trim().split(/\s+/).length;
        const chars = data.transcript.length;
        wordCountBadge.textContent = words.toLocaleString();
        charCountBadge.textContent = chars.toLocaleString();

        // Reset chat stream
        chatMessages.innerHTML = `
            <div class="chat-bubble ai bg-white border border-[#D5D1C8] text-[#14171C] p-3 rounded max-w-[90%] text-xs leading-relaxed font-sans">
                <span class="font-mono text-[10px] font-bold text-[#8A8578] block mb-1">AI:</span>
                Indexed transcript for <strong>${data.title}</strong>. Ask any question about this content below.
            </div>
        `;
    }

    // --- Search Transcript ---
    if (transcriptSearch) {
        transcriptSearch.addEventListener('input', () => {
            if (!currentResults || !currentResults.transcript) return;
            const term = transcriptSearch.value.trim().toLowerCase();
            if (!term) {
                transcriptTextarea.value = currentResults.transcript;
                return;
            }
            const lines = currentResults.transcript.split('\n');
            const filtered = lines.filter(l => l.toLowerCase().includes(term));
            transcriptTextarea.value = filtered.length > 0
                ? `--- Search Matches for "${term}" (${filtered.length} lines found) ---\n\n` + filtered.join('\n')
                : `No lines matching "${term}" found in transcript.`;
        });
    }

    // --- Copy Transcript ---
    copyTranscriptBtn.addEventListener('click', () => {
        if (!transcriptTextarea.value) return;
        navigator.clipboard.writeText(transcriptTextarea.value);
        copyTranscriptBtn.textContent = '[ COPIED ]';
        setTimeout(() => {
            copyTranscriptBtn.textContent = '[ COPY ]';
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
        const typingId = appendChatMessage('ai', 'Searching transcript...');

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
                typingElem.innerHTML = `<span class="font-mono text-[10px] font-bold text-[#8A8578] block mb-1">AI:</span>${data.answer}`;
            }

        } catch (err) {
            const typingElem = document.getElementById(typingId);
            if (typingElem) {
                typingElem.innerHTML = `<span class="font-mono text-[10px] font-bold text-[#C6402B] block mb-1">ERROR:</span>${err.message}`;
            }
        }
    }

    function appendChatMessage(role, content) {
        const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        const div = document.createElement('div');
        div.id = msgId;

        if (role === 'user') {
            div.className = 'chat-bubble user bg-[#14171C] text-white p-3 rounded max-w-[90%] text-xs leading-relaxed ml-auto font-sans';
            div.innerHTML = `<span class="font-mono text-[10px] font-bold text-slate-400 block mb-1">YOU:</span>${content}`;
        } else {
            div.className = 'chat-bubble ai bg-white border border-[#D5D1C8] text-[#14171C] p-3 rounded max-w-[90%] text-xs leading-relaxed mr-auto font-sans';
            div.innerHTML = `<span class="font-mono text-[10px] font-bold text-[#8A8578] block mb-1">AI:</span>${content}`;
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
