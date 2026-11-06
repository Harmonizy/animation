"""Sound for DON'T LOOK BACK, synthesised from projects/ta-dont-look-back/episode.json.

This film's horror is mostly silence, so the room tone is barely there and nothing that belongs to
an ordinary night is ever heard: no crickets, no traffic, no wind. Every effect is generated from
noise and sine waves with fixed seeds, so it is original and the same on every run. Cue times come
from episode.json, the same data the picture uses, and the footsteps use the walk's own timing.

Voices are mixed in when artifacts/ta-dont-look-back/voice/<shot>.wav exist, at the starts recorded
in timing.json. The voice behind Ta is kept dry and close; the low tone drops away under it.

    python3 scripts/ta-audio.py      -> artifacts/ta-dont-look-back/audio.wav (48 kHz, 16-bit stereo)
"""

import importlib.util
import json
import os
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('dsp', os.path.join(HERE, 'episode-audio.py'))
dsp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dsp)

RATE = dsp.RATE
N = dsp.N
EPISODE = 'projects/ta-dont-look-back/episode.json'
TIMING = 'projects/ta-dont-look-back/timing.json'
OUT = 'artifacts/ta-dont-look-back'

band, low, env, fade, rng = dsp.band_noise, dsp.lowpass, dsp.envelope, dsp.fade_out, dsp.rng


def thump(seconds, freq, seed, decay=0.06):
    t = dsp.t_axis(seconds)
    body = np.sin(2 * np.pi * freq * t * (1 - 0.3 * t / seconds)) * np.exp(-t / decay)
    return body + 0.25 * low(band(seconds, 80, 900, seed), 600) * env(len(t), 0.002, decay * 0.6)


def breath(seconds, seed, inhale=True, strength=1.0):
    n = int(seconds * RATE)
    air = band(seconds, 400, 3800, seed)
    shape = np.sin(np.linspace(0, np.pi, n)) ** (1.4 if inhale else 2.2)
    return air * shape * 0.35 * strength


def cue(name, start, end, seed, count=1, interval=0.0):
    """Returns (mono signal, pan) for one cue. Gains are set in episode.json."""
    length = (end - start) if end is not None else None
    if name == 'room-tone':
        n = int(length * RATE)
        tone = low(band(length, 20, 300, seed), 160) * 0.35 + band(length, 300, 2000, seed + 1) * 0.02
        return tone * env(n, 0.6, 99, length) * fade(n, 0.6), 0.0
    if name == 'inhale':
        return breath(0.55, seed, True, 1.2), 0.0
    if name in ('fabric', 'bedding', 'clothes'):
        n = int(length * RATE)
        rustle = band(length, 400, 4000, seed) * (0.35 + 0.65 * np.abs(np.sin(2 * np.pi * 1.8 * dsp.t_axis(length))))
        return rustle * env(n, 0.08, 99, length) * fade(n, 0.2) * 0.25, -0.1
    if name == 'button':
        click = band(0.06, 2500, 9000, seed) * env(int(0.06 * RATE), 0.0005, 0.006)
        tick = thump(0.06, 900, seed + 1, 0.01)
        return (click * 0.8 + tick * 0.4), 0.15
    if name == 'cable':
        n = int(length * RATE)
        out = np.zeros(n)
        r = rng(seed)
        for _ in range(int(length * 12)):
            at = r.integers(0, max(1, n - 600))
            out[at:at + 600] += r.uniform(0.2, 0.5) * band(0.02, 1500, 6000, int(at))[:600] * env(600, 0.0005, 0.004)
        return out * 0.6, -0.2
    if name == 'scratch':
        n = int(length * RATE)
        strokes = 0.5 + 0.5 * np.sin(2 * np.pi * 6 * dsp.t_axis(length))
        return band(length, 2000, 7000, seed) * strokes ** 3 * fade(n, 0.1) * 0.22, 0.0
    if name == 'mattress':
        n = int(length * RATE)
        t = dsp.t_axis(length)
        creak = np.sin(2 * np.pi * (180 + 60 * np.sin(2 * np.pi * 2.2 * t)) * t) * 0.15
        return low(creak + band(length, 100, 900, seed) * 0.4, 900) * env(n, 0.1, 99, length) * fade(n, 0.2), -0.25
    if name == 'feet-down':
        out = np.zeros(int(0.5 * RATE))
        for k, at in enumerate([0.0, 0.14]):
            hit = thump(0.3, 70, seed + k, 0.05) * 0.8
            i = int(at * RATE)
            out[i:i + len(hit)] += hit[: len(out) - i]
        return out, -0.1
    if name == 'footsteps':
        total = interval * count + 0.4
        out = np.zeros(int(total * RATE))
        for k in range(count):
            # Bare feet: a soft heel, then the sole meeting the floor.
            step = thump(0.3, 65, seed + k, 0.045) * 0.7
            pat = band(0.08, 600, 3000, seed + 50 + k) * env(int(0.08 * RATE), 0.002, 0.02) * 0.15
            i = int(k * interval * RATE)
            out[i:i + len(step)] += step[: len(out) - i]
            j = i + int(0.05 * RATE)
            out[j:j + len(pat)] += pat[: len(out) - j]
        return out, 0.1
    if name == 'low-tone':
        n = int(length * RATE)
        t = dsp.t_axis(length)
        drone = (np.sin(2 * np.pi * 44 * t) + 0.4 * np.sin(2 * np.pi * 88.3 * t)) * 0.35
        return drone * np.clip(t / (length * 0.7), 0, 1) * fade(n, 0.25), 0.0
    if name in ('breath-shallow', 'breath-controlled'):
        rate = 1.4 if name == 'breath-shallow' else 0.55
        n = int(length * RATE)
        out = np.zeros(n)
        k = 0
        at = 0.0
        while at < length - 0.3:
            half = 0.5 / rate
            b = breath(half * 0.9, seed + k, inhale=k % 2 == 0, strength=0.6 if name == 'breath-shallow' else 0.8)
            i = int(at * RATE)
            out[i:i + len(b)] += b[: n - i]
            at += half
            k += 1
        return out, 0.0
    if name == 'pulse':
        n = int(length * RATE)
        out = np.zeros(n)
        beat = 60 / 62
        at = 0.0
        while at < length - 0.4:
            for offset, strength in ((0.0, 1.0), (0.22, 0.6)):
                hit = low(thump(0.25, 48, seed, 0.07), 140) * strength
                i = int((at + offset) * RATE)
                out[i:i + len(hit)] += hit[: n - i]
            at += beat
        return out * 0.6 * env(n, 1.0, 99, length), 0.0
    raise ValueError(f'Unknown cue {name}')


