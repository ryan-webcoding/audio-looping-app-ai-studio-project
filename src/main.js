import "./style.css";

// Audio files are hard-coded for simple GitHub/Vercel deployment.
// Put replacement MP3 files in public/audio and update this list if needed.
const audioFiles = [
  { name: "1.1.mp3", src: "/audio/1.1.mp3", duration: 10.475102040816326 },
  { name: "1.2.mp3", src: "/audio/1.2.mp3", duration: 16.3265306122449 },
  { name: "1.3.mp3", src: "/audio/1.3.mp3", duration: 9.717551020408163 },
  { name: "1.4.mp3", src: "/audio/1.4.mp3", duration: 21.864489795918367 },
  { name: "1.5.mp3", src: "/audio/1.5.mp3", duration: 9.795875 },
  { name: "2.1.mp3", src: "/audio/2.1.mp3", duration: 4.54525 },
  { name: "2.2.mp3", src: "/audio/2.2.mp3", duration: 10.971428571428572 },
  { name: "2.3.mp3", src: "/audio/2.3.mp3", duration: 10.788571428571428 },
  { name: "2.4.mp3", src: "/audio/2.4.mp3", duration: 12.773877551020409 },
  { name: "3.1.mp3", src: "/audio/3.1.mp3", duration: 3.3436734693877552 },
  { name: "3.2.mp3", src: "/audio/3.2.mp3", duration: 10.94530612244898 },
  { name: "3.3.mp3", src: "/audio/3.3.mp3", duration: 12.64326530612245 },
  { name: "3.4.mp3", src: "/audio/3.4.mp3", duration: 23.84979591836735 },
  { name: "3.5.mp3", src: "/audio/3.5.mp3", duration: 9.95265306122449 },
  { name: "3.6.mp3", src: "/audio/3.6.mp3", duration: 14.471836734693877 },
  { name: "4.1.mp3", src: "/audio/4.1.mp3", duration: 7.601632653061224 },
  { name: "4.2.mp3", src: "/audio/4.2.mp3", duration: 9.3779375 },
  { name: "4.3.mp3", src: "/audio/4.3.mp3", duration: 14.994285714285715 }
];

const audio = new Audio();
audio.preload = "metadata";

const state = {
  selectedNames: new Set(audioFiles.map((file) => file.name)),
  currentFile: null,
  currentIndex: 0,
  status: "stopped", // stopped | playing | paused
  isDragging: false,
  desiredPosition: 0,
  playRequestId: 0,
  playbackRate: 1.0
};

