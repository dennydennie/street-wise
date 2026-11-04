import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Device-local persistence: the access token in secure storage, everything else
/// (onboarding flags, alert settings, offline pins) in shared preferences.
/// Trips and GPS history never leave the phone (Privacy & data).
class LocalStore {
  LocalStore._(this._prefs);

  static const _secure = FlutterSecureStorage();
  static const _tokenKey = 'sw.accessToken';

  final SharedPreferences _prefs;

  static Future<LocalStore> open() async => LocalStore._(await SharedPreferences.getInstance());

  Future<String?> readToken() async {
    try {
      return await _secure.read(key: _tokenKey);
    } catch (_) {
      return _prefs.getString(_tokenKey); // secure storage unavailable (some web contexts)
    }
  }

  Future<void> writeToken(String? token) async {
    try {
      if (token == null) {
        await _secure.delete(key: _tokenKey);
      } else {
        await _secure.write(key: _tokenKey, value: token);
      }
    } catch (_) {
      if (token == null) {
        await _prefs.remove(_tokenKey);
      } else {
        await _prefs.setString(_tokenKey, token);
      }
    }
  }

  bool flag(String key, {bool fallback = false}) => _prefs.getBool('sw.$key') ?? fallback;
  Future<void> setFlag(String key, bool value) => _prefs.setBool('sw.$key', value);

  int number(String key, {int fallback = 0}) => _prefs.getInt('sw.$key') ?? fallback;
  Future<void> setNumber(String key, int value) => _prefs.setInt('sw.$key', value);

  String? text(String key) => _prefs.getString('sw.$key');
  Future<void> setText(String key, String? value) =>
      value == null ? _prefs.remove('sw.$key') : _prefs.setString('sw.$key', value);

  Object? json(String key) {
    final raw = _prefs.getString('sw.$key');
    if (raw == null) return null;
    try {
      return jsonDecode(raw);
    } catch (_) {
      return null;
    }
  }

  Future<void> setJson(String key, Object? value) =>
      value == null ? _prefs.remove('sw.$key') : _prefs.setString('sw.$key', jsonEncode(value));

  /// Wipes everything except the public camera cache (account deleted / signed out of all).
  Future<void> clearAccountData() async {
    await writeToken(null);
    for (final k in _prefs.getKeys().toList()) {
      if (k.startsWith('sw.') && k != 'sw.cameraCache' && k != 'sw.onboarded' && k != 'sw.tourSeen') {
        await _prefs.remove(k);
      }
    }
  }
}
