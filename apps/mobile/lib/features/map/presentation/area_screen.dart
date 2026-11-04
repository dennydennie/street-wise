import 'package:flutter/material.dart';
import 'package:streetwise_zw/core/api/api_client.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';

void openArea(BuildContext context, AreaBriefing a) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => AreaScreen(seed: a)));

/// One area's briefing: what to do now, what happens at other times, and the reports behind it.
/// Reports can be flagged from here (16 · flag a report / block reporter).
class AreaScreen extends StatefulWidget {
  const AreaScreen({super.key, required this.seed});
  final AreaBriefing seed;
  @override
  State<AreaScreen> createState() => _AreaScreenState();
}

class _AreaScreenState extends State<AreaScreen> {
  late AreaBriefing area = widget.seed;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final a = await App.read(context).api.area(widget.seed.areaId);
      if (mounted) setState(() => area = a);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.friendly);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final relevant = area.relevant;
    final notNow = area.notNow;
    return SwPage(
      title: 'Area briefing',
      body: RefreshIndicator(
        color: C.accent,
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 16, 20, 28), children: [
          Row(children: [
            Expanded(child: Text(area.name.toUpperCase(), style: T.kicker())),
            _PriorityTag(area.priority, alert: area.alert),
          ]),
          const SizedBox(height: 6),
          Text((area.headline.isEmpty ? 'Nothing to watch here right now' : area.headline).toUpperCase(), style: T.display(28)),
          if (area.advice.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(area.advice, style: T.body(14, color: C.n800, height: 1.45)),
          ],
          if (loading) ...[const SizedBox(height: 12), const LinearProgressIndicator(minHeight: 2, color: C.accent, backgroundColor: C.a100)],
          if (error != null) ...[const SizedBox(height: 10), Text(error!, style: T.body(12, color: C.n700))],
          if (relevant.isNotEmpty) ...[
            const Kicker('Right now'),
            for (final i in relevant) _ItemRow(i),
          ],
          if (notNow.isNotEmpty) ...[
            const Kicker('Mostly at other times'),
            for (final i in notNow) _ItemRow(i, dim: true),
          ],
          if (area.hourly.length == 24 && area.hourly.any((h) => h > 0)) ...[
            const Kicker('When reports happen · 90 days'),
            _HourlyBars(area.hourly),
          ],
          if (area.recent.isNotEmpty) ...[
            const Kicker('Recent reports'),
            for (final r in area.recent)
              RowTile(
                title: r.title,
                subtitle: '${r.type.label} · ${ago(r.capturedAt ?? r.createdAt)}${r.stillThereCount > 0 ? ' · ${r.stillThereCount} confirm' : ''}',
                chevron: false,
                trailing: r.isMine || !app.signedIn
                    ? null
                    : IconButton(
                        tooltip: 'Flag this report',
                        icon: const Icon(I.flag, size: 17, color: C.n700),
                        onPressed: () => showFlagSheet(context, r),
                      ),
              ),
            if (!app.signedIn)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text('Sign in to confirm or flag reports.', style: T.body(12, color: C.n700)),
              ),
          ],
        ]),
      ),
    );
  }
}

class _PriorityTag extends StatelessWidget {
  const _PriorityTag(this.p, {required this.alert});
  final Priority p;
  final bool alert;
  @override
  Widget build(BuildContext context) => switch (p) {
        Priority.high => Tag(alert ? 'High · alerting' : 'High'),
        Priority.medium => Tag(alert ? 'Medium · alerting' : 'Medium', outline: true),
        Priority.low => const Tag('Low', neutral: true),
      };
}

class _ItemRow extends StatelessWidget {
  const _ItemRow(this.i, {this.dim = false});
  final BriefingItem i;
  final bool dim;
  @override
  Widget build(BuildContext context) {
    final meta = [
      if (i.liveCount > 0) '${i.liveCount} live',
      '${i.reportsLast90d} in 90 days',
      if (i.peakHours != null) 'peak ${i.peakHours}',
    ].join(' · ');
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
      child: Opacity(
        opacity: dim ? 0.7 : 1,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(i.label, style: T.body(14, weight: FontWeight.w600))),
            if (i.latestAt != null) Text(ago(i.latestAt), style: T.body(11.5, color: C.n700)),
          ]),
          if (i.summary.isNotEmpty) Text(i.summary, style: T.body(12.5, color: C.n800)),
          Text(meta, style: T.body(11, color: C.n700)),
        ]),
      ),
    );
  }
}

class _HourlyBars extends StatelessWidget {
  const _HourlyBars(this.hourly);
  final List<int> hourly;
  @override
  Widget build(BuildContext context) {
    final max = hourly.reduce((a, b) => a > b ? a : b).clamp(1, 1 << 30);
    final nowH = DateTime.now().hour;
    return Semantics(
      label: 'Reports by hour of day, busiest at ${hourly.indexOf(max)}:00',
      child: ExcludeSemantics(
        child: Column(children: [
          SizedBox(
            height: 64,
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              for (var h = 0; h < 24; h++)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 1),
                    child: Container(
                      height: 4 + 60 * hourly[h] / max,
                      color: h == nowH ? C.a700 : C.a300,
                    ),
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 4),
          Row(children: [
            for (final l in ['00', '06', '12', '18', '24'])
              Expanded(child: Text(l, textAlign: l == '00' ? TextAlign.left : (l == '24' ? TextAlign.right : TextAlign.center), style: T.body(10, color: C.n700))),
          ]),
        ]),
      ),
    );
  }
}

// ───────────────────────────── 16 Flag · block ─────────────────────────────

const flagReasons = [
  ('names_person_or_plate', 'Names a person or number plate'),
  ('false_or_gone', 'False or no longer there'),
  ('abusive', 'Abusive or offensive'),
  ('spam', 'Spam or advertising'),
  ('other', 'Something else'),
];

Future<void> showFlagSheet(BuildContext context, Report r) async {
  final sent = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: C.bg,
    barrierColor: C.text.withValues(alpha: 0.5),
    shape: const RoundedRectangleBorder(),
    builder: (_) => _FlagSheet(report: r),
  );
  if (sent == true && context.mounted) toast(context, 'Sent to moderators. Thanks for keeping it clean.');
}

class _FlagSheet extends StatefulWidget {
  const _FlagSheet({required this.report});
  final Report report;
  @override
  State<_FlagSheet> createState() => _FlagSheetState();
}

class _FlagSheetState extends State<_FlagSheet> {
  int reason = 0;
  bool block = false;
  bool sending = false;

  Future<void> _send() async {
    setState(() => sending = true);
    try {
      await App.read(context).flag(widget.report, reason: flagReasons[reason].$1, reasonLabel: flagReasons[reason].$2, block: block);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.friendly);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(child: Container(width: 32, height: 3, color: C.n400)),
          const SizedBox(height: 16),
          Text(widget.report.title.toUpperCase(), style: T.kicker(), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
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
                  Text(flagReasons[i].$2, style: T.body(13.5)),
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
                Text('Also block this reporter.', style: T.body(13.5, weight: FontWeight.w500)),
              ]),
            ),
          ),
          const SizedBox(height: 6),
          Btn(sending ? 'Sending…' : 'Send to moderators', icon: I.flag, onTap: sending ? null : _send),
        ]),
      ),
    );
  }
}
