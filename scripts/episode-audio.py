"""Synthesises the soundtrack of The Hollow Bell Crypt from episode.json.

Every sound is generated here from noise and sine partials, so the soundtrack is original and
needs no licence. Seeds are fixed, so the same file is produced every time. Sound cue times come
from episode.json, the same file the picture and subtitles use.

    python3 scripts/episode-audio.py                    music and effects, plus narration if present

Narration is mixed in only when artifacts/episode/narration/<shot>.wav files exist (see
scripts/episode-narration.mjs). Without them the soundtrack has no voice, and says so.

Output: artifacts/episode/audio.wav, 48 kHz, 16-bit stereo, exactly 60 s.
"""

import json
import os
import sys
import wave

import numpy as np

RATE = 48_000
DURATION = 60.0
N = int(RATE * DURATION)
EPISODE = 'projects/harmonie/hollow-bell-crypt/episode.json'
OUT = 'artifacts/episode'


def rng(seed):
    return np.random.default_rng(seed)


def t_axis(seconds):
    return np.arange(int(seconds * RATE)) / RATE


def band_noise(seconds, low, high, seed):
    """White noise limited to a frequency band, by masking its spectrum."""
    n = int(seconds * RATE)
    spectrum = np.fft.rfft(rng(seed).standard_normal(n))
    freqs = np.fft.rfftfreq(n, 1 / RATE)
    mask = (freqs >= low) & (freqs <= high)
    # Soft edges so the band does not ring.
    edge = 0.15
    mask = mask.astype(float)
    mask += np.clip(1 - np.abs(freqs - low) / (low * edge + 1), 0, 1) * (freqs < low)
    mask += np.clip(1 - np.abs(freqs - high) / (high * edge + 1), 0, 1) * (freqs > high)
    out = np.fft.irfft(spectrum * mask, n)
    return out / (np.max(np.abs(out)) + 1e-9)


def lowpass(signal, cutoff):
    n = len(signal)
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(n, 1 / RATE)
    spectrum *= 1 / np.sqrt(1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spectrum, n)


def envelope(n, attack, release, hold=0.0):
    """Attack, optional hold, then exponential release, in seconds."""
    t = np.arange(n) / RATE
    env = np.minimum(1, t / max(attack, 1e-4))
    after = np.maximum(0, t - attack - hold)
    return env * np.exp(-after / max(release, 1e-4))


def partials(seconds, base, ratios, decays, amps, seed=0, detune=0.0):
    t = t_axis(seconds)
    out = np.zeros_like(t)
    jitter = rng(seed).uniform(-detune, detune, len(ratios))
    for ratio, decay, amp, j in zip(ratios, decays, amps, jitter):
        out += amp * np.sin(2 * np.pi * base * ratio * (1 + j) * t) * np.exp(-t / decay)
    return out


def bell(seconds, base, decay, seed):
    """A bronze bell: hum, prime, tierce, quint and nominal, with slow beating."""
    ratios = [0.5, 1.0, 1.19, 1.5, 2.0, 2.52, 3.0, 4.07]
    decays = [decay * 1.4, decay, decay * 0.8, decay * 0.7, decay * 0.55, decay * 0.4, decay * 0.3, decay * 0.2]
    amps = [0.5, 1.0, 0.6, 0.35, 0.5, 0.25, 0.2, 0.12]
    out = partials(seconds, base, ratios, decays, amps, seed, detune=0.002)
    strike = band_noise(seconds, 800, 6000, seed + 1) * envelope(int(seconds * RATE), 0.001, 0.03)
    return out + 0.3 * strike


def clink(seconds, base, seed):
    ratios = [1.0, 1.59, 2.14, 2.92, 3.6]
    return partials(seconds, base, ratios, [0.18, 0.12, 0.09, 0.06, 0.04], [1, 0.7, 0.5, 0.35, 0.2], seed, detune=0.01)


# ---------------------------------------------------------------------------------------------
# Sound cues. Each returns (mono signal, pan from -1 left to 1 right).
# ---------------------------------------------------------------------------------------------

