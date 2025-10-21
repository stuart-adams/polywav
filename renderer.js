// State management
let inputFiles = [];
let outputPath = '';

// DOM elements
const dropZone = document.getElementById('dropZone');
const selectFilesBtn = document.getElementById('selectFilesBtn');
const fileListSection = document.getElementById('fileListSection');
const fileList = document.getElementById('fileList');
const totalChannelsSpan = document.getElementById('totalChannels');
const addMoreBtn = document.getElementById('addMoreBtn');
const outputSection = document.getElementById('outputSection');
const outputPathInput = document.getElementById('outputPath');
const selectOutputBtn = document.getElementById('selectOutputBtn');
const combineBtn = document.getElementById('combineBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultSection = document.getElementById('resultSection');
const resultMessage = document.getElementById('resultMessage');
const newJobBtn = document.getElementById('newJobBtn');

// Drag and drop handlers
dropZone.addEventListener('click', () => selectFilesBtn.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  const files = Array.from(e.dataTransfer.files).filter(file =>
    file.name.toLowerCase().endsWith('.wav')
  );

  if (files.length > 0) {
    await addFiles(files);
  }
});

// File selection button
selectFilesBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  window.api.selectFiles();
});

addMoreBtn.addEventListener('click', () => {
  window.api.selectFiles();
});

// Listen for file selection from main process
window.api.onFilesSelected(async (files) => {
  await addFiles(files);
});

// Add files to the list
async function addFiles(files) {
  for (const file of files) {
    const filePath = file.path || file;

    // Get file info including channel count
    const fileInfo = await window.api.getFileInfo(filePath);

    inputFiles.push({
      path: filePath,
      name: fileInfo.name,
      channels: fileInfo.channels,
      duration: fileInfo.duration,
      sampleRate: fileInfo.sampleRate,
      bitDepth: fileInfo.bitDepth
    });
  }

  updateUI();
}

// Update the UI
function updateUI() {
  if (inputFiles.length > 0) {
    dropZone.style.display = 'none';
    fileListSection.style.display = 'block';
    outputSection.style.display = 'block';
    renderFileList();
    updateTotalChannels();
    updateCombineButton();
  } else {
    dropZone.style.display = 'block';
    fileListSection.style.display = 'none';
    outputSection.style.display = 'none';
  }
}

// Render file list
function renderFileList() {
  fileList.innerHTML = '';

  // Add table header
  const headerRow = document.createElement('div');
  headerRow.className = 'file-table-header';
  headerRow.innerHTML = `
    <div class="col-filename">Filename</div>
    <div class="col-duration">Duration</div>
    <div class="col-samplerate">Sample Rate</div>
    <div class="col-bitdepth">Bit Depth</div>
    <div class="col-channels">Channels</div>
    <div class="col-actions">Actions</div>
  `;
  fileList.appendChild(headerRow);

  // Add file rows
  inputFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';

    // Format the data values
    const duration = file.duration || '—';
    const sampleRate = file.sampleRate ? `${(file.sampleRate / 1000).toFixed(1)} kHz` : '—';
    const bitDepth = file.bitDepth ? `${file.bitDepth}-bit` : '—';
    const channels = file.channels !== null ? file.channels : '...';

    fileItem.innerHTML = `
      <div class="col-filename" title="${file.name}">${file.name}</div>
      <div class="col-duration">${duration}</div>
      <div class="col-samplerate">${sampleRate}</div>
      <div class="col-bitdepth">${bitDepth}</div>
      <div class="col-channels ${file.channels === null ? 'loading' : ''}">${channels}</div>
      <div class="col-actions">
        ${index > 0 ? `
          <button class="btn-icon" onclick="moveFile(${index}, -1)" title="Move Up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
        ` : ''}
        ${index < inputFiles.length - 1 ? `
          <button class="btn-icon" onclick="moveFile(${index}, 1)" title="Move Down">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        ` : ''}
        <button class="btn-icon" onclick="removeFile(${index})" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    fileList.appendChild(fileItem);
  });
}

// Update total channels
function updateTotalChannels() {
  const total = inputFiles.reduce((sum, file) => {
    return sum + (file.channels || 0);
  }, 0);
  totalChannelsSpan.textContent = total;
}

// Move file in list
window.moveFile = function(index, direction) {
  const newIndex = index + direction;
  if (newIndex >= 0 && newIndex < inputFiles.length) {
    [inputFiles[index], inputFiles[newIndex]] = [inputFiles[newIndex], inputFiles[index]];
    updateUI();
  }
};

// Remove file from list
window.removeFile = function(index) {
  inputFiles.splice(index, 1);
  updateUI();
};

// Select output location
selectOutputBtn.addEventListener('click', async () => {
  const path = await window.api.selectOutputPath();
  if (path) {
    outputPath = path;
    outputPathInput.value = path;
    updateCombineButton();
  }
});

// Update combine button state
function updateCombineButton() {
  const allFilesHaveChannels = inputFiles.every(file => file.channels !== null);
  const hasOutputPath = outputPath.length > 0;
  combineBtn.disabled = !(allFilesHaveChannels && hasOutputPath && inputFiles.length > 0);
}

// Combine files
combineBtn.addEventListener('click', async () => {
  // Hide other sections
  fileListSection.style.display = 'none';
  outputSection.style.display = 'none';
  progressSection.style.display = 'block';

  try {
    const result = await window.api.combineFiles({
      inputFiles: inputFiles.map(f => f.path),
      outputPath: outputPath
    });

    if (result.success) {
      showResult(true, `Successfully created ${inputFiles.reduce((sum, f) => sum + f.channels, 0)}-channel file`);
    } else {
      showResult(false, `Error: ${result.error}`);
    }
  } catch (error) {
    showResult(false, `Error: ${error.message}`);
  }
});

// Listen for progress updates
window.api.onProgress((progress) => {
  progressFill.style.width = `${progress.percent}%`;
  progressText.textContent = progress.message;
});

// Show result
function showResult(success, message) {
  progressSection.style.display = 'none';
  resultSection.style.display = 'block';
  resultMessage.textContent = message;
}

// Start new job
newJobBtn.addEventListener('click', () => {
  inputFiles = [];
  outputPath = '';
  outputPathInput.value = '';
  resultSection.style.display = 'none';
  updateUI();
});
