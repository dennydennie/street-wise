import 'package:flutter/material.dart';
import 'package:streetwise_zw/core/api/api_client.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/auth/presentation/auth_screens.dart';

/// 17 Activity · my reports. Users see status, edit, publish or delete what they posted.
class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});
  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  int tab = 0;

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final pinsCount = app.drafts.length + app.pendingPins.length;
    return Column(children: [
      TopBar('Activity', back: false, trailing: Tag('${app.postedCount} posted')),
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 4),
        child: Seg(
          options: ['My reports', 'Pins to finish${pinsCount == 0 ? '' : ' ($pinsCount)'}', 'Flags'],
          index: tab,
          onChanged: (i) => setState(() => tab = i),
        ),
      ),
      if (!app.signedIn && tab != 1)
        Expanded(child: _signInPrompt(context))
      else
        Expanded(
          child: RefreshIndicator(
            color: C.accent,
            onRefresh: app.refreshAccount,
            child: switch (tab) {
              0 => _reports(app.posted, empty: 'Nothing posted yet. Tap Report while driving to add a hazard.'),
              1 => _pins(app),
              _ => app.flagsSent.isEmpty
                  ? _empty('No flags sent from this phone. Flag a report from its area briefing.')
                  : ListView(padding: const EdgeInsets.symmetric(horizontal: 20), children: [
                      for (final f in app.flagsSent)
                        RowTile(title: f.split(' · ').first, subtitle: '${f.split(' · ').skip(1).join(' · ')} · with moderators', chevron: false, icon: I.flag),
                    ]),
            },
          ),
        ),
    ]);
  }

  Widget _signInPrompt(BuildContext context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Sign in to see and manage your reports.', textAlign: TextAlign.center, style: T.body(13, color: C.n700)),
          const SizedBox(height: 14),
          Btn('Sign in', onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WelcomeScreen()))),
        ]),
      );

  Widget _empty(String t) => ListView(children: [
        Padding(padding: const EdgeInsets.all(32), child: Text(t, textAlign: TextAlign.center, style: T.body(13, color: C.n700))),
      ]);

  Widget _reports(List<Report> items, {required String empty}) {
    if (items.isEmpty) return _empty(empty);
    return ListView(padding: const EdgeInsets.symmetric(horizontal: 20), children: [
      for (final r in items) _ReportRow(report: r, onTap: () => _actions(r)),
    ]);
  }

  Widget _pins(AppState app) {
    final drafts = app.drafts;
    if (drafts.isEmpty && app.pendingPins.isEmpty) return _empty('No pins waiting. Quick pins you drop while driving land here.');
    return ListView(padding: const EdgeInsets.symmetric(horizontal: 20), children: [
      for (final p in app.pendingPins)
        InkWell(
          onTap: () => _pendingActions(p),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 11),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.type.label, style: T.body(14, weight: FontWeight.w500)),
                  Text('${p.lat.toStringAsFixed(4)}, ${p.lng.toStringAsFixed(4)} · ${ago(p.capturedAt)}', style: T.body(11.5, color: C.n700)),
                ]),
              ),
              Tag(app.signedIn ? 'Waiting to send' : 'On this phone', neutral: true),
            ]),
          ),
        ),
      for (final r in drafts) _ReportRow(report: r, onTap: () => _actions(r)),
      if (!app.signedIn && app.pendingPins.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Btn.secondary('Sign in to post these pins', onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WelcomeScreen()))),
        ),
    ]);
  }

  Future<void> _pendingActions(PendingPin p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: const RoundedRectangleBorder(),
        backgroundColor: C.bg,
        title: Text('DISCARD PIN?', style: T.heading(22)),
        content: Text('${p.type.label} pinned ${ago(p.capturedAt)} hasn\'t been sent yet.', style: T.body(13.5)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Discard')),
        ],
      ),
    );
    if (ok == true && mounted) App.read(context).discardPendingPin(p);
  }

  Future<void> _actions(Report r) async {
    final app = App.read(context);
    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: C.bg,
      shape: const RoundedRectangleBorder(),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(r.type.label.toUpperCase(), style: T.heading(22)),
            Text('${r.place} · ${ago(r.capturedAt ?? r.createdAt)}', style: T.body(12, color: C.n700)),
            if (r.transcript != null) ...[
              const SizedBox(height: 6),
              Text('You said: "${r.transcript}"', style: T.body(12.5, color: C.n800).copyWith(fontStyle: FontStyle.italic)),
            ],
            const SizedBox(height: 10),
            if (r.status == 'draft') RowTile(title: 'Finish and post', icon: I.check, onTap: () => Navigator.pop(ctx, 'publish')),
            if (r.status == 'draft' || r.status == 'live') RowTile(title: 'Change hazard type', icon: I.pencil, onTap: () => Navigator.pop(ctx, 'retype')),
            RowTile(title: 'Delete', icon: I.trash2, titleColor: const Color(0xFF9B2C2C), chevron: false, onTap: () => Navigator.pop(ctx, 'delete')),
          ]),
        ),
      ),
    );
    if (!mounted || action == null) return;
    try {
      switch (action) {
        case 'publish':
          if (!app.agreedToRules) {
            toast(context, 'Accept the Community rules in Account first.');
            return;
          }
          await app.publishDraft(r);
          if (mounted) toast(context, '${r.type.label} posted');
        case 'delete':
          await app.deleteReport(r);
          if (mounted) toast(context, 'Report deleted');
        case 'retype':
          final t = await showModalBottomSheet<ReportType>(
            context: context,
            backgroundColor: C.bg,
            shape: const RoundedRectangleBorder(),
            builder: (ctx) => SafeArea(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                for (final t in ReportType.values)
                  ListTile(title: Text(t.label, style: T.body(14)), trailing: Dot(selected: t == r.type), onTap: () => Navigator.pop(ctx, t)),
              ]),
            ),
          );
          if (t != null && t != r.type) await app.retypeReport(r, t);
      }
    } on ApiException catch (e) {
      if (mounted) toast(context, e.friendly);
    }
  }
}

class _ReportRow extends StatelessWidget {
  const _ReportRow({required this.report, required this.onTap});
  final Report report;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final r = report;
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r.summary ?? r.type.label, style: T.body(14, weight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
              Text('${r.place} · ${ago(r.capturedAt ?? r.createdAt)}', style: T.body(11.5, color: C.n700), maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
          const SizedBox(width: 8),
          switch (r.status) {
            'live' => Tag('Live · ${r.stillThereCount} confirm'),
            'review' => const Tag('In review', outline: true),
            'draft' => const Tag('Finish', outline: true),
            _ => const Tag('Expired', neutral: true),
          },
        ]),
      ),
    );
  }
}