def cue_signal(cue, start, end, seed):
    length = (end - start) if end is not None else None
    name = cue
    if name == 'rumble':
        n = int(length * RATE)
        return lowpass(band_noise(length, 20, 120, seed), 90) * envelope(n, 0.8, 99, length) * 0.9, 0.0
    if name == 'coin-impact':
        hit = clink(1.4, 2350, seed)
        bounce = np.zeros_like(hit)
        offset = int(0.11 * RATE)
        bounce[offset:] = 0.45 * clink(1.4, 2420, seed + 1)[: len(hit) - offset]
        thud = lowpass(band_noise(1.4, 60, 400, seed + 2), 300) * envelope(len(hit), 0.001, 0.05)
        return hit + bounce + 0.6 * thud, -0.2
    if name == 'wind':
        n = int(length * RATE)
        base = band_noise(length, 200, 1600, seed)
        sway = 0.6 + 0.4 * np.sin(2 * np.pi * 0.23 * t_axis(length) + 1.3)
        return base * sway * envelope(n, 1.0, 99, length) * fade_out(n, 1.0) * 0.5, 0.3
    if name == 'stone-vibration':
        return lowpass(band_noise(2.5, 25, 200, seed), 150) * envelope(int(2.5 * RATE), 0.3, 0.8), 0.0
    if name == 'bell-toll':
        return bell(7.0, 98, 2.8, seed), 0.0
    if name == 'stone-move':
        n = int(length * RATE)
        grind = band_noise(length, 60, 900, seed)
        grain = 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 7 * t_axis(length)))
        return lowpass(grind * grain, 700) * envelope(n, 0.2, 99, length) * fade_out(n, 0.4) * 0.8, -0.1
    if name == 'dust':
        n = int(length * RATE)
        return band_noise(length, 3000, 9000, seed) * envelope(n, 0.3, 99, length) * fade_out(n, 0.8) * 0.25, 0.2
    if name == 'torch-crackle':
        n = int(length * RATE)
        base = band_noise(length, 300, 3000, seed) * 0.18
        r = rng(seed + 5)
        for _ in range(int(length * 9)):
            at = r.integers(0, max(1, n - 2400))
            base[at:at + 2400] += r.uniform(0.2, 0.6) * band_noise(0.05, 1500, 8000, int(at))[:2400] * envelope(2400, 0.0005, 0.008)
        return base * envelope(n, 0.3, 99, length) * fade_out(n, 0.3), -0.45
    if name == 'low-rise':
        n = int(length * RATE)
        t = t_axis(length)
        tone = np.sin(2 * np.pi * (38 + 10 * t / length) * t) * 0.6
        return (tone + 0.3 * lowpass(band_noise(length, 30, 200, seed), 120)) * (t / length) * fade_out(n, 0.5), 0.0
    if name == 'scrape':
        n = int(1.2 * RATE)
        return band_noise(1.2, 400, 2400, seed) * envelope(n, 0.25, 0.35) * 0.6, 0.35
    if name == 'whisper':
        n = int(length * RATE)
        breath = band_noise(length, 1800, 7000, seed)
        r = rng(seed + 9)
        syllables = np.zeros(n)
        at = 0
        while at < n:
            dur = int(r.uniform(0.09, 0.22) * RATE)
            syllables[at:at + dur] = r.uniform(0.3, 1.0) * np.hanning(min(dur, n - at))
            at += dur + int(r.uniform(0.02, 0.12) * RATE)
        return breath * syllables * envelope(n, 0.4, 99, length) * fade_out(n, 0.5) * 0.5, None
    if name == 'coin-chime':
        return clink(2.0, 1760, seed) * 0.9 + 0.4 * bell(2.0, 880, 0.5, seed), 0.0
    if name == 'silver-clink':
        return clink(0.8, 3100 + (seed % 7) * 60, seed) * 0.8, ((seed % 5) - 2) * 0.15
    if name == 'torch-ignite':
        n = int(1.4 * RATE)
        whoosh = band_noise(1.4, 150, 3000, seed) * envelope(n, 0.06, 0.35)
        return lowpass(whoosh, 2500) * 1.2, -0.1
    if name == 'chalk-scratch':
        n = int(length * RATE)
        scratch = band_noise(length, 2500, 9000, seed)
        steps = rng(seed + 3).random(int(length * 40) + 2) > 0.35
        jitter = 0.5 + 0.5 * np.repeat(steps, RATE // 40)[:n]
        return scratch * jitter * envelope(n, 0.02, 99, length) * fade_out(n, 0.05) * 0.45, 0.15
    if name == 'rope-coil':
        n = int(0.8 * RATE)
        return lowpass(band_noise(0.8, 100, 1500, seed), 900) * envelope(n, 0.01, 0.2) * 0.7, 0.0
    if name == 'rope-tension':
        n = int(length * RATE)
        t = t_axis(length)
        creak = np.sign(np.sin(2 * np.pi * (70 + 30 * np.sin(2 * np.pi * 1.7 * t)) * t)) * 0.2
        return lowpass(creak + 0.3 * band_noise(length, 200, 1200, seed), 1200) * envelope(n, 0.2, 99, length) * fade_out(n, 0.3), 0.2
    if name == 'pebbles':
        out = np.zeros(int(1.4 * RATE))
        r = rng(seed)
        for k in range(5):
            at = int((k * 0.09 + r.uniform(0, 0.05) + k * k * 0.03) * RATE)
            hit = clink(0.2, r.uniform(900, 1800), seed + k)[: len(out) - at] * (0.8 - k * 0.12)
            out[at:at + len(hit)] += hit
        return lowpass(out, 3000) * 0.7, -0.1
    if name == 'muffle':
        return None, 0.0  # applied to the bed, see below
    if name == 'muffled-bell':
        return lowpass(bell(4.0, 330, 1.2, seed), 500) * 0.5, 0.4
    if name == 'cloth':
        n = int(length * RATE)
        rustle = band_noise(length, 500, 3500, seed)
        sway = 0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 2.3 * t_axis(length)))
        return rustle * sway * envelope(n, 0.1, 99, length) * fade_out(n, 0.2) * 0.35, -0.2
    if name == 'decoy-bell':
        return bell(2.5, 740, 0.7, seed) * 0.7, 0.35
    if name == 'distant-bell':
        return lowpass(bell(5.0, 98, 2.0, seed), 800) * 0.5, 0.0
    if name == 'leather':
        n = int(length * RATE)
        t = t_axis(length)
        return lowpass(np.sin(2 * np.pi * 90 * t) * band_noise(length, 100, 800, seed), 600) * envelope(n, 0.2, 99, length) * fade_out(n, 0.3) * 0.6, -0.3
    if name == 'ambience-down':
        return None, 0.0
    raise ValueError(f'Unknown sound cue {cue}')


