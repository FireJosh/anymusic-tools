// DOM Elements
const urlInput = document.getElementById('url-input');
const downloadBtn = document.getElementById('download-btn');
const progressSection = document.getElementById('progress-section');
const progressTitle = document.getElementById('progress-title');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');
const progressStatus = document.getElementById('progress-status');
const resultsSection = document.getElementById('results-section');
const fileList = document.getElementById('file-list');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');

// State
let currentTaskId = null;
let pollInterval = null;

// Event Listeners
downloadBtn.addEventListener('click', startDownload);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        startDownload();
    }
});

// Start download
async function startDownload() {
    const url = urlInput.value.trim();
    if (!url) {
        showError('請輸入 YouTube 網址');
        return;
    }

    const isPlaylist = document.querySelector('input[name="download-type"]:checked').value === 'playlist';

    // Reset UI
    hideError();
    hideResults();
    showProgress();
    setButtonLoading(true);

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, is_playlist: isPlaylist })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '下載失敗');
        }

        currentTaskId = data.task_id;
        startPolling();

    } catch (error) {
        hideProgress();
        setButtonLoading(false);
        showError(error.message);
    }
}

// Poll for progress
function startPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
    }

    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/progress/${currentTaskId}`);
            const data = await response.json();

            updateProgress(data);

            if (data.status === 'completed' || data.status === 'error') {
                stopPolling();
            }

        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 500);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// Update progress UI
function updateProgress(data) {
    const statusMessages = {
        'starting': '準備中...',
        'downloading': '下載中...',
        'converting': '轉換為 MP3...',
        'completed': '下載完成！',
        'error': '發生錯誤'
    };

    progressStatus.textContent = statusMessages[data.status] || data.status;
    progressPercent.textContent = `${Math.round(data.progress || 0)}%`;
    progressFill.style.width = `${data.progress || 0}%`;

    if (data.title) {
        progressTitle.textContent = data.title;
    }

    if (data.status === 'completed') {
        hideProgress();
        setButtonLoading(false);
        showResults(data.files);
    } else if (data.status === 'error') {
        hideProgress();
        setButtonLoading(false);
        showError(data.error || '下載失敗');
    }
}

// Show results
function showResults(files) {
    fileList.innerHTML = '';

    if (!files || files.length === 0) {
        showError('沒有找到可下載的檔案');
        return;
    }

    files.forEach(file => {
        const fileName = file.split('/').pop();
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                </svg>
            </div>
            <div class="file-info">
                <div class="file-name" title="${fileName}">${fileName}</div>
            </div>
            <a href="/downloads/${encodeURIComponent(file)}" class="download-link" download>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            </a>
        `;
        fileList.appendChild(item);
    });

    resultsSection.classList.remove('hidden');
}

// UI Helpers
function showProgress() {
    progressSection.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressTitle.textContent = '下載中...';
    progressStatus.textContent = '準備中...';
}

function hideProgress() {
    progressSection.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorSection.classList.remove('hidden');
}

function hideError() {
    errorSection.classList.add('hidden');
}

function hideResults() {
    resultsSection.classList.add('hidden');
}

function setButtonLoading(loading) {
    downloadBtn.disabled = loading;
    if (loading) {
        downloadBtn.classList.add('loading');
        downloadBtn.querySelector('span').textContent = '處理中...';
    } else {
        downloadBtn.classList.remove('loading');
        downloadBtn.querySelector('span').textContent = '開始下載';
    }
}

// ========================================
// Audio Trimmer Functionality
// ========================================

// Trimmer DOM Elements
const uploadArea = document.getElementById('upload-area');
const audioFileInput = document.getElementById('audio-file');
const trimmerControls = document.getElementById('trimmer-controls');
const audioName = document.getElementById('audio-name');
const audioDuration = document.getElementById('audio-duration');
const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const audioSlider = document.getElementById('audio-slider');
const currentTimeSpan = document.getElementById('current-time');
const totalTimeSpan = document.getElementById('total-time');
const startMinInput = document.getElementById('start-min');
const startSecInput = document.getElementById('start-sec');
const endMinInput = document.getElementById('end-min');
const endSecInput = document.getElementById('end-sec');
const trimBtn = document.getElementById('trim-btn');
const trimProgress = document.getElementById('trim-progress');
const trimProgressFill = document.getElementById('trim-progress-fill');
const trimStatus = document.getElementById('trim-status');

