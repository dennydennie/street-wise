import 'dart:async';

import 'package:flutter/material.dart';
import 'package:streetwise_zw/app/shell.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/drive/presentation/drive_screens.dart';
import 'package:streetwise_zw/features/legal/presentation/legal_screen.dart';

void _push(BuildContext c, Widget w) => Navigator.of(c).push(MaterialPageRoute(builder: (_) => w));
void _replace(BuildContext c, Widget w) => Navigator.of(c).pushReplacement(MaterialPageRoute(builder: (_) => w));

String _ref() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  final n = DateTime.now().microsecondsSinceEpoch;
  return 'SWZ-${List.generate(6, (i) => chars[(n >> (i * 5)) % chars.length]).join()}';
}

String _stamp(DateTime d) => '${dayMonth(d)} ${hm(d)}';

// ───────────────────────────── 21 Pick a pass ─────────────────────────────

class PickPassScreen extends StatefulWidget {
  const PickPassScreen({super.key});
  @override
  State<PickPassScreen> createState() => _PickPassScreenState();
}

class _PickPassScreenState extends State<PickPassScreen> {
  int sel = 1;

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final p = passes[sel];
    return SwPage(
      title: 'StreetWise Plus',
      body: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('HEAR EVERY HAZARD, NOT JUST CAMERAS.', style: T.display(30)),
          const SizedBox(height: 14),
          Container(
            decoration: BoxDecoration(border: Border.all(color: C.divider)),
            child: IntrinsicHeight(
              child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Expanded(child: _cmp('Free', 'Camera alerts', false)),
                const VerticalDivider(width: 1, color: C.divider),
                Expanded(child: _cmp('Plus', 'All hazard alerts', true)),
              ]),
            ),
          ),
          const SizedBox(height: 12),
          for (var i = 0; i < passes.length; i++) ...[
            _PassTile(pass: passes[i], selected: i == sel, onTap: () => setState(() => sel = i)),
            const SizedBox(height: 10),
          ],
          const Spacer(),
          if (!app.signedIn)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text('Sign in first so your pass follows you to a new phone.', style: T.body(12, color: C.n700)),
            ),
          Btn('Continue · ${money(p.price)}', onTap: () => _push(context, CheckoutScreen(pass: p))),
        ]),
      ),
    );
  }

  Widget _cmp(String k, String v, bool tint) => Container(
        color: tint ? C.a100 : null,
        padding: const EdgeInsets.all(10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(k.toUpperCase(), style: T.kicker(color: C.n700)),
          const SizedBox(height: 3),
          Text(v, style: T.body(12.5)),
        ]),
      );
}

class _PassTile extends StatelessWidget {
  const _PassTile({required this.pass, required this.selected, required this.onTap});
  final Pass pass;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tile = Material(
      color: selected ? C.a100 : C.n100,
      shape: RoundedRectangleBorder(side: BorderSide(color: selected ? C.accent : C.divider)),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(children: [
            Dot(selected: selected),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(pass.name, style: T.body(14, weight: FontWeight.w700)),
                Text(pass.duration, style: T.body(11.5, color: C.n700)),
              ]),
            ),
            if (pass.badge != null) ...[Tag(pass.badge!, outline: pass.id == 'month'), const SizedBox(width: 10)],
            Text(money(pass.price), style: T.heading(21)),
          ]),
        ),
      ),
    );
    return Semantics(selected: selected, child: tile);
  }
}