def fade_out(n, seconds):
    out = np.ones(n)
    k = min(n, int(seconds * RATE))
    out[n - k:] = np.linspace(1, 0, k)
    return out


def place(track, signal, start, pan, gain):
    """Adds a mono signal to a stereo track. pan=None sweeps from left to right over the sound."""
    at = int(start * RATE)
    if at >= N:
        return
    signal = signal[: N - at] * gain
    if pan is None:
        p = np.linspace(-0.8, 0.8, len(signal))
    else:
        p = np.full(len(signal), pan)
    left = np.cos((p + 1) * np.pi / 4)
    right = np.sin((p + 1) * np.pi / 4)
    track[0, at:at + len(signal)] += signal * left
    track[1, at:at + len(signal)] += signal * right


def music_bed(episode):
    """A low drone with a slow harmonic progression, quieter where the narration needs room."""
    t = np.arange(N) / RATE
    # D minor, with the chord moving at the act changes: mystery, danger, analysis, suspense.
    sections = [(0, 14, [73.42, 110.0, 174.61]), (14, 28, [69.30, 103.83, 164.81]), (28, 53, [77.78, 116.54, 185.0]), (53, 60, [73.42, 110.0, 155.56])]
    bed = np.zeros(N)
    for s, e, chord in sections:
        mask = np.clip(np.minimum((t - s) / 1.5, (e - t) / 1.5 + 1), 0, 1) * (t >= s - 1.5) * (t < e + 1.5)
        for k, f in enumerate(chord):
            lfo = 1 + 0.003 * np.sin(2 * np.pi * (0.07 + 0.02 * k) * t)
            bed += mask * (0.5 / (k + 1)) * np.sin(2 * np.pi * f * lfo * t)
    air = lowpass(band_noise(DURATION, 30, 400, 77), 260) * 0.25
    bed = (bed * 0.35 + air) * np.clip(t / 2.0, 0, 1)
    return bed