// Audio state
let audioElement = null;
let audioFile = null;
let audioDurationSeconds = 0;

// Upload area click
uploadArea.addEventListener('click', () => {
    audioFileInput.click();
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('audio/')) {
        handleAudioFile(files[0]);
    }
});

// File input change
audioFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleAudioFile(e.target.files[0]);
    }
});

// Handle audio file
function handleAudioFile(file) {
    audioFile = file;
    audioName.textContent = file.name;

    // Create audio element
    if (audioElement) {
        audioElement.pause();
        URL.revokeObjectURL(audioElement.src);
    }

    audioElement = new Audio();
    audioElement.src = URL.createObjectURL(file);

    audioElement.addEventListener('loadedmetadata', () => {
        audioDurationSeconds = audioElement.duration;
        const duration = formatTime(audioDurationSeconds);
        audioDuration.textContent = duration;
        totalTimeSpan.textContent = duration;

        // Set end time to full duration
        const mins = Math.floor(audioDurationSeconds / 60);
        const secs = Math.floor(audioDurationSeconds % 60);
        endMinInput.value = mins;
        endSecInput.value = secs;

        // Show controls
        uploadArea.style.display = 'none';
        trimmerControls.classList.remove('hidden');
    });

    audioElement.addEventListener('timeupdate', updateAudioProgress);
    audioElement.addEventListener('ended', () => {
        updatePlayIcon(false);
    });
}

// Format time
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Update audio progress
function updateAudioProgress() {
    if (audioElement && audioDurationSeconds > 0) {
        const progress = (audioElement.currentTime / audioDurationSeconds) * 100;
        audioSlider.value = progress;
        currentTimeSpan.textContent = formatTime(audioElement.currentTime);
    }
}

// Play/Pause button
playBtn.addEventListener('click', () => {
    if (!audioElement) return;

    if (audioElement.paused) {
        audioElement.play();
        updatePlayIcon(true);
    } else {
        audioElement.pause();
        updatePlayIcon(false);
    }
});

// Update play icon
function updatePlayIcon(playing) {
    if (playing) {
        playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    } else {
        playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
}

// Audio slider
audioSlider.addEventListener('input', (e) => {
    if (audioElement && audioDurationSeconds > 0) {
        const time = (e.target.value / 100) * audioDurationSeconds;
        audioElement.currentTime = time;
        currentTimeSpan.textContent = formatTime(time);
    }
});

// Trim button
trimBtn.addEventListener('click', async () => {
    if (!audioFile) {
        showError('請先上傳音訊檔案');
        return;
    }

    const startTime = parseInt(startMinInput.value || 0) * 60 + parseInt(startSecInput.value || 0);
    const endTime = parseInt(endMinInput.value || 0) * 60 + parseInt(endSecInput.value || 0);

    if (startTime >= endTime) {
        showError('開始時間必須小於結束時間');
        return;
    }

    if (endTime > audioDurationSeconds) {
        showError('結束時間超過音訊長度');
        return;
    }

    // Show progress
    trimProgress.classList.remove('hidden');
    trimProgressFill.style.width = '0%';
    trimStatus.textContent = '上傳中...';
    trimBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('audio', audioFile);
        formData.append('start_time', startTime);
        formData.append('end_time', endTime);

        trimProgressFill.style.width = '30%';
        trimStatus.textContent = '處理中...';

        const response = await fetch('/api/trim', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '切割失敗');
        }

        trimProgressFill.style.width = '80%';
        trimStatus.textContent = '準備下載...';

        // Download the file
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trimmed_${audioFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        trimProgressFill.style.width = '100%';
        trimStatus.textContent = '切割完成！';

        setTimeout(() => {
            trimProgress.classList.add('hidden');
        }, 2000);

    } catch (error) {
        showError(error.message);
        trimProgress.classList.add('hidden');
    } finally {
        trimBtn.disabled = false;
    }
});

