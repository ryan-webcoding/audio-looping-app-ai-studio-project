# Audio Loop Player

A small mobile-friendly web audio player for the included MP3 files.

## Features

- Play, pause, and stop
- Infinite looping through the selected audio files
- Tick boxes to dynamically include or remove audio files
- If the currently playing file is unticked, playback restarts from the beginning of the selected list
- Progress slider with drag-to-seek
- Timer showing current position and selected total length
- Hard-coded audio list for simple GitHub and Vercel deployment

## Local run

```bash
npm install
npm run dev
```

Then open the local URL shown in the terminal.

## Deploy to Vercel

1. Unzip this folder.
2. Push the folder to a GitHub repository.
3. Import the repository into Vercel.
4. Use the Vite/default settings:
   - Build command: `npm run build`
   - Output directory: `dist`
5. Deploy.

## Replace or add audio files

1. Put MP3 files in `public/audio/`.
2. Edit the `audioFiles` array in `src/main.js`.
3. Update each file name, path, and duration.

For example:

```js
{ name: "example.mp3", src: "/audio/example.mp3", duration: 12.5 }
```