def lower(data, ratio):
    """The same signal, pitched down by `ratio` and kept the same length (resample, then time-stretch)."""
    import subprocess
    raw = (np.clip(data, -1, 1) * 32767).astype(np.int16).tobytes()
    rate = int(RATE * ratio)
    out = subprocess.run(
        ['ffmpeg', '-loglevel', 'error', '-f', 's16le', '-ar', str(rate), '-ac', '1', '-i', '-',
         '-af', f'aresample={RATE},atempo={1 / ratio:.5f}', '-f', 's16le', '-ac', '1', '-'],
        input=raw, capture_output=True, check=True).stdout
    low_ = np.frombuffer(out, dtype=np.int16).astype(float) / 32768
    return np.pad(low_, (0, max(0, len(data) - len(low_))))[: len(data)]


def mix_presence(mix, data, at):
    """
    The voice behind Ta: dry and close, with a lower double of itself a few milliseconds late, just
    under it, and a breath of air that follows its loudness. It should sound like a voice and not
    quite like a person.
    """
    double = lower(data, 0.78) * 0.5
    double = np.concatenate([np.zeros(int(0.012 * RATE)), double])[: len(data)]
    loud = low(np.abs(data), 30)
    air = band(len(data) / RATE, 2500, 9000, 77)[: len(data)] * loud * 0.6
    voice = data + double + air
    # Very slightly wider than the narrator: it is behind him, not in the speaker.
    mix[0, at:at + len(data)] += voice * 1.05
    mix[1, at:at + len(data)] += np.concatenate([np.zeros(24), voice])[: len(data)] * 1.0


def place(track, signal, start, pan, gain):
    dsp.place(track, signal, start, pan, gain)


def main():
    episode = json.load(open(EPISODE, encoding='utf-8'))
    timing = json.load(open(TIMING, encoding='utf-8'))
    mix = np.zeros((2, N))
    seed = 4000
    for shot in episode['shots']:
        for c in shot['soundCues']:
            seed += 13
            signal, pan = cue(c['cue'], c['start'], c.get('end'), seed, c.get('count', 1), c.get('interval', 0.0))
            place(mix, signal, c['start'], pan, c['gain'])
    # A small, close room: a short reverb only.
    ir_n = int(0.35 * RATE)
    ir = rng(9).standard_normal(ir_n) * np.exp(-np.arange(ir_n) / RATE / 0.09)
    ir /= np.sqrt(np.sum(ir ** 2))
    for ch in range(2):
        wet = np.fft.irfft(np.fft.rfft(mix[ch], N + ir_n) * np.fft.rfft(ir, N + ir_n))[:N]
        mix[ch] = mix[ch] * 0.85 + wet * 0.2

    voices = 0
    for line in timing['lines']:
        path = os.path.join(OUT, 'voice', f"{line['shotId']}.wav")
        if not os.path.exists(path):
            continue
        with wave.open(path) as w:
            if w.getframerate() != RATE:
                sys.exit(f'{path} must be {RATE} Hz')
            data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
            if w.getnchannels() == 2:
                data = data.reshape(-1, 2).mean(axis=1)
        at = int(line['start'] * RATE)
        data = data[: N - at]
        if line['voice'] == 'presence':
            mix_presence(mix, data, at)
        else:
            mix[:, at:at + len(data)] += data * 0.8
        voices += 1

    peak = np.max(np.abs(mix))
    mix = mix / peak * 0.7  # about -3 dBFS: a quiet film, not a loud one
    mix[:, -480:] *= np.linspace(1, 0, 480)
    os.makedirs(OUT, exist_ok=True)
    pcm = (np.clip(mix.T, -1, 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, 'audio.wav'), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())
    lines = len(timing['lines'])
    print(f'Wrote {OUT}/audio.wav: 60.00 s, {RATE} Hz stereo, voice lines mixed: {voices} of {lines}')
    if voices < lines:
        print('Some voice lines are missing: the video will have sound effects but no full voice track.')


if __name__ == '__main__':
    main()
