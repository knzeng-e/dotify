// Gate the local speaker as well as the room stream. A paused media element
// alone does not silence residual frames in every mobile Web Audio engine.
type HostAudioOutput = {
  context: AudioContext;
  sync: () => void;
  silence: () => void;
  release: () => void;
};

const outputs = new WeakMap<HTMLMediaElement, HostAudioOutput>();

export function registerHostAudioOutput(audio: HTMLMediaElement, output: HostAudioOutput) {
  outputs.set(audio, output);
}

export function syncHostAudioOutput(audio: HTMLMediaElement) {
  outputs.get(audio)?.sync();
}

export function pauseHostAudio(audio: HTMLMediaElement) {
  outputs.get(audio)?.silence();
  audio.pause();
}

// Call before awaiting anything so a mobile host retains the Play gesture.
export function resumeHostAudioOutput(audio: HTMLMediaElement): Promise<void> {
  const output = outputs.get(audio);
  return output ? output.context.resume() : Promise.resolve();
}

export function releaseHostAudioOutput(audio: HTMLMediaElement) {
  const output = outputs.get(audio);
  outputs.delete(audio);
  output?.silence();
  output?.release();
}

export function retireHostAudio(audio: HTMLMediaElement) {
  pauseHostAudio(audio);
  releaseHostAudioOutput(audio);
  audio.removeAttribute('src');
  audio.load();
}
