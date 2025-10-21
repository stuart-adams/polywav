const { contextBridge, ipcRenderer } = require('electron');

// Expose API for the WAV combiner
contextBridge.exposeInMainWorld('api', {
  // File selection
  selectFiles: () => ipcRenderer.send('select-files'),
  onFilesSelected: (callback) => ipcRenderer.on('files-selected', (event, files) => callback(files)),

  // Get file information (channel count, duration, etc.)
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),

  // Output path selection
  selectOutputPath: () => ipcRenderer.invoke('select-output-path'),

  // Combine files
  combineFiles: (options) => ipcRenderer.invoke('combine-files', options),

  // Progress updates
  onProgress: (callback) => ipcRenderer.on('progress-update', (event, progress) => callback(progress))
});
