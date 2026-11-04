import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';

void startDriving(BuildContext context) {
  Navigator.of(context).popUntil((r) => r.isFirst);
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const DriveModeScreen()));
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

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(width: 7, height: 7, color: C.a400),
          const SizedBox(width: 8),
          Text('DRIVE MODE ON', style: T.kicker(color: C.dMuted)),
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
        Kicker('Next on this road', color: C.dMuted),
        for (final (label, dist) in next)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 13),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.dLine))),
            child: Row(children: [
              Expanded(child: Text(label, style: T.body(14, color: C.dText))),
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

// ───────────────────────────── Drive session (simulated trip) ─────────────────────────────

enum _Phase { cruising, cameraAlert, confirm }

/// Simulates a trip down Samora Machel Ave: cruising → camera alert on approach →
/// "Still there?" after passing a community report. Real build: foreground service + GPS.
class DriveModeScreen extends StatefulWidget {
  const DriveModeScreen({super.key});
  @override
  State<DriveModeScreen> createState() => _DriveModeScreenState();
}

class _DriveModeScreenState extends State<DriveModeScreen> {
  final _rng = math.Random(7);
  Timer? _clock;
  int t = 0; // seconds into trip
  int speed = 42;
  double camDist = 640; // m to Julius Nyerere camera
  double kombiDist = 1100;
  _Phase phase = _Phase.cruising;
  bool alerted = false;
  bool confirmed = false;
  int confirmLeft = 10;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  void _tick() {
    if (!mounted) return;
    setState(() {
      t++;
      speed = (speed + _rng.nextInt(5) - 2).clamp(34, 52);
      final metres = speed / 3.6 * 4; // compress time ×4 for the demo
      camDist = math.max(0, camDist - metres);
      kombiDist = math.max(0, kombiDist - metres);

      final timing = App.read(context).alertTiming; // early / standard / late
      final trigger = [500.0, 300.0, 150.0][timing];
      if (!alerted && camDist <= trigger) {
        alerted = true;
        phase = _Phase.cameraAlert;
      } else if (phase == _Phase.cameraAlert && camDist <= 0) {
        phase = _Phase.cruising;
      } else if (!confirmed && camDist <= 0 && t > 12 && phase == _Phase.cruising) {
        confirmed = true;
        phase = _Phase.confirm;
        confirmLeft = 10;
      } else if (phase == _Phase.confirm) {
        confirmLeft--;
        if (confirmLeft <= 0) phase = _Phase.cruising; // no answer → no vote
      }
    });
  }

  void _vote(bool stillThere) {
    setState(() => phase = _Phase.cruising);
    toast(context, stillThere ? 'Thanks — report kept live' : 'Thanks — marked as gone');
  }

  Future<void> _endTrip() async {
    _clock?.cancel();
    Navigator.of(context).pop();
    toast(context, 'Trip ended · 1 camera passed · trip saved on this phone');
  }

  @override
  Widget build(BuildContext context) {
    final next = <(String, String)>[
      if (camDist > 0) ('Camera · Julius Nyerere', _fmt(camDist)),
      if (kombiDist > 0) ('Kombis stop mid-road', _fmt(kombiDist)),
      if (camDist <= 0) ('Camera · Robert Mugabe × 4th', _fmt(1800 - (t * 40.0).clamp(0, 1700))),
    ];
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
                  speed: speed,
                  road: 'Samora Machel Ave, heading E',
                  next: next,
                  onReport: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReportScreen(speed: speed))),
                  onEnd: _endTrip,
                ),
              _Phase.cameraAlert => CameraAlertView(key: const ValueKey('alert'), distance: camDist),
              _Phase.confirm => ConfirmPromptView(
                  key: const ValueKey('confirm'),
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

  static String _fmt(double m) => m >= 1000 ? '${(m / 1000).toStringAsFixed(1)} km' : '${(m / 10).round() * 10} m';
}

// ───────────────────────────── 04 Camera alert ─────────────────────────────

class CameraAlertView extends StatelessWidget {
  const CameraAlertView({super.key, required this.distance});
  final double distance;

  @override
  Widget build(BuildContext context) {
    final d = ((distance / 10).round() * 10).clamp(0, 999);
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
          label: 'Camera robot ahead, $d metres, Samora Machel and Julius Nyerere',
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
              Text('SAMORA MACHEL × JULIUS NYERERE', style: T.heading(24, color: C.dText)),
            ]),
          ),
        ),
        const SizedBox(height: 18),
        Kicker('This camera checks', color: C.dMuted),
        Container(
          decoration: BoxDecoration(border: Border.all(color: C.dLine)),
          child: Column(children: [
            for (final row in const [
              ['Red light', 'Stop line'],
              ['Phone use', 'Seatbelt'],
            ])
              Row(children: [
                for (final c in row)
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.dLine), right: BorderSide(color: C.dLine))),
                      child: Text(c, style: T.body(13, color: C.dText)),
                    ),
                  ),
              ]),
          ]),
        ),
        const Spacer(),
        const Align(alignment: Alignment.centerLeft, child: Tag('Official briefing · high confidence', dark: true, outline: true)),
      ]),
    );
  }
}

