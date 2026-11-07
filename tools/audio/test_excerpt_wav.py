"""Artificial PCM unit fixtures only; no recording, licensing or listening acceptance."""
import ast
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import wave

MODULE = Path(__file__).with_name('excerpt_wav.py')
spec = importlib.util.spec_from_file_location('excerpt_wav', MODULE)
excerpt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(excerpt)


class Tests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.source = self.root / 'fixture.wav'
        self.output = self.root / 'excerpt.wav'

    def tearDown(self):
        self.directory.cleanup()

    def write(self, frames, width=2, channels=1, rate=1000):
        raw = b''.join(int(sample).to_bytes(width, 'little', signed=True)
                       for frame in frames for sample in
                       (frame if isinstance(frame, tuple) else (frame,)))
        with wave.open(str(self.source), 'wb') as writer:
            writer.setnchannels(channels)
            writer.setsampwidth(width)
            writer.setframerate(rate)
            writer.writeframes(raw)
        return raw

    def read(self):
        with wave.open(str(self.output), 'rb') as reader:
            width = reader.getsampwidth()
            raw = reader.readframes(reader.getnframes())
            samples = [int.from_bytes(raw[i:i + width], 'little', signed=True)
                       for i in range(0, len(raw), width)]
            return reader.getparams(), samples

    def test_exact_no_fade_subset_and_source_unchanged_with_both_hashes(self):
        self.write([100, -100, 300, -300, 500, -500])
        before = self.source.read_bytes()
        metadata = excerpt.excerpt_wav(self.source, self.output, '.001', '.005', 0)
        params, samples = self.read()
        self.assertEqual(samples, [-100, 300, -300, 500])
        self.assertEqual(params.nframes, 4)
        self.assertEqual(metadata['output']['frames'], 4)
        self.assertEqual(metadata['selection']['start']['frame'], 1)
        self.assertEqual(metadata['selection']['endExclusive']['frame'], 5)
        self.assertEqual(metadata['source']['sha256'], hashlib.sha256(before).hexdigest())
        self.assertEqual(metadata['output']['sha256'], hashlib.sha256(self.output.read_bytes()).hexdigest())
        self.assertEqual(self.source.read_bytes(), before)
        self.assertFalse(metadata['generatedAudio'])
        self.assertEqual(metadata['paddingFrames'], 0)

    def test_fade_only_attenuates_last_frames_of_each_channel(self):
        self.write([(800, -800), (700, -700), (600, -600), (501, -501), (300, -300)], channels=2)
        result = excerpt.excerpt_wav(self.source, self.output, 0, '.005', 3)
        params, samples = self.read()
        self.assertEqual(params.nchannels, 2)
        self.assertEqual(samples, [800, -800, 700, -700, 600, -600, 250, -250, 0, 0])
        self.assertEqual(result['fadeOut']['frames'], 3)
        self.assertEqual(result['fadeOut']['lastFrameGain'], 0)
        self.assertEqual(result['fadeOut']['duration']['secondsFraction'], '3/1000')

    def test_pcm_24_and_32_preserve_signed_extremes_and_attenuate_without_overflow(self):
        for width in (3, 4):
            with self.subTest(width=width):
                if self.output.exists():
                    self.output.unlink()
                low = -(1 << (width * 8 - 1))
                high = (1 << (width * 8 - 1)) - 1
                self.write([low, high, -101, 101], width=width)
                result = excerpt.excerpt_wav(self.source, self.output, 0, '.004', 2)
                params, samples = self.read()
                self.assertEqual(params.sampwidth, width)
                self.assertEqual(samples, [low, high, -101, 0])
                self.assertEqual(result['output']['bitsPerSample'], width * 8)

    def test_fractional_bounds_copy_only_whole_frames_inside_explicit_interval(self):
        self.write(list(range(10)), rate=10)
        result = excerpt.excerpt_wav(self.source, self.output, '.15', '.86', 0)
        params, samples = self.read()
        self.assertEqual(samples, list(range(2, 8)))
        self.assertEqual(params.nframes, 6)
        self.assertEqual(result['selection']['start']['secondsFraction'], '1/5')
        self.assertEqual(result['selection']['endExclusive']['secondsFraction'], '4/5')
        self.assertEqual(result['selection']['duration']['timecode'], '00:00:00.600000')

    def test_invalid_nonfinite_negative_and_out_of_source_bounds_refuse_without_output(self):
        self.write([1] * 10, rate=10)
        cases = [(0, float('nan'), 0), (float('inf'), 1, 0), (0, 1, 'Infinity'),
                 (True, 1, 0), (-.1, 1, 0), (0, -.1, 0), (0, 0, 0),
                 (.8, .7, 0), (0, '1.0000000001', 0), (0, 1, -1),
                 (0, 1, 1001), ('.001', '.002', 0), ('not-time', 1, 0)]
        before = self.source.read_bytes()
        for start, end, fade in cases:
            with self.subTest(start=start, end=end, fade=fade):
                with self.assertRaises(excerpt.ExcerptError):
                    excerpt.excerpt_wav(self.source, self.output, start, end, fade)
                self.assertFalse(self.output.exists())
                self.assertEqual(self.source.read_bytes(), before)

    def test_existing_output_and_input_aliases_are_never_overwritten(self):
        self.write([1, 2, 3])
        before = self.source.read_bytes()
        self.output.write_bytes(b'user content')
        with self.assertRaises(FileExistsError):
            excerpt.excerpt_wav(self.source, self.output, 0, '.003', 0)
        self.assertEqual(self.output.read_bytes(), b'user content')
        with self.assertRaises(excerpt.ExcerptError):
            excerpt.excerpt_wav(self.source, self.source, 0, '.003', 0)
        alias = self.root / 'alias.wav'
        alias.symlink_to(self.source)
        with self.assertRaises(excerpt.ExcerptError):
            excerpt.excerpt_wav(self.source, alias, 0, '.003', 0)
        self.assertEqual(self.source.read_bytes(), before)

    def test_atomic_target_creation_refuses_a_concurrent_output_and_removes_only_own_temp(self):
        self.write([1, 2, 3])
        def concurrent_target(_source, target):
            Path(target).write_bytes(b'concurrent user content')
            raise FileExistsError('already exists')
        with mock.patch.object(excerpt.os, 'link', concurrent_target):
            with self.assertRaises(FileExistsError):
                excerpt.excerpt_wav(self.source, self.output, 0, '.003', 0)
        self.assertEqual(self.output.read_bytes(), b'concurrent user content')
        self.assertEqual(sorted(p.name for p in self.root.iterdir()), ['excerpt.wav', 'fixture.wav'])

    def test_truncated_and_unaligned_source_refused(self):
        self.write([1, 2, 3])
        raw = self.source.read_bytes()
        self.source.write_bytes(raw[:-1])
        with self.assertRaises(excerpt.ExcerptError):
            excerpt.excerpt_wav(self.source, self.output, 0, '.003', 0)
        self.assertFalse(self.output.exists())
        self.write([1, 2, 3])
        raw = bytearray(self.source.read_bytes())
        data_offset = raw.index(b'data') + 4
        raw[data_offset:data_offset + 4] = (7).to_bytes(4, 'little')
        raw.extend(b'\x00')
        raw[4:8] = (len(raw) - 8).to_bytes(4, 'little')
        self.source.write_bytes(raw)
        with self.assertRaises(excerpt.ExcerptError):
            excerpt.excerpt_wav(self.source, self.output, 0, '.003', 0)
        self.assertFalse(self.output.exists())

    def test_unsupported_8_bit_pcm_refused(self):
        with wave.open(str(self.source), 'wb') as writer:
            writer.setparams((1, 1, 1000, 0, 'NONE', 'not compressed'))
            writer.writeframes(b'\x80' * 10)
        with self.assertRaises(excerpt.ExcerptError):
            excerpt.excerpt_wav(self.source, self.output, 0, '.01', 0)
        self.assertFalse(self.output.exists())

    def test_mid_operation_source_change_refuses_to_commit(self):
        self.write([1, 2, 3])
        real = excerpt._sha256
        calls = 0
        def changed(path):
            nonlocal calls
            calls += 1
            if calls == 2:
                return '0' * 64
            return real(path)
        with mock.patch.object(excerpt, '_sha256', changed):
            with self.assertRaises(excerpt.ExcerptError):
                excerpt.excerpt_wav(self.source, self.output, 0, '.003', 0)
        self.assertFalse(self.output.exists())
        self.assertEqual([p.name for p in self.root.iterdir()], ['fixture.wav'])

    def test_cli_returns_machine_readable_provenance_and_does_not_claim_rights_or_audition(self):
        self.write([1, 2, 3])
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            code = excerpt.main(['--input', str(self.source), '--output', str(self.output),
                                 '--start', '0', '--end', '.003', '--fade-ms', '1'])
        data = json.loads(stdout.getvalue())
        self.assertEqual(code, 0)
        self.assertEqual(data['output']['frames'], 3)
        self.assertIn('not assessed', data['rightsStatus'])
        self.assertIn('not performed', data['humanAudition'])
        self.assertIn('caller selection', data['semanticBoundary'])
        self.assertEqual(data['fadeOut']['frames'], 1)

    def test_tool_imports_no_network_or_subprocess_modules_and_requires_explicit_cli_bounds(self):
        tree = ast.parse(MODULE.read_text())
        modules = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                modules.update(name.name.split('.')[0] for name in node.names)
            elif isinstance(node, ast.ImportFrom):
                modules.add((node.module or '').split('.')[0])
        self.assertFalse(modules & {'subprocess', 'socket', 'urllib', 'requests', 'http'})
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as result:
                excerpt.main(['--input', str(self.source), '--output', str(self.output)])
        self.assertEqual(result.exception.code, 2)
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
