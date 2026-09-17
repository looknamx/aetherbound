let context: AudioContext | undefined;
export function tone(enabled: boolean, kind = "ui") {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    void context.resume();
    const osc = context.createOscillator(),
      gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    osc.type = kind === "attack" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(
      kind === "attack" ? 180 : kind === "cast" ? 660 : 480,
      context.currentTime,
    );
    osc.frequency.exponentialRampToValueAtTime(
      kind === "attack" ? 80 : 900,
      context.currentTime + 0.13,
    );
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    osc.start();
    osc.stop(context.currentTime + 0.18);
  } catch {
    /* Audio may be unavailable until a user gesture. */
  }
}
