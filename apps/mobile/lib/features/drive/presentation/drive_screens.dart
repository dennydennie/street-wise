import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:streetwise_zw/core/api/api_client.dart';
import 'package:streetwise_zw/core/services/location_service.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';

void startDriving(BuildContext context) {
  Navigator.of(context).popUntil((r) => r.isFirst);
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const DriveModeScreen()));
}

/// Something coming up on the road, for the "Next on this road" list.
class _Ahead {
  _Ahead(this.label, this.distance, {this.camera});
  final String label;
  final double distance;
  final Camera? camera;
}

// ───────────────────────────── 03 Drive mode view ─────────────────────────────

class DriveModeView extends StatelessWidget {
  const DriveModeView({
    super.key,
    required this.speed,
    required this.road,
    required this.next,
    this.reportKey,
    this.onReport,
    this.onEnd,
    this.banner,
    this.demo = false,
  });

  /// Static copy used by tour step 2.
  factory DriveModeView.preview({required GlobalKey reportKey}) => DriveModeView(
        reportKey: reportKey,
        speed: 42,
        road: 'Samora Machel Ave, heading E',
        next: const [('Camera · Julius Nyerere', '640 m'), ('Kombis stop mid-road', '1.1 km')],
      );

  final int speed;
  final String road;
  final List<(String, String)> next;
  final GlobalKey? reportKey;
  final VoidCallback? onReport;
  final VoidCallback? onEnd;

