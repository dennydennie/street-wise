import 'package:flutter/material.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/data/map_data.dart';

void openReportDetail(BuildContext context, MapPoint p) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReportDetailScreen(point: p)));

/// Community report detail with the flag + block sheet (16).
class ReportDetailScreen extends StatelessWidget {
  const ReportDetailScreen({super.key, required this.point});
  final MapPoint point;

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final mine = point.by == app.displayName;
    final blocked = point.by != null && app.blocked.contains(point.by);
    return SwPage(
      title: 'Report detail',
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 16, 20, 24), children: [
        Text(point.kicker.toUpperCase(), style: T.kicker()),
        const SizedBox(height: 6),
        Text(point.title.toUpperCase(), style: T.display(30)),
        const SizedBox(height: 6),
        if (point.by != null) Text('By ${point.by} · ${point.age}', style: T.body(12, color: C.n700)),
        const SizedBox(height: 16),
        KV('Where', point.detail),
        KV('Source', point.source),
        KV('Confirmations', point.camera ? '—' : '${point.confirms}'),
        KV('Status', point.expiry),
        if (blocked) ...[
          const SizedBox(height: 16),
          Text('You blocked ${point.by}. Their reports are hidden from your map and alerts.',
              style: T.body(12.5, color: C.n700)),
        ],
        const SizedBox(height: 24),
        if (!point.camera && !mine) ...[
          Btn.secondary('Flag this report', icon: I.flag, onTap: () => showFlagSheet(context, point)),
        ],
        if (point.camera) Text('Official cameras can\'t be flagged. Report a wrong camera from Help.', style: T.body(12, color: C.n700)),
      ]),
    );
  }
}

const flagReasons = [
  'Names a person or number plate',
  'False or no longer there',
  'Abusive or offensive',
  'Spam or advertising',
  'Something else',
];

Future<void> showFlagSheet(BuildContext context, MapPoint p) async {
  final sent = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: C.bg,
    barrierColor: C.text.withValues(alpha: 0.5),
    shape: const RoundedRectangleBorder(),
    builder: (_) => _FlagSheet(reporter: p.by ?? 'this reporter'),
  );
  if (sent == true && context.mounted) toast(context, 'Sent to moderators. Thanks for keeping it clean.');
}

class _FlagSheet extends StatefulWidget {
  const _FlagSheet({required this.reporter});
  final String reporter;
  @override
  State<_FlagSheet> createState() => _FlagSheetState();
}

class _FlagSheetState extends State<_FlagSheet> {
  int reason = 0;
  bool block = false;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(child: Container(width: 32, height: 3, color: C.n400)),
          const SizedBox(height: 16),
          Text("WHAT'S WRONG WITH IT?", style: T.heading(24)),
          const SizedBox(height: 8),
          for (var i = 0; i < flagReasons.length; i++)
            InkWell(
              onTap: () => setState(() => reason = i),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
                child: Row(children: [
                  Dot(selected: reason == i),
                  const SizedBox(width: 12),
                  Text(flagReasons[i], style: T.body(13.5)),
                ]),
              ),
            ),
          InkWell(
            onTap: () => setState(() => block = !block),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Row(children: [
                SqCheck(value: block),
                const SizedBox(width: 12),
                Text('Also block ${widget.reporter}.', style: T.body(13.5, weight: FontWeight.w500)),
              ]),
            ),
          ),
          const SizedBox(height: 6),
          Btn('Send to moderators', icon: I.flag, onTap: () {
            final app = App.read(context);
            app.flagsSent.add('${flagReasons[reason]} · ${widget.reporter}');
            if (block) app.blocked.add(widget.reporter);
            app.touch();
            Navigator.of(context).pop(true);
          }),
        ]),
      ),
    );
  }
}
