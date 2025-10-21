# PolyWav

A professional Electron application for combining multiple WAV files into a single multichannel BWF (Broadcast Wave Format) file.

## Features

- **Multichannel Audio Combining**: Merge any number of WAV files with any channel count into one file
- **Drag & Drop Interface**: Simply drag files into the app or use the file picker
- **Channel Count Detection**: Automatically detects and displays channel count for each file
- **File Reordering**: Arrange files in the order you want channels to appear
- **No File Renaming Required**: Works with files as-is, no need to rename them
- **Custom Output Location**: Choose exactly where your combined file is saved
- **Real-time Progress**: See the combining process status in real-time
- **Bundled FFmpeg**: No external dependencies - FFmpeg is included with the app
- **24-bit PCM Output**: Outputs professional quality 24-bit PCM WAV files

## How It Works

The app uses FFmpeg's `amerge` filter to combine audio files. For example:
- 7.1.4 Atmos file (12 channels) + Stereo file (2 channels) + Mono file (1 channel) = 15-channel output
- Channels are combined in the order files are listed in the UI

## Getting Started

### Installation

```bash
npm install
```

### Run the Application

```bash
npm start
```

### Run in Development Mode
(Opens DevTools automatically)

```bash
npm run dev
```

## Usage

1. **Add Files**: Drag & drop WAV files or click "Select Files"
2. **Reorder** (optional): Use the up/down arrows to arrange files
3. **Choose Output**: Click "Browse" to select where to save the combined file
4. **Combine**: Click "Combine Files" and wait for processing to complete

## Project Structure

```
polywav/
├── main.js           # Main process - FFmpeg integration & IPC handlers
├── preload.js        # Secure bridge for renderer-main communication
├── renderer.js       # UI logic and file management
├── index.html        # Application interface
├── styles.css        # Modern, professional styling
└── package.json      # Dependencies including FFmpeg installers
```

## Technical Details

- **Output Format**: PCM signed 24-bit little-endian (pcm_s24le)
- **FFmpeg Command**: Uses `amerge` filter to combine audio streams
- **Security**: Context isolation, no node integration in renderer
- **Cross-Platform**: Works on macOS, Windows, and Linux

## Dependencies

- `electron`: Application framework
- `@ffmpeg-installer/ffmpeg`: Bundled FFmpeg binary
- `@ffprobe-installer/ffprobe`: Bundled FFprobe for file analysis

## Security

This app follows Electron security best practices:
- Context isolation enabled
- Node integration disabled in renderer
- Content Security Policy configured
- IPC communication through secure preload script
