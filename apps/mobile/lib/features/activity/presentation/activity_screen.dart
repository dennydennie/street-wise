import 'package:flutter/material.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';

/// 17 Activity · my reports. Users see status, edit or delete what they posted.
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
    return Column(children: [
      TopBar('Activity', back: false, trailing: Tag('${app.postedCount} posted')),
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 4),
        child: Seg(
          options: ['My reports', 'Pins to finish${app.pinsToFinish.isEmpty ? '' : ' (${app.pinsToFinish.length})'}', 'Flags'],
          index: tab,
          onChanged: (i) => setState(() => tab = i),
        ),
      ),
      Expanded(
        child: switch (tab) {
          0 => _list(app.myReports, empty: 'Nothing posted yet. Tap Report while driving to add a hazard.'),
          1 => _list(app.pinsToFinish, empty: 'No pins waiting. Quick pins you drop while driving land here.'),
          _ => app.flagsSent.isEmpty
              ? _empty('No flags sent. Flag a report from its detail page.')
              : ListView(padding: const EdgeInsets.symmetric(horizontal: 20), children: [
                  for (final f in app.flagsSent)
                    RowTile(title: f.split(' · ').first, subtitle: 'Reporter: ${f.split(' · ').last} · with moderators', chevron: false, icon: I.flag),
                ]),
        },
      ),
    ]);
  }

  Widget _empty(String t) =>
      Center(child: Padding(padding: const EdgeInsets.all(32), child: Text(t, textAlign: TextAlign.center, style: T.body(13, color: C.n700))));

  Widget _list(List<MyReport> items, {required String empty}) {
    if (items.isEmpty) return _empty(empty);
    return ListView(padding: const EdgeInsets.symmetric(horizontal: 20), children: [
      for (final r in items)
        InkWell(
          onTap: () => _actions(r),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 11),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(r.title, style: T.body(14, weight: FontWeight.w500)),
                  Text('${r.place} · ${r.age}', style: T.body(11.5, color: C.n700)),
                ]),
              ),
              if (r.pin)
                const Tag('Finish', outline: true)
              else
                switch (r.status) {
                  ReportStatus.live => Tag('Live · ${r.confirms} confirm'),
                  ReportStatus.review => const Tag('In review', outline: true),
                  ReportStatus.expired => const Tag('Expired', neutral: true),
                },
            ]),
          ),
        ),
    ]);
  }

  Future<void> _actions(MyReport r) async {
    final app = App.read(context);
    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: C.bg,
      shape: const RoundedRectangleBorder(),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(r.title.toUpperCase(), style: T.heading(22)),
            Text('${r.place} · ${r.age}', style: T.body(12, color: C.n700)),
            const SizedBox(height: 10),
            if (r.pin) RowTile(title: 'Finish and post', icon: I.check, onTap: () => Navigator.pop(ctx, 'finish')),
            if (!r.pin) RowTile(title: 'Edit', icon: I.pencil, onTap: () => Navigator.pop(ctx, 'edit')),
            RowTile(title: 'Delete', icon: I.trash2, titleColor: const Color(0xFF9B2C2C), chevron: false, onTap: () => Navigator.pop(ctx, 'delete')),
          ]),
        ),
      ),
    );
    if (!mounted || action == null) return;
    switch (action) {
      case 'finish':
        if (!app.signedIn || !app.agreedToRules) {
          toast(context, 'Sign in and accept the Community rules to post.');
          return;
        }
        app.finishPin(r);
        toast(context, '${r.title} posted');
      case 'delete':
        app.deleteReport(r);
        toast(context, 'Report deleted');
      case 'edit':
        final ctrl = TextEditingController(text: r.title);
        final v = await showDialog<String>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: const RoundedRectangleBorder(),
            backgroundColor: C.bg,
            title: Text('EDIT REPORT', style: T.heading(22)),
            content: TextField(controller: ctrl, autofocus: true),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Save')),
            ],
          ),
        );
        if (v != null && v.trim().isNotEmpty) {
          r.title = v.trim();
          app.touch();
        }
    }
  }
}