  /// Spoken area briefing currently showing (headline, advice).
  final (String, String)? banner;
  final bool demo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(width: 7, height: 7, color: C.a400),
          const SizedBox(width: 8),
          Text(demo ? 'DRIVE MODE · DEMO ROUTE' : 'DRIVE MODE ON', style: T.kicker(color: C.dMuted)),
          const Spacer(),
          Text('Bluetooth · Car audio', style: T.body(11, color: C.dMuted)),
        ]),
        const SizedBox(height: 22),
        Semantics(
          label: '$speed kilometres per hour',
          child: Text('$speed', style: T.heading(96, color: C.dText, height: 0.95)),
        ),
        Text('km/h · $road', style: T.body(12, color: C.dMuted)),
        const SizedBox(height: 18),
        const Hairline(dark: true),
        if (banner != null)
          Semantics(
            liveRegion: true,
            child: Container(
              margin: const EdgeInsets.only(top: 14),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: C.a800, border: Border.all(color: C.a400)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Icon(I.volume2, size: 14, color: C.a300),
                  const SizedBox(width: 6),
                  Text('AREA BRIEFING', style: T.kicker(color: C.a300)),
                ]),
                const SizedBox(height: 6),
                Text(banner!.$1.toUpperCase(), style: T.heading(22, color: C.dText)),
                if (banner!.$2.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(banner!.$2, style: T.body(13, color: C.dText)),
                ],
              ]),
            ),
          ),
        Kicker('Next on this road', color: C.dMuted),
        if (next.isEmpty) Text('Nothing reported ahead.', style: T.body(13, color: C.dMuted)),
        for (final (label, dist) in next)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 13),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.dLine))),
            child: Row(children: [
              Expanded(child: Text(label, style: T.body(14, color: C.dText), maxLines: 1, overflow: TextOverflow.ellipsis)),
              Text(dist, style: T.heading(20, color: C.dText)),
            ]),
          ),
        const Spacer(),
        SizedBox(
          height: 84,
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(
              flex: 7,
              child: Material(
                key: reportKey,
                color: Colors.transparent,
                shape: const RoundedRectangleBorder(side: BorderSide(color: C.dText)),
                child: InkWell(
                  onTap: onReport,
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(I.mic, color: C.dText, size: 22),
                    const SizedBox(height: 8),
                    Text('Report', style: T.body(13, color: C.dText, weight: FontWeight.w500)),
                  ]),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 3,
              child: Material(
                color: Colors.transparent,
                shape: const RoundedRectangleBorder(side: BorderSide(color: C.dLine)),
                child: InkWell(
                  onTap: onEnd,
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(I.square, color: C.dText, size: 16),
                    const SizedBox(height: 8),
                    Text('End trip', style: T.body(12, color: C.dText, weight: FontWeight.w500)),
                  ]),
                ),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

// ───────────────────────────── Drive session ─────────────────────────────

enum _Phase { cruising, cameraAlert, confirm }

/// A live trip. Uses the GPS stream; where there is none (Flutter web, emulator without
/// a route) it drives a demo route east along Samora Machel Ave so alerts can be exercised.
class DriveModeScreen extends StatefulWidget {
  const DriveModeScreen({super.key});
  @override
  State<DriveModeScreen> createState() => _DriveModeScreenState();
}

class _DriveModeScreenState extends State<DriveModeScreen> {
  late final AppState app = App.read(context);
  StreamSubscription<Fix>? _gps;
  Timer? _demoClock;
  Timer? _noFixTimer;
  Timer? _refresh;
  Timer? _bannerTimer;
  Timer? _confirmTimer;

  Fix fix = Fix.harare;
  bool demo = false;
  DateTime? _stoppedSince;

  _Phase phase = _Phase.cruising;
  DateTime? _alertShownAt;
  Camera? alertCamera;
  double alertDistance = 0;
  final Set<String> _alertedCameras = {};
  final Set<String> _announcedAreas = {};
  final Set<String> _promptedReports = {};
  final Map<String, double> _closest = {};
  (String, String)? banner;

  List<Report> liveReports = [];
  Report? confirming;
  int confirmLeft = 10;
  int camerasPassed = 0;

  @override
  void initState() {
    super.initState();
    fix = app.here;
    _gps = app.location?.watch().listen(_onFix);
    // No GPS at all within 6 s → demo route (web/desktop dev, or location denied).
    // A phone that has a real fix but is parked keeps waiting for real movement.
    _noFixTimer = Timer(const Duration(seconds: 6), () {
      if (!mounted || _hasMoved || (app.here.real && !kIsWeb)) return;
      _startDemo();
    });
    _loadAround();
    _refresh = Timer.periodic(const Duration(minutes: 2), (_) => _loadAround());
    app.voice?.say('Drive mode on.');
  }

  bool _hasMoved = false;

  @override
  void dispose() {
    _gps?.cancel();
    _demoClock?.cancel();
    _noFixTimer?.cancel();
    _refresh?.cancel();
    _bannerTimer?.cancel();
    _confirmTimer?.cancel();
    app.voice?.stop();
    app.voice?.silence();
    super.dispose();
  }

  Future<void> _loadAround() async {
    final f = fix;
    unawaited(app.refreshBriefing(lat: f.lat, lng: f.lng));
    try {
      const d = 0.03; // ≈3 km
      final r = await app.api.reportsInBox(f.lng - d, f.lat - d, f.lng + d, f.lat + d);
      if (mounted) setState(() => liveReports = r);
    } on ApiException catch (_) {}
  }

  void _startDemo() {
    if (demo) return;
    _gps?.cancel();
    demo = true;
    // Start ~700 m west of the Samora Machel × Julius Nyerere camera, heading east.
    final cam = app.cameras.where((c) => c.name.contains('Julius Nyerere')).firstOrNull;
    var lat = cam?.lat ?? -17.8292;
    var lng = (cam?.lng ?? 31.0522) - 0.0066;
    var speed = 42.0;
    final rng = math.Random(7);
    _demoClock = Timer.periodic(const Duration(seconds: 1), (_) {
      speed = (speed + rng.nextInt(5) - 2).clamp(34, 52).toDouble();
      final metres = speed / 3.6 * 4; // time compressed ×4 for the demo
      lng += metres / (111320 * math.cos(lat * math.pi / 180));
      _onFix(Fix(lat, lng, speedKmh: speed, heading: 90, real: false));
    });
  }

  void _onFix(Fix f) {
    if (!mounted) return;
    if (f.real && f.speedKmh > 3) _hasMoved = true;
    fix = f;
    app.here = f;

    // Trip ends after 5 min stationary.
    if (f.speedKmh < 3) {
      _stoppedSince ??= DateTime.now();
      if (DateTime.now().difference(_stoppedSince!) > const Duration(minutes: 5) && !demo) {
        _endTrip(auto: true);
        return;
      }
    } else {
      _stoppedSince = null;
    }

    _checkCameras(f);
    _checkAreas(f);
    _checkPassedReports(f);
    setState(() {});
  }

  void _checkCameras(Fix f) {
    if (phase == _Phase.confirm) return;
    final trigger = app.alertDistanceM;
    if (phase == _Phase.cameraAlert && alertCamera != null) {
      final d = distanceM(f.lat, f.lng, alertCamera!.lat, alertCamera!.lng);
      // Passed it, or the alert has had its ~6 s: back to the drive view (the camera
      // stays in "Next on this road"), so Report is always reachable.
      final shownFor = DateTime.now().difference(_alertShownAt ?? DateTime.now());
      if (d > alertDistance + 15 || d < 15 || shownFor > const Duration(seconds: 6)) {
        // Passed it.
        camerasPassed++;
        phase = _Phase.cruising;
        alertCamera = null;
        return;
      }
      alertDistance = d;
      if (app.chime50 && d <= 50 && !_alertedCameras.contains('${alertCamera!.id}:50')) {
        _alertedCameras.add('${alertCamera!.id}:50');
        app.voice?.say('Camera.');
      }
      return;
    }
    for (final c in app.cameras) {
      if (_alertedCameras.contains(c.id)) continue;
      final d = distanceM(f.lat, f.lng, c.lat, c.lng);
      if (d <= trigger && d > 20 && isAhead(f, c.lat, c.lng)) {
        _alertedCameras.add(c.id);
        phase = _Phase.cameraAlert;
        alertCamera = c;
        alertDistance = d;
        _alertShownAt = DateTime.now();
        final checks = c.checkLabels.take(2).join(' and ').toLowerCase();
        app.voice?.say('Camera robot ahead, ${(d / 50).round() * 50} metres. ${c.name.replaceAll('×', 'and')}.${checks.isEmpty ? '' : ' Checks $checks.'}');
        return;
      }
    }
  }

  /// Time-aware area briefings: the API marks `alert` only when what happens there is
  /// relevant for this time of day (e.g. night-time crime isn't announced at noon).
  void _checkAreas(Fix f) {
    if (phase != _Phase.cruising || app.quietHours && _isQuietNow) return;
    for (final a in app.briefing?.areas ?? const <AreaBriefing>[]) {
      if (!a.alert || _announcedAreas.contains(a.areaId)) continue;
      final lead = a.lead;
      if (lead != null && !app.speaks(lead.type)) continue;
      final d = distanceM(f.lat, f.lng, a.lat, a.lng);
      if (d <= 600 && isAhead(f, a.lat, a.lng, cone: 80)) {
        _announcedAreas.add(a.areaId);
        banner = (a.headline.isEmpty ? '${lead?.label ?? 'Report'} ahead' : a.headline, a.advice);
        app.voice?.say('${banner!.$1}. ${a.advice}');
        _bannerTimer?.cancel();
        _bannerTimer = Timer(const Duration(seconds: 12), () {
          if (mounted) setState(() => banner = null);
        });
        return;
      }
    }
  }

  bool get _isQuietNow {
    final h = DateTime.now().hour;
    return h >= 22 || h < 5;
  }

  /// 05 · After passing a live report, ask "Still there?" (signed-in drivers only).
  void _checkPassedReports(Fix f) {
    if (!app.signedIn || phase != _Phase.cruising) return;
    for (final r in liveReports) {
      if (r.isMine || _promptedReports.contains(r.id)) continue;
      final d = distanceM(f.lat, f.lng, r.lat, r.lng);
      final best = _closest[r.id];
      if (best == null || d < best) {
        _closest[r.id] = d;
        continue;
      }
      if (best < 80 && d > best + 120) {
        _promptedReports.add(r.id);
        _askStillThere(r);
        return;
      }
    }
  }

  Future<void> _askStillThere(Report r) async {
    setState(() {
      phase = _Phase.confirm;
      confirming = r;
      confirmLeft = 10;
    });
    _confirmTimer?.cancel();
    _confirmTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => confirmLeft--);
      if (confirmLeft <= 0) {
        t.cancel();
        _closeConfirm(); // no answer → no vote
      }
    });
    await app.voice?.say('You just passed ${r.type.label.toLowerCase()}. Still there? Say yes or no.');
    final heard = (await app.voice?.listen(maxDuration: const Duration(seconds: 6)) ?? '').toLowerCase();
    if (!mounted || phase != _Phase.confirm || confirming?.id != r.id) return;
    if (RegExp(r'\b(yes|yeah|yep|still|hongu|ehe)\b').hasMatch(heard)) {
      _vote(true);
    } else if (RegExp(r'\b(no|gone|nope|kwete|aiwa)\b').hasMatch(heard)) {
      _vote(false);
    }
  }

  void _vote(bool stillThere) {
    final r = confirming;
    _closeConfirm();
    if (r == null) return;
    app.vote(r, stillThere: stillThere);
    app.voice?.say('Thanks.');
    toast(context, stillThere ? 'Thanks — report kept live' : 'Thanks — marked as gone');
  }

  void _closeConfirm() {
    _confirmTimer?.cancel();
    app.voice?.stop();
    if (mounted) {
      setState(() {
        phase = _Phase.cruising;
        confirming = null;
      });
    }
  }

  Future<void> _endTrip({bool auto = false}) async {
    _gps?.cancel();
    _demoClock?.cancel();
    if (!mounted) return;
    Navigator.of(context).pop();
    toast(context, '${auto ? 'Stopped for 5 min · trip ended' : 'Trip ended'} · $camerasPassed camera${camerasPassed == 1 ? '' : 's'} passed · saved on this phone only');
  }

  List<(String, String)> get _next {
    final items = <_Ahead>[];
    for (final c in app.cameras) {
      final d = distanceM(fix.lat, fix.lng, c.lat, c.lng);
      if (d < 2500 && isAhead(fix, c.lat, c.lng)) items.add(_Ahead('Camera · ${c.name}', d, camera: c));
    }
    for (final a in app.briefing?.areas ?? const <AreaBriefing>[]) {
      if (!a.alert && a.liveCount == 0) continue;
      final d = distanceM(fix.lat, fix.lng, a.lat, a.lng);
      if (d < 2500 && isAhead(fix, a.lat, a.lng, cone: 80)) items.add(_Ahead(a.lead?.label ?? a.name, d));
    }
    items.sort((a, b) => a.distance.compareTo(b.distance));
    return items.take(3).map((e) => (e.label, formatDistance(e.distance))).toList();
  }

  String get _road {
    final dir = fix.heading == null ? '' : ', heading ${const ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][((fix.heading! + 22.5) % 360 ~/ 45)]}';
    return demo ? 'Samora Machel Ave$dir' : (fix.real ? 'GPS$dir' : 'Waiting for GPS…');
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _endTrip();
      },
      child: Scaffold(
        backgroundColor: C.dBg,
        body: SafeArea(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: switch (phase) {
              _Phase.cruising => DriveModeView(
                  key: const ValueKey('cruise'),
                  speed: fix.speedKmh.round(),
                  road: _road,
                  next: _next,
                  banner: banner,
                  demo: demo,
                  onReport: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReportScreen(at: fix))),
                  onEnd: _endTrip,
                ),
              _Phase.cameraAlert => CameraAlertView(key: const ValueKey('alert'), camera: alertCamera!, distance: alertDistance),
              _Phase.confirm => ConfirmPromptView(
                  key: const ValueKey('confirm'),
                  report: confirming!,
                  secondsLeft: confirmLeft,
                  onYes: () => _vote(true),
                  onGone: () => _vote(false),
                ),
            },
          ),
        ),
      ),
    );
  }
}