// ───────────────────────────── 22 Checkout ─────────────────────────────

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, required this.pass});
  final Pass pass;
  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  bool ecocash = true;
  late final number = TextEditingController(text: '077 123 4821');

  @override
  void dispose() {
    number.dispose();
    super.dispose();
  }

  bool get validNumber => RegExp(r'^07[78]\d{7}$').hasMatch(number.text.replaceAll(' ', ''));

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final p = widget.pass;
    final now = DateTime.now();
    final starts = app.plusActive ? app.plusUntil! : now;
    final ends = app.passEnd(p);
    return SwPage(
      title: 'Checkout',
      body: Column(children: [
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 16), children: [
            const Kicker('Order'),
            const Hairline(),
            KV(p.name, money(p.price)),
            KV('Starts', app.plusActive ? '${_stamp(starts)} · after current pass' : 'Now · ${_stamp(now)}'),
            KV('Ends', _stamp(ends)),
            KV('Total', money(p.price), bold: true),
            const Kicker('Pay with'),
            _Method(
              badge: 'EC',
              title: 'EcoCash',
              sub: '077 ••• 4821',
              selected: ecocash,
              onTap: () => setState(() => ecocash = true),
            ),
            const SizedBox(height: 10),
            _Method(
              badge: 'PN',
              title: 'Paynow',
              sub: 'OneMoney · InnBucks · Card',
              selected: !ecocash,
              onTap: () => setState(() => ecocash = false),
            ),
            if (ecocash) ...[
              const SizedBox(height: 14),
              Text('EcoCash number', style: T.body(12, color: C.n700)),
              const SizedBox(height: 6),
              Container(
                decoration: BoxDecoration(color: C.surface, border: Border.all(color: C.divider)),
                child: TextField(
                  controller: number,
                  keyboardType: TextInputType.phone,
                  onChanged: (_) => setState(() {}),
                  style: T.body(14),
                  decoration: const InputDecoration(
                      border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12)),
                ),
              ),
              if (!validNumber && number.text.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('Enter an Econet number, e.g. 077 123 4567', style: T.body(11.5, color: const Color(0xFF9B2C2C))),
                ),
            ],
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Btn(
            ecocash ? 'Pay ${money(p.price)} with EcoCash' : 'Continue to Paynow',
            onTap: ecocash && !validNumber
                ? null
                : () {
                    final ref = _ref();
                    if (ecocash) {
                      _push(context, EcoCashWaitScreen(pass: p, number: number.text, reference: ref));
                    } else {
                      _paynowWeb(context, p, ref);
                    }
                  },
          ),
        ),
      ]),
    );
  }

  /// Paynow secure web checkout stand-in (opens in a browser tab in production).
  Future<void> _paynowWeb(BuildContext context, Pass p, String ref) async {
    final method = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              const Icon(I.shieldCheck, size: 16, color: C.n700),
              const SizedBox(width: 6),
              Text('paynow.co.zw · secure checkout', style: T.body(12, color: C.n700)),
            ]),
            const SizedBox(height: 10),
            Text('Pay ${money(p.price)} to StreetWise ZW', style: T.body(17, weight: FontWeight.w700)),
            Text('Ref $ref', style: T.body(12, color: C.n700)),
            const SizedBox(height: 10),
            for (final m in ['OneMoney', 'InnBucks', 'Visa / Mastercard'])
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(m, style: T.body(14)),
                trailing: const Icon(I.chevronRight, size: 16),
                onTap: () => Navigator.pop(ctx, m),
              ),
          ]),
        ),
      ),
    );
    if (method == null || !context.mounted) return;
    App.read(context).activatePass(p, 'Paynow · $method');
    _replace(context, PaymentSuccessScreen(pass: p, method: 'Paynow · $method', reference: ref));
  }
}

class _Method extends StatelessWidget {
  const _Method({required this.badge, required this.title, required this.sub, required this.selected, required this.onTap});
  final String badge;
  final String title;
  final String sub;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: C.n100,
        shape: RoundedRectangleBorder(side: BorderSide(color: selected ? C.a700 : C.divider, width: selected ? 1.4 : 1)),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(border: Border.all(color: C.divider)),
                child: Text(badge, style: T.heading(14)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: T.body(14, weight: FontWeight.w700)),
                  Text(sub, style: T.body(11.5, color: C.n700)),
                ]),
              ),
              Dot(selected: selected),
            ]),
          ),
        ),
      );
}

// ───────────────────────────── 23 EcoCash · approve on phone ─────────────────────────────

/// Polls every 5 s for up to 2 min. The demo approves after ~8 s;
/// numbers ending in 0000 simulate "insufficient balance".
class EcoCashWaitScreen extends StatefulWidget {
  const EcoCashWaitScreen({super.key, required this.pass, required this.number, required this.reference});
  final Pass pass;
  final String number;
  final String reference;
  @override
  State<EcoCashWaitScreen> createState() => _EcoCashWaitScreenState();
}