const elements = {
  nowPlaying: document.querySelector("#nowPlaying"),
  currentTime: document.querySelector("#currentTime"),
  totalTime: document.querySelector("#totalTime"),
  selectedTotal: document.querySelector("#selectedTotal"),
  progressSlider: document.querySelector("#progressSlider"),
  playPauseBtn: document.querySelector("#playPauseBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  selectAllBtn: document.querySelector("#selectAllBtn"),
  deselectAllBtn: document.querySelector("#deselectAllBtn"),
  speedInput: document.querySelector("#speedInput"),
  speedStatus: document.querySelector("#speedStatus"),
  playlist: document.querySelector("#playlist")
};

const rowElements = new Map();
const checkboxElements = new Map();

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatSpeed(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded.toFixed(1)}x` : `${rounded}x`;
}

function getSelectedPlaylist() {
  return audioFiles.filter((file) => state.selectedNames.has(file.name));
}

function getTotalDuration(playlist = getSelectedPlaylist()) {
  return playlist.reduce((total, file) => total + file.duration, 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getPositionBeforeIndex(playlist, index) {
  return playlist.slice(0, index).reduce((total, file) => total + file.duration, 0);
}

function getCurrentOverallPosition() {
  const playlist = getSelectedPlaylist();

  if (!state.currentFile || state.status === "stopped") {
    return clamp(state.desiredPosition, 0, getTotalDuration(playlist));
  }

  const currentIndex = playlist.findIndex((file) => file.name === state.currentFile.name);

  if (currentIndex === -1) {
    return 0;
  }

  return getPositionBeforeIndex(playlist, currentIndex) + (audio.currentTime || 0);
}

function findTrackAtPosition(position) {
  const playlist = getSelectedPlaylist();
  const total = getTotalDuration(playlist);
  const safePosition = total > 0 ? clamp(position, 0, total - 0.01) : 0;

  let accumulated = 0;

  for (let index = 0; index < playlist.length; index += 1) {
    const file = playlist[index];
    const nextAccumulated = accumulated + file.duration;

    if (safePosition < nextAccumulated) {
      return {
        playlist,
        index,
        file,
        offset: safePosition - accumulated
      };
    }

    accumulated = nextAccumulated;
  }

  return {
    playlist,
    index: 0,
    file: playlist[0],
    offset: 0
  };
}

function updateRangeFill() {
  const total = Number(elements.progressSlider.max) || 1;
  const value = Number(elements.progressSlider.value) || 0;
  const percent = total > 0 ? clamp((value / total) * 100, 0, 100) : 0;
  elements.progressSlider.style.setProperty("--progress", `${percent}%`);
}

function applyPlaybackRate() {
  audio.playbackRate = state.playbackRate;
  audio.defaultPlaybackRate = state.playbackRate;
}

function parseSpeedInput(value) {
  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function cleanSpeedForDisplay(value) {
  return String(value.toFixed(2).replace(/\.00$/, ".0").replace(/0$/, ""));
}

function setPlaybackRateFromInput({ forceClamp = false } = {}) {
  const parsed = parseSpeedInput(elements.speedInput.value);

  if (parsed === null) {
    elements.speedStatus.textContent = "Please enter a speed between 0.1 and 2.0.";

    if (forceClamp) {
      elements.speedInput.value = cleanSpeedForDisplay(state.playbackRate);
    }

    return;
  }

  if (parsed < 0.1 || parsed > 2.0) {
    elements.speedStatus.textContent = "Speed must be between 0.1 and 2.0.";

    if (!forceClamp) {
      return;
    }
  }

  const nextRate = Math.round(clamp(parsed, 0.1, 2.0) * 100) / 100;
  state.playbackRate = nextRate;
  applyPlaybackRate();

  if (forceClamp || document.activeElement !== elements.speedInput) {
    elements.speedInput.value = cleanSpeedForDisplay(state.playbackRate);
  }

  render();
}

function renderStaticPlaylist() {
  elements.playlist.innerHTML = "";

  audioFiles.forEach((file) => {
    const row = document.createElement("label");
    row.className = "track-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selectedNames.add(file.name);
      } else {
        state.selectedNames.delete(file.name);
      }

      handleSelectionChange();
      render();
    });

    const textWrap = document.createElement("span");
    textWrap.className = "track-text";

    const name = document.createElement("span");
    name.className = "track-name";
    name.textContent = file.name;

    const duration = document.createElement("span");
    duration.className = "track-duration";
    duration.textContent = formatTime(file.duration);

    textWrap.append(name, duration);
    row.append(checkbox, textWrap);

    elements.playlist.append(row);
    rowElements.set(file.name, row);
    checkboxElements.set(file.name, checkbox);
  });
}

function render() {
  const playlist = getSelectedPlaylist();
  const total = getTotalDuration(playlist);
  const currentPosition = state.isDragging
    ? Number(elements.progressSlider.value)
    : getCurrentOverallPosition();

  elements.progressSlider.max = String(Math.max(1, total));

  if (!state.isDragging) {
    elements.progressSlider.value = String(clamp(currentPosition, 0, total));
  }

  elements.currentTime.textContent = formatTime(currentPosition);
  elements.totalTime.textContent = formatTime(total);
  elements.selectedTotal.textContent = `Selected audio length: ${formatTime(total)} · At ${formatSpeed(state.playbackRate)}: ${formatTime(total / state.playbackRate)}`;
  if (document.activeElement !== elements.speedInput) {
    elements.speedInput.value = cleanSpeedForDisplay(state.playbackRate);
  }
  elements.speedStatus.textContent = `Current speed: ${formatSpeed(state.playbackRate)}`;
  elements.playPauseBtn.textContent = state.status === "playing" ? "Pause" : "Play";

  if (state.currentFile && state.status !== "stopped") {
    elements.nowPlaying.textContent = state.currentFile.name;
  } else {
    elements.nowPlaying.textContent = "None";
  }

  audioFiles.forEach((file) => {
    const row = rowElements.get(file.name);
    const checkbox = checkboxElements.get(file.name);

    if (checkbox) {
      checkbox.checked = state.selectedNames.has(file.name);
    }

    if (row) {
      row.classList.toggle("active", state.currentFile?.name === file.name && state.status !== "stopped");
      row.classList.toggle("disabled", !state.selectedNames.has(file.name));
    }
  });

  updateRangeFill();
}

function setAudioSource(file, offset, shouldPlay) {
  const requestId = ++state.playRequestId;
  const safeOffset = clamp(offset, 0, Math.max(0, file.duration - 0.05));

  const startOrPrepare = () => {
    if (requestId !== state.playRequestId) return;

    try {
      audio.currentTime = safeOffset;
    } catch {
      // Some browsers delay seekability until slightly later.
    }

    applyPlaybackRate();

    if (shouldPlay) {
      audio.play()
        .then(() => {
          if (requestId !== state.playRequestId) return;
          state.status = "playing";
          render();
        })
        .catch((error) => {
          state.status = "paused";
          render();
          alert(`The browser blocked playback. Tap Play again.\n\n${error.message}`);
        });
    } else {
      state.status = "paused";
      render();
    }
  };

  audio.src = file.src;
  applyPlaybackRate();
  audio.load();

  if (audio.readyState >= 1) {
    startOrPrepare();
  } else {
    audio.addEventListener("loadedmetadata", startOrPrepare, { once: true });
  }
}

function playIndex(index, offset = 0) {
  const playlist = getSelectedPlaylist();

  if (playlist.length === 0) {
    stop();
    return;
  }

  const safeIndex = index >= playlist.length ? 0 : index;
  const file = playlist[safeIndex];

  state.currentIndex = safeIndex;
  state.currentFile = file;
  state.status = "playing";
  state.desiredPosition = getPositionBeforeIndex(playlist, safeIndex) + offset;

  setAudioSource(file, offset, true);
  render();
}

function preparePausedIndex(index, offset = 0) {
  const playlist = getSelectedPlaylist();

  if (playlist.length === 0) {
    stop();
    return;
  }

  const safeIndex = index >= playlist.length ? 0 : index;
  const file = playlist[safeIndex];

  state.currentIndex = safeIndex;
  state.currentFile = file;
  state.status = "paused";
  state.desiredPosition = getPositionBeforeIndex(playlist, safeIndex) + offset;

  setAudioSource(file, offset, false);
  render();
}

function playFromPosition(position) {
  const result = findTrackAtPosition(position);

  if (!result.file) {
    stop();
    return;
  }

  playIndex(result.index, result.offset);
}

function pauseAtPosition(position) {
  const result = findTrackAtPosition(position);

  if (!result.file) {
    stop();
    return;
  }

  preparePausedIndex(result.index, result.offset);
}

function playPause() {
  const playlist = getSelectedPlaylist();

  if (playlist.length === 0) {
    alert("Please select at least one audio file.");
    return;
  }

  if (state.status === "playing") {
    audio.pause();
    state.status = "paused";
    state.desiredPosition = getCurrentOverallPosition();
    render();
    return;
  }

  if (state.status === "paused") {
    applyPlaybackRate();
    audio.play()
      .then(() => {
        state.status = "playing";
        render();
      })
      .catch((error) => {
        alert(`The browser blocked playback. Tap Play again.\n\n${error.message}`);
      });
    return;
  }

  playFromPosition(state.desiredPosition || 0);
}

function stop() {
  state.playRequestId += 1;
  audio.pause();

  try {
    audio.currentTime = 0;
  } catch {
    // Ignore reset errors for unloaded audio.
  }

  audio.removeAttribute("src");
  audio.load();

  state.status = "stopped";
  state.currentFile = null;
  state.currentIndex = 0;
  state.desiredPosition = 0;
  elements.progressSlider.value = "0";
  render();
}

function handleSelectionChange() {
  const playlist = getSelectedPlaylist();
  const total = getTotalDuration(playlist);

  elements.progressSlider.max = String(Math.max(1, total));

  if (playlist.length === 0) {
    stop();
    return;
  }

  if (state.status === "stopped") {
    state.desiredPosition = clamp(state.desiredPosition, 0, total);
    return;
  }

  const currentStillSelected = state.currentFile
    ? playlist.some((file) => file.name === state.currentFile.name)
    : false;

  if (!currentStillSelected) {
    state.desiredPosition = 0;

    if (state.status === "playing") {
      // User requested this exact behavior:
      // if the currently playing file is removed, restart from the beginning.
      playIndex(0, 0);
    } else {
      preparePausedIndex(0, 0);
    }

    return;
  }

  state.currentIndex = playlist.findIndex((file) => file.name === state.currentFile.name);
  state.desiredPosition = getCurrentOverallPosition();
}

function seekTo(position) {
  const playlist = getSelectedPlaylist();

  if (playlist.length === 0) {
    stop();
    return;
  }

  const total = getTotalDuration(playlist);
  const safePosition = position >= total ? 0 : clamp(position, 0, total);
  state.desiredPosition = safePosition;

  if (state.status === "playing") {
    playFromPosition(safePosition);
  } else if (state.status === "paused") {
    pauseAtPosition(safePosition);
  } else {
    render();
  }
}

function selectAll() {
  audioFiles.forEach((file) => state.selectedNames.add(file.name));
  handleSelectionChange();
  render();
}

function deselectAll() {
  state.selectedNames.clear();
  handleSelectionChange();
  render();
}

audio.addEventListener("ended", () => {
  if (state.status !== "playing") return;

  const playlist = getSelectedPlaylist();

  if (playlist.length === 0) {
    stop();
    return;
  }

  const currentIndex = state.currentFile
    ? playlist.findIndex((file) => file.name === state.currentFile.name)
    : state.currentIndex;

  const nextIndex = currentIndex === -1 || currentIndex + 1 >= playlist.length
    ? 0
    : currentIndex + 1;

  playIndex(nextIndex, 0);
});

elements.playPauseBtn.addEventListener("click", playPause);
elements.stopBtn.addEventListener("click", stop);
elements.selectAllBtn.addEventListener("click", selectAll);
elements.deselectAllBtn.addEventListener("click", deselectAll);
elements.speedInput.addEventListener("input", () => setPlaybackRateFromInput());
elements.speedInput.addEventListener("change", () => setPlaybackRateFromInput({ forceClamp: true }));
elements.speedInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    elements.speedInput.blur();
  }
});

elements.progressSlider.addEventListener("input", () => {
  state.isDragging = true;
  const value = Number(elements.progressSlider.value);
  const total = getTotalDuration();
  elements.currentTime.textContent = formatTime(value);
  elements.totalTime.textContent = formatTime(total);
  updateRangeFill();
});

elements.progressSlider.addEventListener("change", () => {
  const value = Number(elements.progressSlider.value);
  state.isDragging = false;
  seekTo(value);
});

elements.progressSlider.addEventListener("pointerdown", () => {
  state.isDragging = true;
});

elements.progressSlider.addEventListener("pointerup", () => {
  const value = Number(elements.progressSlider.value);
  state.isDragging = false;
  seekTo(value);
});

setInterval(() => {
  if (!state.isDragging) {
    render();
  }
}, 250);

applyPlaybackRate();
renderStaticPlaylist();
render();