// ───────────────────────────── 04 Camera alert ─────────────────────────────

class CameraAlertView extends StatelessWidget {
  const CameraAlertView({super.key, required this.camera, required this.distance});
  final Camera camera;
  final double distance;

  @override
  Widget build(BuildContext context) {
    final d = ((distance / 10).round() * 10).clamp(0, 999);
    final checks = camera.checkLabels;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          const Icon(I.volume2, size: 15, color: C.dMuted),
          const SizedBox(width: 8),
          Text('SPEAKING · MUSIC DUCKED', style: T.kicker(color: C.dMuted)),
        ]),
        const SizedBox(height: 16),
        Semantics(
          liveRegion: true,
          label: 'Camera robot ahead, $d metres, ${camera.name}',
          child: Blueprint(
            borderColor: C.dLine,
            markColor: C.dMuted,
            padding: const EdgeInsets.fromLTRB(14, 18, 14, 18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(I.cctv, size: 17, color: C.dText),
                const SizedBox(width: 8),
                Text('CAMERA ROBOT AHEAD', style: T.kicker(color: C.dText)),
              ]),
              const SizedBox(height: 10),
              Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                Text('$d', style: T.heading(84, color: C.dText, height: 1)),
                const SizedBox(width: 6),
                Text('m', style: T.heading(28, color: C.a400)),
              ]),
              const SizedBox(height: 6),
              Text(camera.name.toUpperCase(), style: T.heading(24, color: C.dText)),
            ]),
          ),
        ),
        const SizedBox(height: 18),
        if (checks.isNotEmpty) ...[
          Kicker('This camera checks', color: C.dMuted),
          Container(
            decoration: BoxDecoration(border: Border.all(color: C.dLine)),
            child: Wrap(children: [
              for (final c in checks)
                FractionallySizedBox(
                  widthFactor: 0.5,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                    decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.dLine), right: BorderSide(color: C.dLine))),
                    child: Text(c, style: T.body(13, color: C.dText)),
                  ),
                ),
            ]),
          ),
        ],
        const Spacer(),
        Align(
          alignment: Alignment.centerLeft,
          child: Tag(
            '${camera.source == 'official' ? 'Official briefing' : 'Community'} · ${camera.confidence >= 0.8 ? 'high' : 'medium'} confidence',
            dark: true,
            outline: true,
          ),
        ),
      ]),
    );
  }
}

