#!/usr/bin/env python3
"""Excerpt an explicitly chosen interval of a local integer-PCM WAV.

Input must already be decoded to PCM16/24/32 WAV. This tool never invokes a
converter, network or subprocess. It does not choose a musical/linguistic cut:
callers must choose a complete attack/decay or a complete chanting phrase.
Only source frames wholly inside the requested interval are copied (ceil start,
floor end). An explicitly requested linear fade-out only attenuates those frames;
no samples are generated, padded, stretched or pitch shifted. Original source and
its rights/provenance records must be retained. Editing does not clear rights.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import tempfile
import wave
from decimal import Decimal, InvalidOperation
from fractions import Fraction


class ExcerptError(ValueError):
    pass


def _number(value, name):
    if isinstance(value, bool):
        raise ExcerptError(name + ' must be a finite number')
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ExcerptError(name + ' must be a finite number')
    if not result.is_finite():
        raise ExcerptError(name + ' must be a finite number')
    return result


def _sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def _time(frames, sample_rate):
    microseconds = frames * 1_000_000 // sample_rate
    seconds, fraction = divmod(microseconds, 1_000_000)
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)
    exact = Fraction(frames, sample_rate)
    return {'frame': frames,
            'secondsFraction': str(exact.numerator) + '/' + str(exact.denominator),
            'timecode': '%02d:%02d:%02d.%06d' % (hours, minutes, seconds, fraction)}


def excerpt_wav(input_path, output_path, start, end, fade_ms):
    """Create a new WAV and return provenance/selection/fade metadata.

    Refuses existing output, aliases of the input, truncated input and invalid
    bounds. PCM range is preserved; 24/32-bit samples are signed little endian.
    Returned metadata is not an assertion of licensing or human acceptance.
    """
    source = Path(input_path).resolve(strict=True)
    output = Path(output_path).absolute()
    if not source.is_file():
        raise ExcerptError('input must be a local file')
    if source == output.resolve(strict=False):
        raise ExcerptError('input and output must differ')
    if os.path.lexists(output):
        raise FileExistsError('output already exists; refusing to overwrite')
    if not output.parent.is_dir():
        raise ExcerptError('output parent directory must exist')
    begin = _number(start, 'start')
    finish = _number(end, 'end')
    fade = _number(fade_ms, 'fade_ms')
    if begin < 0 or finish <= begin or fade < 0:
        raise ExcerptError('require 0 <= start < end and fade_ms >= 0')
    source_sha = _sha256(source)
    temporary = None
    try:
        with wave.open(str(source), 'rb') as reader:
            channels = reader.getnchannels()
            width = reader.getsampwidth()
            rate = reader.getframerate()
            total = reader.getnframes()
            if reader.getcomptype() != 'NONE' or width not in (2, 3, 4):
                raise ExcerptError('only integer PCM16/24/32 WAV is supported')
            if not 1 <= channels <= 32 or rate <= 0 or total <= 0:
                raise ExcerptError('invalid PCM format or empty source')
            if Fraction(finish) > Fraction(total, rate):
                raise ExcerptError('end exceeds the source duration')
            start_frame = math.ceil(Fraction(begin) * rate)
            end_frame = math.floor(Fraction(finish) * rate)
            count = end_frame - start_frame
            if count < 1:
                raise ExcerptError('requested interval contains no whole source frame')
            fade_frames = math.ceil(Fraction(fade) * rate / 1000)
            if fade_frames > count:
                raise ExcerptError('fade exceeds the selected frame duration')
            frame_bytes = channels * width
            # Validate actual bytes, not just the RIFF-declared frame count.
            checked = 0
            while checked < total:
                wanted = min(65536, total - checked)
                block = reader.readframes(wanted)
                if len(block) != wanted * frame_bytes:
                    raise ExcerptError('truncated or unaligned PCM source')
                checked += wanted
            if reader.readframes(1):
                raise ExcerptError('unaligned PCM source tail')
            reader.setpos(start_frame)
            handle = tempfile.NamedTemporaryFile(prefix='.' + output.name + '.',
                                                 suffix='.tmp', dir=str(output.parent),
                                                 delete=False)
            temporary = Path(handle.name)
            handle.close()
            with wave.open(str(temporary), 'wb') as writer:
                writer.setnchannels(channels)
                writer.setsampwidth(width)
                writer.setframerate(rate)
                written = 0
                while written < count:
                    wanted = min(65536, count - written)
                    block = bytearray(reader.readframes(wanted))
                    if len(block) != wanted * frame_bytes:
                        raise ExcerptError('source changed or ended during excerpt')
                    if fade_frames:
                        for local_frame in range(wanted):
                            absolute = written + local_frame
                            if absolute < count - fade_frames:
                                continue
                            numerator = count - 1 - absolute
                            denominator = max(1, fade_frames - 1)
                            for channel in range(channels):
                                offset = (local_frame * channels + channel) * width
                                sample = int.from_bytes(block[offset:offset + width],
                                                        'little', signed=True)
                                amplitude = abs(sample) * numerator // denominator
                                scaled = -amplitude if sample < 0 else amplitude
                                block[offset:offset + width] = scaled.to_bytes(
                                    width, 'little', signed=True)
                    writer.writeframesraw(block)
                    written += wanted
            if _sha256(source) != source_sha:
                raise ExcerptError('source changed while processing; output not committed')
            output_sha = _sha256(temporary)
            # Atomic exclusive publication on the same local filesystem. Unlike
            # replace(), link() cannot overwrite a concurrently created target.
            os.link(temporary, output)
            return {
                'schemaVersion': 1,
                'operation': 'explicit PCM excerpt with optional linear fade-out',
                'source': {'name': source.name, 'sha256': source_sha,
                           'frames': total, 'sampleRate': rate,
                           'channels': channels, 'bitsPerSample': width * 8},
                'output': {'name': output.name, 'sha256': output_sha,
                           'frames': count, 'sampleRate': rate,
                           'channels': channels, 'bitsPerSample': width * 8},
                'requested': {'startSeconds': str(begin), 'endSeconds': str(finish),
                              'fadeMs': str(fade)},
                'selection': {'start': _time(start_frame, rate),
                              'endExclusive': _time(end_frame, rate),
                              'duration': _time(count, rate),
                              'framePolicy': 'ceil start; floor end; source subset only'},
                'fadeOut': {'frames': fade_frames,
                            'duration': _time(fade_frames, rate),
                            'curve': 'linear amplitude; integer rounding toward zero',
                            'lastFrameGain': 0 if fade_frames else None},
                'sourceUnchanged': True,
                'paddingFrames': 0,
                'generatedAudio': False,
                'semanticBoundary': 'explicit caller selection; no automatic phrase cut',
                'humanAudition': 'not performed by this tool',
                'rightsStatus': 'not assessed or cleared by editing; retain source rights records',
                'containerMetadata': 'PCM format preserved; ancillary RIFF tags not copied; retain original'
            }
    finally:
        if temporary is not None:
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, help='local decoded PCM WAV')
    parser.add_argument('--output', required=True, help='new WAV path; never overwritten')
    parser.add_argument('--start', required=True, help='explicit start in seconds')
    parser.add_argument('--end', required=True, help='explicit end in seconds')
    parser.add_argument('--fade-ms', required=True, help='explicit fade-out duration; use 0 for none')
    args = parser.parse_args(argv)
    try:
        metadata = excerpt_wav(args.input, args.output, args.start, args.end, args.fade_ms)
    except (ExcerptError, OSError, wave.Error) as error:
        parser.exit(2, 'excerpt refused: ' + str(error) + '\n')
    print(json.dumps(metadata, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
