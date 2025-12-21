// PDF Editor JavaScript

// DOM Elements
const toolGrid = document.querySelector('.tool-grid');
const toolPanel = document.getElementById('tool-panel');
const backBtn = document.getElementById('back-btn');
const pdfError = document.getElementById('pdf-error');
const pdfErrorMessage = document.getElementById('pdf-error-message');
const pdfProgress = document.getElementById('pdf-progress');
const pdfProgressFill = document.getElementById('pdf-progress-fill');
const pdfStatus = document.getElementById('pdf-status');

// Tool cards
const toolCards = document.querySelectorAll('.tool-card');

// State
let currentTool = null;
let selectedFiles = [];
let selectedRotation = 90;

// Tool card click handlers
toolCards.forEach(card => {
    card.addEventListener('click', () => {
        const tool = card.dataset.tool;
        showToolPanel(tool);
    });
});

// Back button
backBtn.addEventListener('click', () => {
    hideToolPanel();
});

// Show tool panel
function showToolPanel(tool) {
    currentTool = tool;
    toolGrid.classList.add('hidden');
    toolPanel.classList.remove('hidden');

    // Hide all panels
    document.querySelectorAll('.operation-panel').forEach(p => p.classList.add('hidden'));

    // Show specific panel
    const panelId = tool === 'extract' ? 'split-panel' :
        tool === 'organize' ? 'split-panel' :
            `${tool}-panel`;
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.remove('hidden');
    }

    // Reset state
    selectedFiles = [];
    hideError();
}

// Hide tool panel
function hideToolPanel() {
    currentTool = null;
    toolGrid.classList.remove('hidden');
    toolPanel.classList.add('hidden');
    selectedFiles = [];
}

// ========== Merge PDF ==========
const mergeUpload = document.getElementById('merge-upload');
const mergeFiles = document.getElementById('merge-files');
const mergeFileList = document.getElementById('merge-file-list');
const mergeBtn = document.getElementById('merge-btn');

mergeUpload.addEventListener('click', () => mergeFiles.click());

mergeUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    mergeUpload.classList.add('dragover');
});

mergeUpload.addEventListener('dragleave', () => {
    mergeUpload.classList.remove('dragover');
});

mergeUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    mergeUpload.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    addMergeFiles(files);
});

mergeFiles.addEventListener('change', (e) => {
    addMergeFiles(Array.from(e.target.files));
});

function addMergeFiles(files) {
    selectedFiles = [...selectedFiles, ...files];
    updateMergeFileList();
}

function updateMergeFileList() {
    mergeFileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-preview-item';
        item.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>${file.name}</span>
            <button class="remove-btn" data-index="${index}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        mergeFileList.appendChild(item);
    });

    // Add remove handlers
    mergeFileList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            selectedFiles.splice(index, 1);
            updateMergeFileList();
        });
    });

    mergeBtn.disabled = selectedFiles.length < 2;
}

mergeBtn.addEventListener('click', async () => {
    if (selectedFiles.length < 2) return;

    showProgress('合併中...');

    try {
        const formData = new FormData();
        selectedFiles.forEach(file => formData.append('pdfs', file));

        const response = await fetch('/api/pdf/merge', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '合併失敗');
        }

        await downloadResponse(response, 'merged.pdf');
        hideProgress();

    } catch (error) {
        hideProgress();
        showError(error.message);
    }
});

// ========== Split/Extract PDF ==========
const splitUpload = document.getElementById('split-upload');
const splitFile = document.getElementById('split-file');
const splitOptions = document.getElementById('split-options');
const splitPages = document.getElementById('split-pages');
const splitBtn = document.getElementById('split-btn');

splitUpload.addEventListener('click', () => splitFile.click());

splitUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    splitUpload.classList.add('dragover');
});

splitUpload.addEventListener('dragleave', () => {
    splitUpload.classList.remove('dragover');
});

splitUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    splitUpload.classList.remove('dragover');
    if (e.dataTransfer.files[0]?.type === 'application/pdf') {
        handleSplitFile(e.dataTransfer.files[0]);
    }
});

splitFile.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleSplitFile(e.target.files[0]);
    }
});

function handleSplitFile(file) {
    selectedFiles = [file];
    splitUpload.querySelector('p').textContent = file.name;
    splitOptions.classList.remove('hidden');
    splitBtn.disabled = false;
}

splitBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    showProgress('處理中...');

    try {
        const formData = new FormData();
        formData.append('pdf', selectedFiles[0]);
        formData.append('pages', splitPages.value);

        const response = await fetch('/api/pdf/split', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '分割失敗');
        }

        await downloadResponse(response, 'extracted.pdf');
        hideProgress();

    } catch (error) {
        hideProgress();
        showError(error.message);
    }
});

// ========== Rotate PDF ==========
const rotateUpload = document.getElementById('rotate-upload');
const rotateFile = document.getElementById('rotate-file');
const rotateOptions = document.getElementById('rotate-options');
const rotatePages = document.getElementById('rotate-pages');
const rotateBtn = document.getElementById('rotate-btn');
const rotationBtns = document.querySelectorAll('.rotation-btn');

rotateUpload.addEventListener('click', () => rotateFile.click());

rotateUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    rotateUpload.classList.add('dragover');
});

rotateUpload.addEventListener('dragleave', () => {
    rotateUpload.classList.remove('dragover');
});

rotateUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    rotateUpload.classList.remove('dragover');
    if (e.dataTransfer.files[0]?.type === 'application/pdf') {
        handleRotateFile(e.dataTransfer.files[0]);
    }
});

rotateFile.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleRotateFile(e.target.files[0]);
    }
});

function handleRotateFile(file) {
    selectedFiles = [file];
    rotateUpload.querySelector('p').textContent = file.name;
    rotateOptions.classList.remove('hidden');
    rotateBtn.disabled = false;
}

rotationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        rotationBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRotation = parseInt(btn.dataset.rotation);
    });
});

rotateBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    showProgress('旋轉中...');

    try {
        const formData = new FormData();
        formData.append('pdf', selectedFiles[0]);
        formData.append('rotation', selectedRotation);
        formData.append('pages', rotatePages.value || 'all');

        const response = await fetch('/api/pdf/rotate', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '旋轉失敗');
        }

        await downloadResponse(response, 'rotated.pdf');
        hideProgress();

    } catch (error) {
        hideProgress();
        showError(error.message);
    }
});

// ========== Delete Pages ==========
const deleteUpload = document.getElementById('delete-upload');
const deleteFile = document.getElementById('delete-file');
const deleteOptions = document.getElementById('delete-options');
const deletePages = document.getElementById('delete-pages');
const deleteBtn = document.getElementById('delete-btn');

deleteUpload.addEventListener('click', () => deleteFile.click());

deleteUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    deleteUpload.classList.add('dragover');
});

deleteUpload.addEventListener('dragleave', () => {
    deleteUpload.classList.remove('dragover');
});

deleteUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    deleteUpload.classList.remove('dragover');
    if (e.dataTransfer.files[0]?.type === 'application/pdf') {
        handleDeleteFile(e.dataTransfer.files[0]);
    }
});

deleteFile.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleDeleteFile(e.target.files[0]);
    }
});

function handleDeleteFile(file) {
    selectedFiles = [file];
    deleteUpload.querySelector('p').textContent = file.name;
    deleteOptions.classList.remove('hidden');
    deleteBtn.disabled = false;
}

deleteBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0 || !deletePages.value.trim()) {
        showError('請輸入要刪除的頁碼');
        return;
    }

    showProgress('刪除中...');

    try {
        const formData = new FormData();
        formData.append('pdf', selectedFiles[0]);
        formData.append('pages', deletePages.value);

        const response = await fetch('/api/pdf/delete', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '刪除失敗');
        }

        await downloadResponse(response, 'modified.pdf');
        hideProgress();

    } catch (error) {
        hideProgress();
        showError(error.message);
    }
});

// ========== Helpers ==========
async function downloadResponse(response, filename) {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showProgress(message) {
    pdfProgress.classList.remove('hidden');
    pdfProgressFill.style.width = '50%';
    pdfStatus.textContent = message;
}

function hideProgress() {
    pdfProgress.classList.add('hidden');
    pdfProgressFill.style.width = '0%';
}

function showError(message) {
    pdfErrorMessage.textContent = message;
    pdfError.classList.remove('hidden');
}

function hideError() {
    pdfError.classList.add('hidden');
}
