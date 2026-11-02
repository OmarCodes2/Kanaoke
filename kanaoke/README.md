# Kanaoke

A local-first desktop application for learning Japanese through music, inspired by osu! song selection and karaoke.

## Features

- **Song Library Management**: Scan, import, and create song maps
- **Synchronized Lyrics**: Learn songs with synchronized scrolling lyrics in multiple modes
- **Karaoke Mode**: Sing along with highlighted lyrics
- **Sync Editor**: Line-level timestamp editor for synchronizing lyrics to audio
- **Local Storage**: All data stored locally, no internet required

## Tech Stack

- Electron
- Vite
- React
- TypeScript
- React Router
- Zod (validation)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Package the application:
```bash
npm run package
```

## Song Map Format

Each song is stored as a folder with the `.osj` extension (actually a folder), structured as:

```
<SongName>.osj/
  audio.(mp3|wav|ogg)
  lyrics_ja.txt          (required)
  lyrics_romaji.txt      (optional)
  lyrics_en.txt          (optional)
  timing.json            (required for learn/sing)
  meta.json              (required)
  cover.(png|jpg)        (optional)
```

### meta.json
```json
{
  "id": "uuid",
  "title": "string",
  "artist": "string",
  "source": "string (optional)",
  "durationSec": number (optional),
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

### timing.json
```json
{
  "version": 1,
  "offsetMs": 0,
  "lines": [
    { "index": 0, "startMs": 1234 },
    { "index": 1, "startMs": 2345 }
  ]
}
```

## Usage

### Library Page
- View all songs in your library
- Search and filter songs by sync status
- Select a song to view details and actions

### Import Page
- **Import Tab**: Import an existing `.osj` folder
- **Create Tab**: Create a new song map from audio file and lyrics

### Learn Page
- Listen to songs with synchronized lyrics
- Three modes:
  - **Immersion**: Japanese only
  - **Learning**: Japanese + Romaji
  - **Study**: Japanese + Romaji + English
- Hotkeys:
  - `Space`: Play/Pause
  - `J/K`: Previous/Next line
  - `L`: Toggle loop current line

### Sing Page
- Karaoke mode with larger lyrics
- Optional countdown before starting
- Minimal controls for distraction-free singing

### Editor Page
- Synchronize lyrics to audio
- Stamp timestamps for each line
- Nudge timestamps for fine-tuning
- Adjust offset for latency correction
- Hotkey: `Enter` to stamp next line

## Library Path

By default, the library is stored at:
- Windows: `%APPDATA%/kanaoke/KanaokeLibrary`
- macOS: `~/Library/Application Support/kanaoke/KanaokeLibrary`
- Linux: `~/.config/kanaoke/KanaokeLibrary`

You can change the library path from the Library page.

## Development

The project uses:
- Electron Forge for building and packaging
- Vite for fast development and building
- TypeScript with strict mode
- React Router for navigation

## License

MIT