class _EcoCashWaitScreenState extends State<EcoCashWaitScreen> {
  static const total = 120;
  int left = total;
  int polls = 0;
  Timer? _t;

  @override
  void initState() {
    super.initState();
    _start();
  }

  void _start() {
    _t?.cancel();
    _t = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => left--);
      if ((total - left) % 5 == 0) _poll();
      if (left <= 0) _fail('Timed out. No approval received.');
    });
  }

  void _poll() {
    polls++;
    final digits = widget.number.replaceAll(' ', '');
    if (polls >= 2) {
      if (digits.endsWith('0000')) {
        _fail('Insufficient balance. Not charged.');
      } else {
        _t?.cancel();
        App.read(context).activatePass(widget.pass, 'EcoCash');
        _replace(context, PaymentSuccessScreen(pass: widget.pass, method: 'EcoCash', reference: widget.reference));
      }
    }
  }

  void _fail(String why) {
    _t?.cancel();
    _replace(
      context,
      PaymentFailedScreen(pass: widget.pass, number: widget.number, reference: widget.reference, reason: why),
    );
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mm = left ~/ 60;
    final ss = (left % 60).toString().padLeft(2, '0');
    return SwPage(
      title: 'Waiting for EcoCash',
      body: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Spacer(),
          const Align(alignment: Alignment.centerLeft, child: IconBox(I.smartphone, marks: true)),
          const SizedBox(height: 16),
          Text('ENTER YOUR ECOCASH PIN ON THE POP-UP.', style: T.display(32)),
          const SizedBox(height: 12),
          Text('${money(widget.pass.price)} · ${widget.number}', style: T.body(13)),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: 1 - left / total,
            minHeight: 3,
            backgroundColor: C.a200,
            color: C.accent,
          ),
          const SizedBox(height: 6),
          Semantics(liveRegion: true, child: Text('Checking payment… $mm:$ss left', style: T.body(11.5, color: C.n700))),
          const SizedBox(height: 14),
          const Hairline(),
          KV('Reference', widget.reference),
          const KV('Merchant', 'StreetWise ZW (via Paynow)'),
          const Spacer(),
          Btn.secondary('No pop-up? Resend prompt', icon: I.refreshCw, onTap: () {
            setState(() {
              left = total;
              polls = 0;
            });
            _start();
            toast(context, 'Prompt resent to ${widget.number}');
          }),
          const SizedBox(height: 6),
          Btn.ghost('Cancel payment', onTap: () => _fail('You cancelled the payment. Not charged.')),
        ]),
      ),
    );
  }
}

// ───────────────────────────── 24 Payment success ─────────────────────────────

class PaymentSuccessScreen extends StatelessWidget {
  const PaymentSuccessScreen({super.key, required this.pass, required this.method, required this.reference});
  final Pass pass;
  final String method;
  final String reference;

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final until = app.plusUntil == null ? '' : dayMonth(app.plusUntil!).toUpperCase();
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Spacer(),
            const Align(alignment: Alignment.centerLeft, child: IconBox(I.check)),
            const SizedBox(height: 18),
            Text('PLUS IS ON UNTIL $until.', style: T.display(36)),
            const SizedBox(height: 14),
            const Hairline(),
            KV('Paid', '${money(pass.price)} · $method'),
            KV('Paynow ref', reference),
            KV('Receipt', 'Sent to ${app.phoneMasked}'),
            const Spacer(flex: 2),
            Btn('Start driving', icon: I.navigation, onTap: () => startDriving(context)),
            const SizedBox(height: 6),
            Btn.ghost('View receipt', onTap: () => _receipt(context, app)),
          ]),
        ),
      ),
    );
  }

  void _receipt(BuildContext context, AppState app) => showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: const RoundedRectangleBorder(),
          backgroundColor: C.bg,
          title: Text('RECEIPT', style: T.heading(22)),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            const KV('Merchant', 'StreetWise ZW'),
            KV('Item', 'Plus · ${pass.name}'),
            KV('Amount', money(pass.price)),
            KV('Method', method),
            KV('Reference', reference),
            KV('Valid until', app.plusUntil == null ? '—' : _stamp(app.plusUntil!)),
          ]),
          actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
        ),
      );
}

