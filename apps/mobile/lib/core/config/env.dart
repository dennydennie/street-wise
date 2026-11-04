import 'package:flutter/foundation.dart';

/// Build-time configuration, passed with `--dart-define` (see apps/mobile/README.md).
///
/// ```bash
/// flutter run -d chrome \
///   --dart-define=API_BASE_URL=http://localhost:4100 \
///   --dart-define=MAPBOX_PUBLIC_TOKEN=pk.xxx
/// ```
abstract final class Env {
  static const _apiBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Optional client-side override; normally the API's `/config/public` supplies the map tiles.
  static const mapboxPublicToken = String.fromEnvironment('MAPBOX_PUBLIC_TOKEN');
  static const mapboxStyle = String.fromEnvironment('MAPBOX_STYLE', defaultValue: 'mapbox/streets-v12');

  /// API origin. Defaults suit local development: the Android emulator reaches the
  /// host machine at 10.0.2.2; web and iOS simulator use localhost.
  static String get apiBaseUrl {
    if (_apiBaseUrl.isNotEmpty) return _apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:4100';
    return 'http://localhost:4100';
  }

  /// Harare CBD — used until we have a GPS fix.
  static const harareLat = -17.8292;
  static const harareLng = 31.0522;
}