def main():
    with open(EPISODE, encoding='utf-8') as file:
        episode = json.load(file)
    t = np.arange(N) / RATE
    effects = np.zeros((2, N))
    bed = music_bed(episode)
    bed_gain = np.ones(N)
    high_cut = np.ones(N)
    seed = 1000
    for shot in episode['shots']:
        for cue in shot['sounds']:
            seed += 17
            start = cue['start']
            end = cue.get('end')
            if cue['cue'] == 'muffle':
                window = (t >= start) & (t < end)
                high_cut[window] = 0.15
                continue
            if cue['cue'] == 'ambience-down':
                fall = np.clip((t - start) / 2.0, 0, 1) * (t >= start)
                bed_gain *= 1 - 0.55 * fall
                continue
            for k in range(cue.get('count', 1)):
                signal, pan = cue_signal(cue['cue'], start, end, seed + k)
                place(effects, signal, start + k * cue.get('interval', 0), pan, cue['gain'])

    # The muffle: earplugs block the high frequencies of everything but the narration.
    smooth = np.convolve(high_cut, np.ones(2400) / 2400, mode='same')
    bed_low = lowpass(bed, 400)
    bed = bed_low + (bed - bed_low) * smooth
    mix = np.vstack([bed, bed]) * bed_gain * 0.6
    for channel in range(2):
        low = lowpass(effects[channel], 500)
        mix[channel] += low + (effects[channel] - low) * smooth

    # A short room reverb on everything except the narration.
    ir_n = int(1.6 * RATE)
    ir = rng(5).standard_normal(ir_n) * np.exp(-np.arange(ir_n) / RATE / 0.45)
    ir /= np.sqrt(np.sum(ir ** 2))
    for channel in range(2):
        wet = np.fft.irfft(np.fft.rfft(mix[channel], N + ir_n) * np.fft.rfft(ir, N + ir_n))[:N]
        mix[channel] = mix[channel] * 0.8 + wet * 0.25

    voice_dir = os.path.join(OUT, 'narration')
    narration = 0
    for shot in episode['shots']:
        path = os.path.join(voice_dir, f"{shot['id']}.wav")
        if not os.path.exists(path):
            continue
        with wave.open(path) as w:
            if w.getframerate() != RATE:
                sys.exit(f'{path} must be {RATE} Hz')
            data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
            if w.getnchannels() == 2:
                data = data.reshape(-1, 2).mean(axis=1)
        start = shot['narration']['start']
        at = int(start * RATE)
        data = data[: N - at]
        # Duck the bed under the voice.
        duck = np.ones(N)
        duck[at:at + len(data)] = 0.45
        duck = np.convolve(duck, np.ones(4800) / 4800, mode='same')
        mix *= duck
        mix[:, at:at + len(data)] += data * 0.9
        narration += 1

    # Loudness for phones: bring the average up to about -18 dB RMS, then soft-limit the bells
    # so the peaks stay under -1 dBFS without audible clipping.
    rms = np.sqrt(np.mean(mix ** 2))
    mix = mix * (10 ** (-18 / 20) / rms)
    mix = np.tanh(mix * 1.6) / 1.6
    mix = mix / np.max(np.abs(mix)) * 0.89
    # The picture cuts to black at 60.00 s: the sound ends with it, with a 10 ms fade against clicks.
    mix[:, -480:] *= np.linspace(1, 0, 480)
    os.makedirs(OUT, exist_ok=True)
    pcm = (np.clip(mix.T, -1, 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, 'audio.wav'), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())
    print(f'Wrote {OUT}/audio.wav: {DURATION:.2f} s, {RATE} Hz stereo, narration lines mixed: {narration} of {len(episode["shots"])}')
    if narration == 0:
        print('No narration: run npm run narration:episode with GOOGLE_TTS_API_KEY set, then run this again.')


if __name__ == '__main__':
    main()
