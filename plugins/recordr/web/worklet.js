// Runs on the audio thread: turns the microphone's float samples into 16-bit
// PCM, keeps one sample out of `factor` (the device rate brought down towards
// 16 kHz), and hands them over in chunks of a tenth of a second.
//
// The chunks do not go to the page but to a port the page passes on: its other
// end is in stream.js, a worker. Audio thread to worker, the page's own thread
// is never on the way — a page in the background is slowed down, these two are
// not.
class RecordrCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.factor = options.processorOptions.factor;
    this.chunk = new Int16Array(options.processorOptions.chunkSize);
    this.filled = 0;
    this.sum = 0;
    this.taken = 0;
    this.out = null;
    this.port.onmessage = (event) => {
      if (event.data && event.data.port) this.out = event.data.port;
    };
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input || !this.out) return true;
    for (let i = 0; i < input.length; i++) {
      // Averaging the samples it replaces is a crude low-pass filter, enough
      // for speech: plain decimation would fold the high frequencies back.
      this.sum += input[i];
      if (++this.taken < this.factor) continue;
      const sample = Math.max(-1, Math.min(1, this.sum / this.factor));
      this.chunk[this.filled++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      this.sum = 0;
      this.taken = 0;
      if (this.filled === this.chunk.length) {
        const copy = this.chunk.buffer.slice(0);
        this.out.postMessage(copy, [copy]);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("recordr-capture", RecordrCapture);