// ───────────────────────────── 05 Still there? ─────────────────────────────

class ConfirmPromptView extends StatelessWidget {
  const ConfirmPromptView({super.key, required this.report, required this.onYes, required this.onGone, this.secondsLeft = 10});
  final Report report;
  final VoidCallback onYes;
  final VoidCallback onGone;
  final int secondsLeft;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          const Icon(I.mic, size: 15, color: C.dMuted),
          const SizedBox(width: 8),
          Text('LISTENING FOR "YES" OR "NO"', style: T.kicker(color: C.dMuted)),
        ]),
        const SizedBox(height: 18),
        Text('YOU JUST PASSED', style: T.kicker(color: C.dMuted)),
        const SizedBox(height: 6),
        Text(report.type.label.toUpperCase(), style: T.display(40, color: C.dText)),
        const SizedBox(height: 6),
        Text('${report.place} · ${ago(report.capturedAt ?? report.createdAt)}', style: T.body(12.5, color: C.dMuted)),
        const SizedBox(height: 16),
        const _VoiceBars(),
        const Spacer(),
        Center(child: Text('STILL THERE?', style: T.heading(22, color: C.dText))),
        const SizedBox(height: 14),
        SizedBox(
          height: 96,
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(
              child: Material(
                color: C.accent,
                child: InkWell(
                  onTap: onYes,
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(I.check, color: C.n100, size: 22),
                    const SizedBox(height: 8),
                    Text('Yes', style: T.body(14, color: C.n100, weight: FontWeight.w500)),
                  ]),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Material(
                color: Colors.transparent,
                shape: const RoundedRectangleBorder(side: BorderSide(color: C.dMuted)),
                child: InkWell(
                  onTap: onGone,
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(I.x, color: C.dText, size: 22),
                    const SizedBox(height: 8),
                    Text('Gone', style: T.body(14, color: C.dText, weight: FontWeight.w500)),
                  ]),
                ),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 8),
        Center(child: Text('Closes in ${secondsLeft}s', style: T.body(11, color: C.dMuted))),
      ]),
    );
  }
}

