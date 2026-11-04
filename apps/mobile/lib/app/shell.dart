import 'package:flutter/material.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/account/presentation/account_screen.dart';
import 'package:streetwise_zw/features/activity/presentation/activity_screen.dart';
import 'package:streetwise_zw/features/drive/presentation/drive_screens.dart';
import 'package:streetwise_zw/features/home/presentation/home_screen.dart';
import 'package:streetwise_zw/features/map/presentation/map_screen.dart';
import 'package:streetwise_zw/features/tour/tour_overlay.dart';

/// Tabbed shell: Drive · Map · Activity · Account, plus the on-demand tour overlay.
class Shell extends StatefulWidget {
  const Shell({super.key, this.initialTab = 0});
  final int initialTab;

  static ShellState? of(BuildContext context) => context.findAncestorStateOfType<ShellState>() ?? ShellState.current;

  @override
  State<Shell> createState() => ShellState();
}

class ShellState extends State<Shell> {
  late int tab = widget.initialTab;
  int? tourStep;

  final startKey = GlobalKey();
  final helpKey = GlobalKey();
  final mapNavKey = GlobalKey();
  final reportKey = GlobalKey();

  /// The live shell, so pages pushed above it can switch tabs.
  static ShellState? current;

  @override
  void dispose() {
    if (current == this) current = null;
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    current = this;
    // Runs once after onboarding; afterwards only from ? or Help › Take the tour.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!App.read(context).tourSeen) startTour();
    });
  }

  void setTab(int i) => setState(() => tab = i);

  void startTour() {
    Navigator.of(context).popUntil((r) => r.isFirst);
    setState(() {
      tab = 0;
      tourStep = 0;
    });
  }

  void _endTour() {
    App.read(context).markTourSeen();
    setState(() => tourStep = null);
  }

  @override
  Widget build(BuildContext context) {
    final steps = [
      TourStep(startKey, 'Start driving', 'Tap once before you set off. Alerts play through your car audio.'),
      TourStep(reportKey, 'Report hands-free', 'Tap and say "Report pothole". Typing is off while you drive.'),
      TourStep(mapNavKey, 'Plan your route', 'Check cameras and road reports before you leave.'),
      TourStep(helpKey, 'Replay anytime', 'Tap ? to run this tour again.'),
    ];

    return PopScope(
      canPop: tourStep == null && tab == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (tourStep != null) {
          _endTour();
        } else {
          setTab(0);
        }
      },
      child: Stack(children: [
        Scaffold(
          body: SafeArea(
            bottom: false,
            child: IndexedStack(index: tab, children: [
              HomeScreen(startKey: startKey, helpKey: helpKey),
              const MapScreen(),
              const ActivityScreen(),
              const AccountScreen(),
            ]),
          ),
          bottomNavigationBar: BottomNav(index: tab, onTap: setTab, mapKey: mapNavKey),
        ),
        // Step 2 is shown on a drive-mode preview, never during a real trip.
        if (tourStep == 1)
          Positioned.fill(
            child: Material(
              color: C.dBg,
              child: SafeArea(child: DriveModeView.preview(reportKey: reportKey)),
            ),
          ),
        if (tourStep != null)
          TourOverlay(
            key: ValueKey(tourStep),
            step: steps[tourStep!],
            index: tourStep!,
            count: steps.length,
            onBack: tourStep! > 0 ? () => setState(() => tourStep = tourStep! - 1) : null,
            onNext: tourStep! < steps.length - 1 ? () => setState(() => tourStep = tourStep! + 1) : _endTour,
            onClose: _endTour,
          ),
      ]),
    );
  }
}

/// Bottom nav for pages pushed above the shell (Account sub-pages): pops back and switches tab.
class PushedNav extends StatelessWidget {
  const PushedNav({super.key, this.index = 3});
  final int index;
  @override
  Widget build(BuildContext context) => BottomNav(
        index: index,
        onTap: (i) {
          Navigator.of(context).popUntil((r) => r.isFirst);
          ShellState.current?.setTab(i);
        },
      );
}

class BottomNav extends StatelessWidget {
  const BottomNav({super.key, required this.index, required this.onTap, this.mapKey});
  final int index;
  final ValueChanged<int> onTap;
  final Key? mapKey;

  static const items = [
    (I.navigation, 'Drive'),
    (I.map, 'Map'),
    (I.list, 'Activity'),
    (I.user, 'Account'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: C.bg, border: Border(top: BorderSide(color: C.divider))),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 62,
          child: Row(children: [
            for (var i = 0; i < items.length; i++)
              Expanded(
                child: Semantics(
                  selected: i == index,
                  button: true,
                  label: items[i].$2,
                  child: InkWell(
                    onTap: () => onTap(i),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Container(
                        key: i == 1 ? mapKey : null,
                        width: 44,
                        height: 26,
                        color: i == index ? C.a200 : Colors.transparent,
                        child: Icon(items[i].$1, size: 18, color: i == index ? C.a800 : C.n800),
                      ),
                      const SizedBox(height: 4),
                      ExcludeSemantics(
                        child: Text(items[i].$2,
                            style: T.body(11.5,
                                color: i == index ? C.text : C.n700,
                                weight: i == index ? FontWeight.w700 : FontWeight.w400)),
                      ),
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
