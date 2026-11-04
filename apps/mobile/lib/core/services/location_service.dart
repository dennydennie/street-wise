import 'dart:async';
import 'dart:math' as math;

import 'package:geolocator/geolocator.dart';
import 'package:streetwise_zw/core/config/env.dart';

class Fix {
  const Fix(this.lat, this.lng, {this.speedKmh = 0, this.heading, this.real = true});
  final double lat;
  final double lng;
  final double speedKmh;
  final double? heading;

  /// False when we fell back to Harare CBD (no permission / no GPS).
  final bool real;

  static const harare = Fix(Env.harareLat, Env.harareLng, real: false);
}

/// GPS wrapper. Never throws: callers get a fallback fix and can tell from [Fix.real].
class LocationService {
  Fix last = Fix.harare;

  Future<bool> ensurePermission({bool request = true}) async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return false;
      var p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied && request) p = await Geolocator.requestPermission();
      return p == LocationPermission.always || p == LocationPermission.whileInUse;
    } catch (_) {
      return false;
    }
  }

  Future<Fix> current({bool request = false}) async {
    if (!await ensurePermission(request: request)) return last;
    try {
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 8)),
      );
      return last = _fix(p);
    } catch (_) {
      return last;
    }
  }

  /// Position stream for drive mode (high accuracy, 10 m filter).
  Stream<Fix> watch() async* {
    if (!await ensurePermission()) return;
    try {
      yield* Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.bestForNavigation, distanceFilter: 10),
      ).map((p) => last = _fix(p));
    } catch (_) {
      return;
    }
  }

  static Fix _fix(Position p) => Fix(
        p.latitude,
        p.longitude,
        speedKmh: p.speed.isFinite && p.speed > 0 ? p.speed * 3.6 : 0,
        heading: p.heading.isFinite && p.heading >= 0 ? p.heading : null,
      );
}

/// Great-circle distance in metres.
double distanceM(double lat1, double lng1, double lat2, double lng2) {
  const r = 6371000.0;
  double rad(double d) => d * math.pi / 180;
  final dLat = rad(lat2 - lat1);
  final dLng = rad(lng2 - lng1);
  final a = math.pow(math.sin(dLat / 2), 2) + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * r * math.asin(math.sqrt(a));
}

/// Initial bearing from point 1 to point 2, degrees 0–360.
double bearing(double lat1, double lng1, double lat2, double lng2) {
  double rad(double d) => d * math.pi / 180;
  final y = math.sin(rad(lng2 - lng1)) * math.cos(rad(lat2));
  final x = math.cos(rad(lat1)) * math.sin(rad(lat2)) - math.sin(rad(lat1)) * math.cos(rad(lat2)) * math.cos(rad(lng2 - lng1));
  return (math.atan2(y, x) * 180 / math.pi + 360) % 360;
}

/// True when [target] lies within ±[cone]° of the direction of travel.
bool isAhead(Fix from, double lat, double lng, {double cone = 70}) {
  final h = from.heading;
  if (h == null) return true;
  final b = bearing(from.lat, from.lng, lat, lng);
  final diff = ((b - h + 540) % 360) - 180;
  return diff.abs() <= cone;
}

String formatDistance(double m) => m >= 1000 ? '${(m / 1000).toStringAsFixed(1)} km' : '${(m / 10).round() * 10} m';