class _VoiceBars extends StatefulWidget {
  const _VoiceBars();
  @override
  State<_VoiceBars> createState() => _VoiceBarsState();
}

class _VoiceBarsState extends State<_VoiceBars> with SingleTickerProviderStateMixin {
  late final c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);

  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    const base = <double>[10, 18, 26, 14, 22, 12, 8];
    return ExcludeSemantics(
      child: AnimatedBuilder(
        animation: c,
        builder: (_, _) => Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          for (var i = 0; i < base.length; i++) ...[
            Container(
              width: 4,
              height: reduce ? base[i] : base[i] * (0.5 + 0.5 * ((c.value + i * 0.17) % 1)),
              color: C.a400,
            ),
            const SizedBox(width: 4),
          ],
        ]),
      ),
    );
  }
}

// ───────────────────────────── 06 Report · hands-free ─────────────────────────────

/// Offline/anonymous fallback for the server analyser: a few keywords, EN + Shona.
@visibleForTesting
ReportType? guessType(String text) {
  final t = text.toLowerCase();
  const rules = <ReportType, List<String>>{
    ReportType.crimeHotspot: ['smash', 'grab', 'robbery', 'robbed', 'mugg', 'thie', 'mbavha', 'snatch', 'hijack', 'crime'],
    ReportType.robotOut: ['robot', 'traffic light', 'lights off', 'marobhoti'],
    ReportType.flooding: ['flood', 'water', 'mvura'],
    ReportType.kombiStop: ['kombi', 'mushikashika', 'zupco', 'bus'],
    ReportType.pothole: ['pothole', 'pot hole', 'gomba', 'mgodi', 'hole'],
    ReportType.camera: ['camera', 'speed trap', 'roadblock'],
  };
  for (final e in rules.entries) {
    if (e.value.any(t.contains)) return e.key;
  }
  return null;
}

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key, required this.at});

  /// Location and heading captured on press.
  final Fix at;
  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  late final AppState app = App.read(context);
  ReportType? selected;
  bool listening = false;
  bool analysing = false;
  bool sending = false;
  String transcript = '';
  String? heardSummary;
  final note = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _listen());
  }

  @override
  void dispose() {
    app.voice?.stop();
    note.dispose();
    super.dispose();
  }

  Future<void> _listen() async {
    final v = app.voice;
    if (v == null || !v.canListen) return;
    setState(() {
      listening = true;
      transcript = '';
    });
    final text = await v.listen(onPartial: (p) {
      if (mounted) setState(() => transcript = p);
    });
    if (!mounted) return;
    setState(() {
      listening = false;
      transcript = text;
    });
    if (text.trim().isNotEmpty) await _analyse(text);
  }

  Future<void> _analyse(String text) async {
    setState(() => analysing = true);
    final a = await app.analyze(text);
    if (!mounted) return;
    setState(() {
      analysing = false;
      selected ??= a?.type ?? guessType(text);
      heardSummary = a?.summary;
    });
  }

  Future<void> _submit({bool pin = false}) async {
    setState(() => sending = true);
    try {
      final reached = await app.submitReport(
        type: selected,
        at: widget.at,
        transcript: transcript.trim().isEmpty ? null : transcript.trim(),
        note: note.text.trim().isEmpty ? null : note.text.trim(),
        draft: pin,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      if (!reached) {
        toast(context, app.signedIn ? 'Saved on this phone · will send when back online' : 'Pin saved on this phone. Sign in to post it.');
      } else {
        app.voice?.say(pin ? 'Pin dropped.' : 'Reported. Thanks.');
        toast(context, pin ? 'Pin dropped · finish it in Activity' : '${selected?.label ?? 'Report'} sent · thanks');
      }
    } on ApiException catch (e) {
      if (mounted) toast(context, e.friendly);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appNow = App.of(context);
    final speed = widget.at.speedKmh.round();
    final typingAllowed = appNow.passengerMode || speed <= 10;
    final canListen = appNow.voice?.canListen ?? false;
    final ready = selected != null || transcript.trim().isNotEmpty;
    final status = listening
        ? (transcript.isEmpty ? 'Listening… say "Report pothole"' : 'Heard: "$transcript"')
        : analysing
            ? 'Understanding "$transcript"…'
            : transcript.isNotEmpty
                ? 'Heard: "$transcript"${heardSummary != null && heardSummary!.isNotEmpty ? '\n→ $heardSummary' : ''}'
                : (canListen ? 'Tap the mic and speak, or pick a hazard.' : 'Pick a hazard.');

    return Scaffold(
      backgroundColor: C.dBg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(I.arrowLeft, color: C.dText, size: 20),
                tooltip: 'Back to drive mode',
              ),
              Text("WHAT'S HERE?", style: T.heading(26, color: C.dText)),
              const Spacer(),
              Tag(typingAllowed ? (appNow.passengerMode ? 'Passenger mode' : 'Stopped') : '$speed km/h · typing off', dark: true, outline: true),
            ]),
            const SizedBox(height: 14),
            Container(
              decoration: BoxDecoration(border: Border.all(color: C.dLine)),
              child: Column(children: [
                for (var r = 0; r < 3; r++)
                  Row(children: [
                    for (var col = 0; col < 2; col++)
                      Expanded(child: _typeCell(ReportType.values[r * 2 + col])),
                  ]),
              ]),
            ),
            if (typingAllowed) ...[
              const SizedBox(height: 12),
              TextField(
                controller: note,
                maxLength: 140,
                style: T.body(14, color: C.dText),
                decoration: InputDecoration(
                  counterStyle: T.body(10, color: C.dMuted),
                  hintText: 'Add a note — places, never people or plates',
                  hintStyle: T.body(13, color: C.dMuted),
                  enabledBorder: const OutlineInputBorder(borderRadius: BorderRadius.zero, borderSide: BorderSide(color: C.dLine)),
                  focusedBorder: const OutlineInputBorder(borderRadius: BorderRadius.zero, borderSide: BorderSide(color: C.a400)),
                ),
              ),
            ],
            const Spacer(),
            Center(
              child: SizedBox(
                width: 112,
                height: 112,
                child: Material(
                  color: listening ? C.a500 : C.accent,
                  child: InkWell(
                    onTap: sending
                        ? null
                        : ready && !listening
                            ? () => _submit()
                            : canListen
                                ? (listening ? () => app.voice?.stop() : _listen)
                                : null,
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(ready && !listening ? I.check : I.mic, color: C.a900, size: 30),
                      const SizedBox(height: 10),
                      Text(
                        sending ? 'Sending…' : (ready && !listening ? 'Send report' : (listening ? 'Listening…' : 'Tap to speak')),
                        style: T.body(12, color: C.a900, weight: FontWeight.w500),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Semantics(
              liveRegion: true,
              child: Text(status, textAlign: TextAlign.center, style: T.body(12.5, color: C.dMuted).copyWith(fontStyle: FontStyle.italic)),
            ),
            const Spacer(),
            Material(
              color: Colors.transparent,
              shape: const RoundedRectangleBorder(side: BorderSide(color: C.dLine)),
              child: InkWell(
                onTap: sending ? null : () => _submit(pin: true),
                child: SizedBox(
                  height: 46,
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(I.mapPin, size: 15, color: C.dText),
                    const SizedBox(width: 8),
                    Text('Drop a quick pin · finish later', style: T.body(13, color: C.dText, weight: FontWeight.w500)),
                  ]),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _typeCell(ReportType t) => Material(
        color: selected == t ? C.a800 : Colors.transparent,
        child: InkWell(
          onTap: () => setState(() {
            selected = t;
            app.voice?.stop();
            listening = false;
          }),
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            alignment: Alignment.centerLeft,
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.dLine), right: BorderSide(color: C.dLine))),
            child: Text(t.label, style: T.body(13.5, color: C.dText, weight: selected == t ? FontWeight.w700 : FontWeight.w400)),
          ),
        ),
      );
}
