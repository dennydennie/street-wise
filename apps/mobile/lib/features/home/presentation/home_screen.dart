import 'package:flutter/material.dart';
import 'package:streetwise_zw/app/shell.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/brand.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/drive/presentation/drive_screens.dart';
import 'package:streetwise_zw/features/map/presentation/area_screen.dart';

/// 02 Home · ready to drive. Anonymous listening works without an account.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.startKey, required this.helpKey});
  final GlobalKey startKey;
  final GlobalKey helpKey;

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final b = app.briefing;
    final areas = b?.areas ?? const <AreaBriefing>[];
    final liveReports = areas.fold<int>(0, (s, a) => s + a.liveCount);
    final robotsOut = areas.fold<int>(
        0, (s, a) => s + a.items.where((i) => i.type == ReportType.robotOut).fold(0, (t, i) => t + i.liveCount));
    final fresh = [...areas.where((a) => a.alert), ...areas.where((a) => !a.alert && a.liveCount > 0)].take(3).toList();
    final synced = app.offline
        ? 'Offline'
        : app.camerasSyncedAt == null
            ? 'Syncing…'
            : 'Synced ${hm(app.camerasSyncedAt!)}';

    return Column(children: [
      Container(
        height: 56,
        padding: const EdgeInsets.only(left: 20, right: 12),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
        child: Row(children: [
          const Wordmark(),
          const Spacer(),
          Tag(synced, neutral: app.offline),
          const SizedBox(width: 10),
          Tooltip(
            message: 'Take the tour',
            child: InkWell(
              key: helpKey,
              onTap: () => Shell.of(context)?.startTour(),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(border: Border.all(color: C.divider)),
                child: const Icon(I.circleHelp, size: 17),
              ),
            ),
          ),
        ]),
      ),
      Expanded(
        child: RefreshIndicator(
          color: C.accent,
          onRefresh: () async {
            await app.locate();
            await Future.wait([app.refreshPublic(), app.refreshBriefing()]);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Container(
                decoration: BoxDecoration(border: Border.all(color: C.divider)),
                child: IntrinsicHeight(
                  child: Row(children: [
                    _Stat('${app.cameras.length}', 'Camera robots', onTap: () => Shell.of(context)?.setTab(1)),
                    const VerticalDivider(width: 1, color: C.divider),
                    _Stat('$liveReports', 'Reports near you', onTap: () => Shell.of(context)?.setTab(1)),
                    const VerticalDivider(width: 1, color: C.divider),
                    _Stat('$robotsOut', 'Robots out', onTap: () => Shell.of(context)?.setTab(1)),
                  ]),
                ),
              ),
              const SizedBox(height: 40),
              Center(
                child: SizedBox(
                  key: startKey,
                  width: 172,
                  height: 172,
                  child: Blueprint(
                    border: false,
                    child: Material(
                      color: C.accent,
                      child: InkWell(
                        onTap: () => startDriving(context),
                        highlightColor: C.a600,
                        splashColor: C.a700.withValues(alpha: 0.4),
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          const Icon(I.navigation, color: C.n100, size: 28),
                          const SizedBox(height: 14),
                          Text('START DRIVING', style: T.heading(23, color: C.n100)),
                        ]),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 40),
              Kicker(b == null ? 'Fresh on your routes' : 'Fresh on your routes · ${b.timeBandLabel.toLowerCase()}'),
              const Hairline(),
              if (app.briefingLoading && b == null)
                Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: Text('Checking your area…', style: T.body(12.5, color: C.n700)))
              else if (fresh.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Text(app.offline ? 'Offline — camera alerts still work from the saved list.' : 'All clear near you right now.',
                      style: T.body(12.5, color: C.n700)),
                )
              else
                for (final a in fresh)
                  _Fresh(
                    a.lead == null ? a.name : '${a.lead!.label} · ${a.name}',
                    a.lead?.latestAt == null ? '' : ago(a.lead!.latestAt).replaceAll(' ago', ''),
                    alert: a.alert,
                    onTap: () => openArea(context, a),
                  ),
            ]),
          ),
        ),
      ),
    ]);
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.n, this.label, {this.onTap});
  final String n;
  final String label;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Expanded(
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 6, 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(n, style: T.heading(26)),
              Text(label, style: T.body(10.5, color: C.n700)),
            ]),
          ),
        ),
      );
}

class _Fresh extends StatelessWidget {
  const _Fresh(this.title, this.age, {this.onTap, this.alert = false});
  final String title;
  final String age;
  final bool alert;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
          child: Row(children: [
            if (alert) ...[Container(width: 6, height: 6, color: C.a700), const SizedBox(width: 8)],
            Expanded(child: Text(title, style: T.body(13), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Text(age, style: T.body(11.5, color: C.n700)),
          ]),
        ),
      );
}