// ───────────────────────────── 05 Still there? ─────────────────────────────

class ConfirmPromptView extends StatelessWidget {
  const ConfirmPromptView({super.key, required this.onYes, required this.onGone, this.secondsLeft = 10});
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
        Text('ROBOT NOT WORKING', style: T.display(40, color: C.dText)),
        const SizedBox(height: 6),
        Text('Seke × Cripps · 22 min ago', style: T.body(12.5, color: C.dMuted)),
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

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key, required this.speed});
  final int speed;
  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  int? selected;
  bool listening = true;
  String heard = '';
  Timer? _hear;
  final note = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Speech recognition stand-in: "Report pothole".
    _hear = Timer(const Duration(milliseconds: 1600), () {
      if (!mounted || selected != null) return;
      setState(() {
        heard = 'Report pothole';
        selected = 0;
        listening = false;
      });
    });
  }

  @override
  void dispose() {
    _hear?.cancel();
    note.dispose();
    super.dispose();
  }

  void _submit({bool pin = false}) {
    final app = App.read(context);
    final type = reportTypes[selected ?? 0];
    if (!app.signedIn || !app.agreedToRules) {
      // Anonymous listeners can still drop a pin; posting needs an account + rules.
      app.dropPin(type);
      Navigator.of(context).pop();
      toast(context, 'Pin saved on this phone. Sign in to post it.');
      return;
    }
    if (pin) {
      app.dropPin(type);
      toast(context, 'Pin dropped · finish it in Activity');
    } else {
      app.myReports.insert(0, MyReport(type, 'Samora Machel Ave', 'just now', ReportStatus.live));
      app.postedCount++;
      app.touch();
      toast(context, '$type reported · thanks');
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final typingAllowed = app.passengerMode || widget.speed <= 10;
    return Scaffold(
      backgroundColor: C.dBg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Text("WHAT'S HERE?", style: T.heading(26, color: C.dText)),
              const Spacer(),
              Tag(typingAllowed ? 'Passenger mode' : '${widget.speed} km/h · typing off', dark: true, outline: true),
            ]),
            const SizedBox(height: 14),
            Container(
              decoration: BoxDecoration(border: Border.all(color: C.dLine)),
              child: Column(children: [
                for (var r = 0; r < 3; r++)
                  Row(children: [
                    for (var col = 0; col < 2; col++)
                      Expanded(
                        child: Material(
                          color: selected == r * 2 + col ? C.a800 : Colors.transparent,
                          child: InkWell(
                            onTap: () => setState(() {
                              selected = r * 2 + col;
                              listening = false;
                              _hear?.cancel();
                            }),
                            child: Container(
                              height: 48,
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              alignment: Alignment.centerLeft,
                              decoration: const BoxDecoration(
                                  border: Border(bottom: BorderSide(color: C.dLine), right: BorderSide(color: C.dLine))),
                              child: Text(reportTypes[r * 2 + col],
                                  style: T.body(13.5,
                                      color: C.dText,
                                      weight: selected == r * 2 + col ? FontWeight.w700 : FontWeight.w400)),
                            ),
                          ),
                        ),
                      ),
                  ]),
              ]),
            ),
            if (typingAllowed) ...[
              const SizedBox(height: 12),
              TextField(
                controller: note,
                style: T.body(14, color: C.dText),
                decoration: InputDecoration(
                  hintText: 'Add a note (passenger)',
                  hintStyle: T.body(14, color: C.dMuted),
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
                    onTap: selected == null
                        ? () => setState(() => listening = !listening)
                        : () => _submit(),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(selected == null ? I.mic : I.check, color: C.a900, size: 30),
                      const SizedBox(height: 10),
                      Text(selected == null ? (listening ? 'Listening…' : 'Tap to speak') : 'Send report',
                          style: T.body(12, color: C.a900, weight: FontWeight.w500)),
                    ]),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: Text(heard.isEmpty ? (listening ? 'Say "Report pothole"…' : ' ') : 'Heard: "$heard"',
                  style: T.body(12.5, color: C.dMuted).copyWith(fontStyle: FontStyle.italic)),
            ),
            const Spacer(),
            Material(
              color: Colors.transparent,
              shape: const RoundedRectangleBorder(side: BorderSide(color: C.dLine)),
              child: InkWell(
                onTap: () => _submit(pin: true),
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
}
