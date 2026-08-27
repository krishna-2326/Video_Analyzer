document.addEventListener('DOMContentLoaded', () => {

    // ── State ─────────────────────────────────────────────────
    let currentSourceType = 'youtube';
    let selectedFile = null;
    let currentResults = null;
    let pollTimer = null;

    const RING_CIRCUMFERENCE = 263.89; // 2 * PI * 42

    // ── DOM Refs ──────────────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const els = {
        sourceYtBtn:    $('#source-yt-btn'),
        sourceFileBtn:  $('#source-file-btn'),
        ytSection:      $('#youtube-input-section'),
        fileSection:    $('#file-input-section'),
        ytUrlInput:     $('#youtube-url-input'),
        fileUpload:     $('#file-upload-input'),
        dropZone:       $('#drop-zone'),
        fileInfo:       $('#file-info'),
        fileName:       $('#file-name'),
        fileSize:       $('#file-size'),
        removeFile:     $('#remove-file'),
        langSelect:     $('#language-select'),
        processBtn:     $('#process-btn'),
        progressCard:   $('#progress-card'),
        progressStatus: $('#progress-status-text'),
        progressPct:    $('#progress-percentage'),
        progressRing:   $('#progress-ring-circle'),
        step1: $('#step-1-badge'),
        step2: $('#step-2-badge'),
        step3: $('#step-3-badge'),
        step4: $('#step-4-badge'),
        meetingTitle:     $('#meeting-title'),
        meetingSubtitle:  $('#meeting-subtitle'),
        summaryContent:   $('#summary-content'),
        actionItems:      $('#action-items-content'),
        keyDecisions:     $('#key-decisions-content'),
        openQuestions:    $('#open-questions-content'),
        transcriptArea:   $('#transcript-textarea'),
        wordCount:        $('#word-count-badge'),
        charCount:        $('#char-count-badge'),
        readTime:         $('#read-time-badge'),
        copyTranscript:   $('#copy-transcript-btn'),
        searchTranscript: $('#search-transcript-btn'),
        searchBar:        $('#transcript-search-bar'),
        searchInput:      $('#transcript-search-input'),
        searchCount:      $('#search-results-count'),
        searchPrev:       $('#search-prev'),
        searchNext:       $('#search-next'),
        searchClose:      $('#search-close'),
        chatMessages:     $('#chat-messages'),
        chatInput:        $('#chat-input'),
        sendChatBtn:      $('#send-chat-btn'),
        exportTxt:        $('#export-txt-btn'),
        exportPdf:        $('#export-pdf-btn'),
    };

    // ── Toast System ──────────────────────────────────────────
    function showToast(type, title, message, duration = 4000) {
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
        toast.innerHTML = `
            <i class="fa-solid ${icons[type] || icons.info} toast-icon"></i>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
        container.appendChild(toast);

        setTimeout(() => removeToast(toast), duration);
    }

    function removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }

    // ── Tab Switching ─────────────────────────────────────────
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            $$('.tab-btn').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            $$('.tab-pane').forEach(pane => {
                pane.classList.add('hidden');
                pane.classList.remove('active');
            });

            const targetPane = $(`#tab-${target}`);
            if (targetPane) {
                targetPane.classList.remove('hidden');
                targetPane.classList.add('active');
            }
        });
    });

    // ── Source Switcher ───────────────────────────────────────
    els.sourceYtBtn?.addEventListener('click', () => {
        currentSourceType = 'youtube';
        els.sourceYtBtn.classList.add('active');
        els.sourceYtBtn.setAttribute('aria-selected', 'true');
        els.sourceFileBtn.classList.remove('active');
        els.sourceFileBtn.setAttribute('aria-selected', 'false');
        els.ytSection?.classList.remove('hidden');
        els.fileSection?.classList.add('hidden');
    });

    els.sourceFileBtn?.addEventListener('click', () => {
        currentSourceType = 'file';
        els.sourceFileBtn.classList.add('active');
        els.sourceFileBtn.setAttribute('aria-selected', 'true');
        els.sourceYtBtn.classList.remove('active');
        els.sourceYtBtn.setAttribute('aria-selected', 'false');
        els.fileSection?.classList.remove('hidden');
        els.ytSection?.classList.add('hidden');
    });

    // ── File Upload & Drag/Drop ───────────────────────────────
    els.dropZone?.addEventListener('click', () => els.fileUpload?.click());
    els.dropZone?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileUpload?.click(); }
    });

    els.dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        els.dropZone.classList.add('dragover');
    });

    els.dropZone?.addEventListener('dragleave', () => {
        els.dropZone.classList.remove('dragover');
    });

    els.dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        els.dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
    });

    els.fileUpload?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });

    function handleFileSelect(file) {
        selectedFile = file;
        if (els.fileName) els.fileName.textContent = file.name;
        if (els.fileSize) els.fileSize.textContent = formatBytes(file.size);
        els.dropZone?.classList.add('hidden');
        els.fileInfo?.classList.remove('hidden');
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    els.removeFile?.addEventListener('click', () => {
        selectedFile = null;
        if (els.fileUpload) els.fileUpload.value = '';
        els.fileInfo?.classList.add('hidden');
        els.dropZone?.classList.remove('hidden');
    });

    // ── Process & Analyze ─────────────────────────────────────
    els.processBtn?.addEventListener('click', async () => {
        if (els.processBtn.disabled) return;

        const formData = new FormData();
        formData.append('source_type', currentSourceType);
        formData.append('language', els.langSelect?.value || 'english');

        if (currentSourceType === 'youtube') {
            const url = els.ytUrlInput?.value.trim();
            if (!url) {
                showToast('error', 'URL Required', 'Please enter a YouTube video URL.');
                els.ytUrlInput?.focus();
                return;
            }
            formData.append('youtube_url', url);
        } else {
            if (!selectedFile) {
                showToast('error', 'File Required', 'Please select an audio or video file to upload.');
                return;
            }
            formData.append('file', selectedFile);
        }

        setProcessing(true);
        updateProgress('Starting analysis...', 10);

        try {
            const res = await fetch('/api/process', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) throw new Error(data.detail || 'Failed to start processing.');

            showToast('info', 'Processing Started', 'Your media is being analyzed. This may take a few minutes.');
            pollJobStatus(data.job_id);

        } catch (err) {
            handleProcessingError(err.message);
        }
    });

    function setProcessing(active) {
        if (els.processBtn) {
            els.processBtn.disabled = active;
            els.processBtn.querySelector('.btn-content')?.classList.toggle('hidden', active);
            els.processBtn.querySelector('.btn-loading')?.classList.toggle('hidden', !active);
        }
        if (active) {
            els.progressCard?.classList.remove('hidden');
        }
    }

    function pollJobStatus(jobId) {
        if (pollTimer) clearInterval(pollTimer);

        pollTimer = setInterval(async () => {
            try {
                const res = await fetch(`/api/status/${jobId}`);
                const data = await res.json();

                if (!res.ok) {
                    clearInterval(pollTimer);
                    throw new Error(data.detail || 'Failed to fetch status.');
                }

                updateProgress(data.status_text, data.percent);

                if (data.status === 'complete') {
                    clearInterval(pollTimer);
                    currentResults = data.result;
                    renderResults(data.result);
                    showToast('success', 'Analysis Complete', 'Your video has been fully processed!');
                    setTimeout(() => els.progressCard?.classList.add('hidden'), 2000);
                    setProcessing(false);
                } else if (data.status === 'failed') {
                    clearInterval(pollTimer);
                    handleProcessingError(data.error);
                }

            } catch (err) {
                console.error('Poll error:', err);
            }
        }, 1500);
    }

    function handleProcessingError(errorMsg) {
        els.progressCard?.classList.add('hidden');
        setProcessing(false);

        const isBotCheck = /Sign in|bot|auth|YouTube download|429/i.test(errorMsg);

        if (isBotCheck && currentSourceType === 'youtube') {
            showToast('error', 'YouTube Blocked', 'YouTube blocked this request. Try uploading the file directly instead.');
            els.sourceFileBtn?.click();
        } else {
            showToast('error', 'Processing Failed', errorMsg);
        }
    }

    function updateProgress(statusText, percent) {
        if (els.progressStatus) els.progressStatus.textContent = statusText;
        if (els.progressPct) els.progressPct.textContent = `${percent}%`;

        // SVG ring
        if (els.progressRing) {
            const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
            els.progressRing.style.strokeDashoffset = offset;
        }

        // Step badges
        const steps = [
            { el: els.step1, threshold: 20 },
            { el: els.step2, threshold: 50 },
            { el: els.step3, threshold: 75 },
            { el: els.step4, threshold: 95 },
        ];
        steps.forEach(({ el, threshold }) => {
            if (el) {
                if (percent >= threshold) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            }
        });
    }

    // ── Render Results ────────────────────────────────────────
    function renderResults(data) {
        // Title
        if (els.meetingTitle) {
            els.meetingTitle.innerHTML = `<i class="fa-solid fa-chart-column"></i> ${escapeHtml(data.title)}`;
        }
        if (els.meetingSubtitle) {
            els.meetingSubtitle.textContent = 'Analysis complete. Explore summaries, insights, and AI chat below.';
        }

        // Content
        if (els.summaryContent) els.summaryContent.textContent = data.summary;
        if (els.actionItems) els.actionItems.textContent = data.action_items;
        if (els.keyDecisions) els.keyDecisions.textContent = data.key_decisions;
        if (els.openQuestions) els.openQuestions.textContent = data.open_questions;

        // Transcript
        if (els.transcriptArea) els.transcriptArea.value = data.transcript;

        // Stats with animation
        const words = data.transcript.trim().split(/\s+/).length;
        const chars = data.transcript.length;
        const readMin = Math.max(1, Math.round(words / 200));
        animateCounter(els.wordCount, words);
        animateCounter(els.charCount, chars);
        if (els.readTime) els.readTime.textContent = readMin;

        // Reset chat
        if (els.chatMessages) {
            els.chatMessages.innerHTML = `
                <div class="chat-msg ai">
                    <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
                    <div class="chat-bubble ai">
                        I've analyzed <strong>${escapeHtml(data.title)}</strong>. Ask me anything about the content.
                    </div>
                </div>
            `;
        }

        // Scroll to results
        setTimeout(() => {
            els.meetingTitle?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }

    function animateCounter(el, target) {
        if (!el) return;
        const duration = 800;
        const start = performance.now();
        const from = parseInt(el.textContent) || 0;

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out quad
            const eased = 1 - (1 - progress) * (1 - progress);
            const current = Math.round(from + (target - from) * eased);
            el.textContent = current.toLocaleString();
            if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Copy Transcript ───────────────────────────────────────
    els.copyTranscript?.addEventListener('click', async () => {
        if (!els.transcriptArea?.value) return;
        try {
            await navigator.clipboard.writeText(els.transcriptArea.value);
            showToast('success', 'Copied!', 'Transcript copied to clipboard.');
            els.copyTranscript.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => {
                els.copyTranscript.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
            }, 2000);
        } catch {
            showToast('error', 'Copy Failed', 'Could not copy to clipboard.');
        }
    });

    // ── Transcript Search ─────────────────────────────────────
    let searchMatches = [];
    let searchIndex = -1;

    els.searchTranscript?.addEventListener('click', () => {
        els.searchBar?.classList.toggle('hidden');
        if (!els.searchBar?.classList.contains('hidden')) {
            els.searchInput?.focus();
        } else {
            clearHighlight();
        }
    });

    els.searchClose?.addEventListener('click', () => {
        els.searchBar?.classList.add('hidden');
        clearHighlight();
    });

    els.searchInput?.addEventListener('input', () => {
        const query = els.searchInput.value.trim().toLowerCase();
        highlightSearch(query);
    });

    els.searchPrev?.addEventListener('click', () => navigateSearch(-1));
    els.searchNext?.addEventListener('click', () => navigateSearch(1));

    els.searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.shiftKey ? navigateSearch(-1) : navigateSearch(1);
        }
        if (e.key === 'Escape') {
            els.searchBar?.classList.add('hidden');
            clearHighlight();
        }
    });

    function highlightSearch(query) {
        clearHighlight();
        if (!query || !els.transcriptArea) return;

        const text = els.transcriptArea.value;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const matches = [...text.matchAll(regex)];
        searchMatches = matches;
        searchIndex = matches.length > 0 ? 0 : -1;

        if (els.searchCount) {
            els.searchCount.textContent = matches.length > 0 ? `${matches.length} found` : 'No matches';
        }

        if (matches.length > 0) {
            scrollToMatch(0);
        }
    }

    function navigateSearch(dir) {
        if (searchMatches.length === 0) return;
        searchIndex = (searchIndex + dir + searchMatches.length) % searchMatches.length;
        scrollToMatch(searchIndex);
    }

    function scrollToMatch(index) {
        if (!els.transcriptArea || index < 0 || index >= searchMatches.length) return;
        const match = searchMatches[index];
        els.transcriptArea.focus();
        els.transcriptArea.setSelectionRange(match.index, match.index + match[0].length);
        if (els.searchCount) {
            els.searchCount.textContent = `${index + 1}/${searchMatches.length}`;
        }
    }

    function clearHighlight() {
        searchMatches = [];
        searchIndex = -1;
        if (els.searchCount) els.searchCount.textContent = '';
        if (els.searchInput) els.searchInput.value = '';
    }

    // ── AI Chat ───────────────────────────────────────────────
    els.sendChatBtn?.addEventListener('click', sendChatMessage);
    els.chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    $$('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const q = chip.dataset.q || chip.textContent.trim();
            if (els.chatInput) els.chatInput.value = q;
            sendChatMessage();
        });
    });

    async function sendChatMessage() {
        if (!els.chatInput) return;
        const question = els.chatInput.value.trim();
        if (!question) return;

        if (!currentResults) {
            showToast('info', 'No Content', 'Process a video or audio file first.');
            return;
        }

        // Add user message
        appendChat('user', escapeHtml(question));
        els.chatInput.value = '';
        if (els.sendChatBtn) els.sendChatBtn.disabled = true;

        // Typing indicator
        const typingId = appendChat('ai', `
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        `, true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to get answer.');

            updateChatBubble(typingId, data.answer);

        } catch (err) {
            updateChatBubble(typingId, `<span style="color: var(--error);">Error: ${escapeHtml(err.message)}</span>`);
        } finally {
            if (els.sendChatBtn) els.sendChatBtn.disabled = false;
            els.chatInput?.focus();
        }
    }

    function appendChat(role, content, isTyping = false) {
        if (!els.chatMessages) return null;

        const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        const div = document.createElement('div');
        div.id = msgId;
        div.className = `chat-msg ${role}`;

        const avatar = role === 'ai'
            ? '<div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>'
            : '<div class="chat-avatar"><i class="fa-solid fa-user"></i></div>';

        const bubbleClass = isTyping ? 'chat-bubble ai typing' : `chat-bubble ${role}`;
        div.innerHTML = `${avatar}<div class="${bubbleClass}">${content}</div>`;

        els.chatMessages.appendChild(div);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;

        return msgId;
    }

    function updateChatBubble(msgId, html) {
        const el = document.getElementById(msgId);
        if (!el) return;
        const bubble = el.querySelector('.chat-bubble');
        if (bubble) {
            bubble.classList.remove('typing');
            bubble.innerHTML = html;
        }
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    // ── Export ────────────────────────────────────────────────
    els.exportTxt?.addEventListener('click', () => triggerExport('txt'));
    els.exportPdf?.addEventListener('click', () => triggerExport('pdf'));

    async function triggerExport(format) {
        if (!currentResults) {
            showToast('info', 'No Content', 'Process a video or audio file first.');
            return;
        }

        try {
            showToast('info', 'Generating...', `Preparing ${format.toUpperCase()} report.`, 2000);

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
            window.URL.revokeObjectURL(url);

            showToast('success', 'Downloaded', `${format.toUpperCase()} report saved.`);

        } catch (err) {
            showToast('error', 'Export Failed', err.message);
        }
    }

    // ── Keyboard Shortcuts ────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to send chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (document.activeElement === els.chatInput) {
                e.preventDefault();
                sendChatMessage();
            }
        }
    });

    // ── Status pill updates ───────────────────────────────────
    function setStatus(text) {
        const statusText = $('.status-text');
        if (statusText) statusText.textContent = text;
    }

    // Update status pill based on health check
    fetch('/api/health').then(r => r.json()).then(data => {
        if (data.status === 'ok') {
            setStatus('Connected');
        } else {
            setStatus('Error');
        }
    }).catch(() => {
        setStatus('Offline');
    });

});