// Reset trimmer (for uploading new file)
function resetTrimmer() {
    if (audioElement) {
        audioElement.pause();
        URL.revokeObjectURL(audioElement.src);
        audioElement = null;
    }
    audioFile = null;
    audioDurationSeconds = 0;
    uploadArea.style.display = 'flex';
    trimmerControls.classList.add('hidden');
    startMinInput.value = 0;
    startSecInput.value = 0;
    endMinInput.value = 0;
    endSecInput.value = 0;
    audioSlider.value = 0;
    currentTimeSpan.textContent = '00:00';
    totalTimeSpan.textContent = '00:00';
}

// ========================================
// Audio Converter Functionality
// ========================================

// Converter DOM Elements
const convertUploadArea = document.getElementById('convert-upload-area');
const convertFileInput = document.getElementById('convert-file');
const convertControls = document.getElementById('convert-controls');
const convertName = document.getElementById('convert-name');
const convertSize = document.getElementById('convert-size');
const convertBtn = document.getElementById('convert-btn');
const convertProgress = document.getElementById('convert-progress');
const convertProgressFill = document.getElementById('convert-progress-fill');
const convertStatus = document.getElementById('convert-status');

// Converter state
let convertFile = null;

// Only initialize if elements exist
if (convertUploadArea) {
    // Upload area click
    convertUploadArea.addEventListener('click', () => {
        convertFileInput.click();
    });

    // Drag and drop
    convertUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        convertUploadArea.classList.add('dragover');
    });

    convertUploadArea.addEventListener('dragleave', () => {
        convertUploadArea.classList.remove('dragover');
    });

    convertUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        convertUploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleConvertFile(files[0]);
        }
    });

    // File input change
    convertFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleConvertFile(e.target.files[0]);
        }
    });

    // Convert button
    convertBtn.addEventListener('click', startConversion);
}

// Handle convert file
function handleConvertFile(file) {
    convertFile = file;
    convertName.textContent = file.name;

    // Format file size
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    convertSize.textContent = `${sizeInMB} MB`;

    // Show controls
    convertUploadArea.style.display = 'none';
    convertControls.classList.remove('hidden');
}

// Start conversion
async function startConversion() {
    if (!convertFile) {
        showError('請先上傳音訊檔案');
        return;
    }

    // Get selected bitrate
    const bitrateInput = document.querySelector('input[name="bitrate"]:checked');
    const bitrate = bitrateInput ? bitrateInput.value : '192';

    // Show progress
    convertProgress.classList.remove('hidden');
    convertProgressFill.style.width = '0%';
    convertStatus.textContent = '上傳中...';
    convertBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('audio', convertFile);
        formData.append('bitrate', bitrate);

        convertProgressFill.style.width = '30%';
        convertStatus.textContent = '轉換中...';

        const response = await fetch('/api/convert-to-mp3', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '轉換失敗');
        }

        convertProgressFill.style.width = '80%';
        convertStatus.textContent = '準備下載...';

        // Download the file
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Get filename without extension and add .mp3
        const originalName = convertFile.name;
        const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        a.download = `${baseName}.mp3`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        convertProgressFill.style.width = '100%';
        convertStatus.textContent = '轉換完成！';

        setTimeout(() => {
            convertProgress.classList.add('hidden');
            resetConverter();
        }, 2000);

    } catch (error) {
        showError(error.message);
        convertProgress.classList.add('hidden');
    } finally {
        convertBtn.disabled = false;
    }
}

// Reset converter
function resetConverter() {
    convertFile = null;
    if (convertUploadArea) {
        convertUploadArea.style.display = 'flex';
    }
    if (convertControls) {
        convertControls.classList.add('hidden');
    }
}