// ───────────────────────────── 25 Payment failed ─────────────────────────────

class PaymentFailedScreen extends StatelessWidget {
  const PaymentFailedScreen({
    super.key,
    required this.pass,
    required this.number,
    required this.reference,
    required this.reason,
  });
  final Pass pass;
  final String number;
  final String reference;
  final String reason;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Spacer(),
            const Align(alignment: Alignment.centerLeft, child: IconBox(I.x)),
            const SizedBox(height: 18),
            Text("PAYMENT DIDN'T GO THROUGH.", style: T.display(36)),
            const SizedBox(height: 10),
            Text(reason, style: T.body(13, color: C.n800)),
            const SizedBox(height: 14),
            const Hairline(),
            KV('Reference', reference),
            KV('Status', 'Declined · ${hm(DateTime.now())}'),
            const Spacer(flex: 2),
            Btn('Try EcoCash again',
                icon: I.refreshCw,
                onTap: () => _replace(context, EcoCashWaitScreen(pass: pass, number: number, reference: _ref()))),
            const SizedBox(height: 8),
            Btn.secondary('Pay with Paynow instead', onTap: () => _replace(context, CheckoutScreen(pass: pass))),
            const SizedBox(height: 6),
            Btn.ghost('Not now', onTap: () => Navigator.of(context).pop()),
          ]),
        ),
      ),
    );
  }
}

// ───────────────────────────── 26 Subscription · manage ─────────────────────────────

class SubscriptionScreen extends StatelessWidget {
  const SubscriptionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final days = app.plusDaysLeft;
    final pass = passes.firstWhere((p) => p.name == app.plusPassName, orElse: () => passes[1]);
    return SwPage(
      title: 'Subscription',
      bottom: const PushedNav(),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 16, 20, 20), children: [
        if (app.plusActive)
          Blueprint(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text('PLUS · ${app.plusPassName.toUpperCase()}', style: T.kicker()),
                const Spacer(),
                const Tag('Active'),
              ]),
              const SizedBox(height: 6),
              Text('$days day${days == 1 ? '' : 's'} left', style: T.heading(34)),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: (days / pass.days).clamp(0, 1),
                minHeight: 3,
                backgroundColor: C.a200,
                color: C.accent,
              ),
              const SizedBox(height: 8),
              Text('Ends ${dayMonth(app.plusUntil!)} · no auto-renew', style: T.body(12, color: C.n700)),
            ]),
          )
        else
          Text('NO ACTIVE PASS. CAMERA ALERTS STAY FREE.', style: T.display(26)),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: Btn('Extend pass', height: 40, onTap: () => _push(context, CheckoutScreen(pass: pass)))),
          const SizedBox(width: 8),
          Expanded(child: Btn.secondary('Change pass', height: 40, onTap: () => _push(context, const PickPassScreen()))),
        ]),
        const SizedBox(height: 6),
        RowTile(
          icon: I.bell,
          title: 'Remind me before it ends',
          onTap: () {
            app.remindBeforeEnd = !app.remindBeforeEnd;
            app.touch();
          },
          trailing: SqSwitch(
              value: app.remindBeforeEnd,
              onChanged: (v) {
                app.remindBeforeEnd = v;
                app.touch();
              }),
        ),
        const Kicker('Payment history'),
        if (app.payments.isEmpty) Text('No payments yet.', style: T.body(12.5, color: C.n700)),
        for (final p in app.payments)
          RowTile(
            icon: I.receipt,
            title: p.pass,
            subtitle: '${p.date} · ${p.method}',
            chevron: false,
            trailing: Text(money(p.amount), style: T.body(13.5, weight: FontWeight.w500)),
          ),
        const SizedBox(height: 10),
        GestureDetector(
          onTap: () => openLegal(context, LegalDoc.faq),
          child: Text('Refunds & billing help',
              style: T.body(12.5, color: C.a700, weight: FontWeight.w500)
                  .copyWith(decoration: TextDecoration.underline, decorationColor: C.a700)),
        ),
        const SizedBox(height: 14),
        Text('Nothing renews, so there is nothing to cancel. Receipts are kept for 12 months.',
            style: T.body(12, color: C.n700)),
      ]),
    );
  }
}
