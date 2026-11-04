import 'package:flutter/material.dart';
import 'package:streetwise_zw/app/shell.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/brand.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/features/drive/presentation/drive_screens.dart';
import 'package:streetwise_zw/data/map_data.dart';
import 'package:streetwise_zw/features/map/presentation/report_detail_screen.dart';

/// 02 Home · ready to drive. Anonymous listening works without an account.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.startKey, required this.helpKey});
  final GlobalKey startKey;
  final GlobalKey helpKey;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        height: 56,
        padding: const EdgeInsets.only(left: 20, right: 12),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
        child: Row(children: [
          const Wordmark(),
          const Spacer(),
          const Tag('Synced 07:30'),
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
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              decoration: BoxDecoration(border: Border.all(color: C.divider)),
              child: IntrinsicHeight(
                child: Row(children: [
                  _Stat('20', 'Camera robots', onTap: () => Shell.of(context)?.setTab(1)),
                  const VerticalDivider(width: 1, color: C.divider),
                  _Stat('14', 'Reports near you', onTap: () => Shell.of(context)?.setTab(1)),
                  const VerticalDivider(width: 1, color: C.divider),
                  _Stat('3', 'Robots out', onTap: () => Shell.of(context)?.setTab(1)),
                ]),
              ),
            ),
            const SizedBox(height: 44),
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
            const SizedBox(height: 44),
            const Kicker('Fresh on your routes'),
            const Hairline(),
            _Fresh('Robot out · Seke / Cripps', '22 min',
                onTap: () => openReportDetail(context, sampleReports[1])),
            _Fresh('Pothole · Rotten Row, left lane', '3 h',
                onTap: () => openReportDetail(context, sampleReports[2])),
          ]),
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
  const _Fresh(this.title, this.age, {this.onTap});
  final String title;
  final String age;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
          child: Row(children: [
            Expanded(child: Text(title, style: T.body(13))),
            Text(age, style: T.body(11.5, color: C.n700)),
          ]),
        ),
      );
}
