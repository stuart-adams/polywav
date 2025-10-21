const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Get FFmpeg path (will be from bundled package)
function getFFmpegPath() {
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    let ffmpegPath = ffmpegInstaller.path;

    // In packaged app, replace .asar with .asar.unpacked
    if (ffmpegPath.includes('app.asar')) {
      ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
    }

    console.log('FFmpeg path:', ffmpegPath);
    return ffmpegPath;
  } catch (error) {
    console.error('FFmpeg not found:', error);
    return null;
  }
}

// Get FFprobe path (will be from bundled package)
function getFFprobePath() {
  try {
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    let ffprobePath = ffprobeInstaller.path;

    // In packaged app, replace .asar with .asar.unpacked
    if (ffprobePath.includes('app.asar')) {
      ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
    }

    console.log('FFprobe path:', ffprobePath);
    return ffprobePath;
  } catch (error) {
    console.error('FFprobe not found:', error);
    return null;
  }
}

// Setup IPC handlers
function setupIpcHandlers() {
  // File selection
  ipcMain.on('select-files', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'WAV Files', extensions: ['wav'] }
      ]
    });

    if (!result.canceled) {
      event.sender.send('files-selected', result.filePaths);
    }
  });

  // Get file information using FFprobe
  ipcMain.handle('get-file-info', async (event, filePath) => {
    const ffprobePath = getFFprobePath();
    if (!ffprobePath) {
      return {
        name: path.basename(filePath),
        channels: null,
        duration: null,
        sampleRate: null,
        error: 'FFprobe not found'
      };
    }

    return new Promise((resolve) => {
      const args = [
        '-v', 'error',
        '-show_entries', 'stream=channels,sample_rate,duration',
        '-of', 'json',
        filePath
      ];

      const ffprobe = spawn(ffprobePath, args);
      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const data = JSON.parse(output);
            const audioStream = data.streams.find(s => s.channels);

            if (audioStream) {
              const duration = audioStream.duration
                ? formatDuration(parseFloat(audioStream.duration))
                : null;

              resolve({
                name: path.basename(filePath),
                channels: audioStream.channels,
                sampleRate: audioStream.sample_rate ? `${audioStream.sample_rate}` : null,
                duration: duration
              });
            } else {
              resolve({
                name: path.basename(filePath),
                channels: null,
                duration: null,
                sampleRate: null,
                error: 'No audio stream found'
              });
            }
          } catch (error) {
            resolve({
              name: path.basename(filePath),
              channels: null,
              duration: null,
              sampleRate: null,
              error: error.message
            });
          }
        } else {
          resolve({
            name: path.basename(filePath),
            channels: null,
            duration: null,
            sampleRate: null,
            error: errorOutput || `FFprobe exited with code ${code}`
          });
        }
      });
    });
  });

  // Select output path
  ipcMain.handle('select-output-path', async (event) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: 'WAV Files', extensions: ['wav'] }
      ],
      defaultPath: 'combined_output.wav'
    });

    return result.canceled ? null : result.filePath;
  });

  // Combine files using FFmpeg
  ipcMain.handle('combine-files', async (event, options) => {
    const { inputFiles, outputPath } = options;
    const ffmpegPath = getFFmpegPath();

    if (!ffmpegPath) {
      return { success: false, error: 'FFmpeg not found' };
    }

    return new Promise((resolve) => {
      // Build FFmpeg command
      const args = [];

      // Add input files
      inputFiles.forEach(file => {
        args.push('-i', file);
      });

      // Build filter_complex string
      const inputIndices = inputFiles.map((_, i) => `[${i}:a]`).join('');
      args.push('-filter_complex', `${inputIndices}amerge=inputs=${inputFiles.length}`);

      // Output codec (24-bit PCM)
      args.push('-c:a', 'pcm_s24le');

      // Output file
      args.push(outputPath);

      // Spawn FFmpeg process
      const ffmpeg = spawn(ffmpegPath, args);

      let errorOutput = '';
      let lastProgress = 0;

      // Send initial progress
      mainWindow.webContents.send('progress-update', {
        percent: 0,
        message: 'Starting FFmpeg...'
      });

      ffmpeg.stderr.on('data', (data) => {
        const line = data.toString();
        errorOutput += line;

        // Parse progress from FFmpeg output
        const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = parseFloat(timeMatch[3]);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;

          // Estimate progress (this is approximate)
          // We'll just increment gradually
          lastProgress = Math.min(lastProgress + 5, 95);

          mainWindow.webContents.send('progress-update', {
            percent: lastProgress,
            message: `Processing... ${Math.floor(totalSeconds)}s processed`
          });
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          mainWindow.webContents.send('progress-update', {
            percent: 100,
            message: 'Complete!'
          });

          resolve({ success: true });
        } else {
          console.error('FFmpeg error:', errorOutput);
          resolve({
            success: false,
            error: `FFmpeg failed with code ${code}. Check console for details.`
          });
        }
      });

      ffmpeg.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });
    });
  });
}

// Format duration in seconds to readable string
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
