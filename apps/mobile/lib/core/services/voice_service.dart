import 'dart:async';

import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Voice in and out. Speech-to-text runs on the device (no audio leaves the phone);
/// text-to-speech speaks alerts through the car audio. Both degrade quietly:
/// if the platform lacks them, [canListen]/[canSpeak] are false and the UI falls back to taps.
class VoiceService {
  final _stt = SpeechToText();
  final _tts = FlutterTts();
  bool _sttReady = false;
  bool _ttsReady = false;
  bool canListen = false;
  bool canSpeak = false;

  /// en | sn | nd — maps to platform locales where available.
  String language = 'en';

  static const _locales = {'en': 'en_ZW', 'sn': 'sn_ZW', 'nd': 'nd_ZW'};
  static const _ttsLangs = {'en': 'en-GB', 'sn': 'en-GB', 'nd': 'en-GB'}; // Shona/Ndebele voices are rare; speak English text.

  Future<void> init() async {
    try {
      canListen = _sttReady = await _stt.initialize(onError: (_) {}, onStatus: (_) {});
    } catch (_) {
      canListen = false;
    }
    try {
      await _tts.setSpeechRate(0.5);
      await _tts.awaitSpeakCompletion(true);
      _ttsReady = canSpeak = true;
    } catch (_) {
      canSpeak = false;
    }
  }

  Future<String?> _bestLocale() async {
    try {
      final want = _locales[language] ?? 'en_ZW';
      final locales = await _stt.locales();
      final ids = locales.map((l) => l.localeId).toList();
      if (ids.contains(want)) return want;
      final prefix = want.split('_').first;
      final same = ids.where((id) => id.startsWith(prefix)).toList();
      if (same.isNotEmpty) return same.first;
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Listens once (up to [maxDuration]); emits partial transcripts, completes with the final text.
  Future<String> listen({void Function(String partial)? onPartial, Duration maxDuration = const Duration(seconds: 8)}) async {
    if (!_sttReady) return '';
    final done = Completer<String>();
    var latest = '';
    await stop();
    try {
      await _stt.listen(
        listenOptions: SpeechListenOptions(
          localeId: await _bestLocale(),
          listenFor: maxDuration,
          pauseFor: const Duration(seconds: 2),
          partialResults: true,
          cancelOnError: true,
          listenMode: ListenMode.dictation,
        ),
        onResult: (SpeechRecognitionResult r) {
          latest = r.recognizedWords;
          onPartial?.call(latest);
          if (r.finalResult && !done.isCompleted) done.complete(latest);
        },
      );
    } catch (_) {
      return '';
    }
    return done.future.timeout(maxDuration + const Duration(seconds: 2), onTimeout: () {
      _stt.stop();
      return latest;
    });
  }

  Future<void> stop() async {
    try {
      if (_stt.isListening) await _stt.stop();
    } catch (_) {}
  }

  bool get isListening => _sttReady && _stt.isListening;

  /// Speaks [text] (max ~6 s of speech per the design); interrupts anything already speaking.
  Future<void> say(String text) async {
    if (!_ttsReady || text.trim().isEmpty) return;
    try {
      await _tts.stop();
      await _tts.setLanguage(_ttsLangs[language] ?? 'en-GB');
      await _tts.speak(text);
    } catch (_) {}
  }

  Future<void> silence() async {
    try {
      await _tts.stop();
    } catch (_) {}
  }
}
