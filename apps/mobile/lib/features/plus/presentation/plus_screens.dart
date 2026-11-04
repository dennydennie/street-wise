import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:streetwise_zw/app/shell.dart';
import 'package:streetwise_zw/core/api/api_client.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/auth/presentation/auth_screens.dart';
import 'package:streetwise_zw/features/drive/presentation/drive_screens.dart';
import 'package:streetwise_zw/features/legal/presentation/legal_screen.dart';

void _push(BuildContext c, Widget w) => Navigator.of(c).push(MaterialPageRoute(builder: (_) => w));
void _replace(BuildContext c, Widget w) => Navigator.of(c).pushReplacement(MaterialPageRoute(builder: (_) => w));
String _stamp(DateTime d) => '${dayMonth(d)} ${hm(d)}';

// ───────────────────────────── 21 Pick a pass ─────────────────────────────

class PickPassScreen extends StatefulWidget {
  const PickPassScreen({super.key});
  @override
  State<PickPassScreen> createState() => _PickPassScreenState();
}

class _PickPassScreenState extends State<PickPassScreen> {
  String sel = 'week';

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final cat = app.catalogue;
    final p = cat.where((x) => x.id == sel).firstOrNull ?? cat.first;
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
          for (final o in cat) ...[
            _PassTile(pass: o, selected: o.id == p.id, onTap: () => setState(() => sel = o.id)),
            const SizedBox(height: 10),
          ],
          const Spacer(),
          if (!app.signedIn) ...[
            Text('Sign in first so your pass follows you to a new phone.', style: T.body(12, color: C.n700)),
            const SizedBox(height: 8),
            Btn('Sign in to continue', onTap: () => _push(context, const WelcomeScreen())),
          ] else
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
  final PassOption pass;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      child: Material(
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
                  Text(pass.label, style: T.body(14, weight: FontWeight.w700)),
                  Text(pass.duration, style: T.body(11.5, color: C.n700)),
                ]),
              ),
              if (pass.badge != null) ...[Tag(pass.badge!, outline: pass.id == 'month'), const SizedBox(width: 10)],
              Text(money(pass.price), style: T.heading(21)),
            ]),
          ),
        ),
      ),
    );
  }
}

// ───────────────────────────── 22 Checkout ─────────────────────────────

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, required this.pass});
  final PassOption pass;
  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  bool ecocash = true;
  late final number = TextEditingController(text: _national(App.read(context).phone));
  bool starting = false;

  static String _national(String e164) {
    final d = e164.replaceFirst('+263', '');
    return d.length == 9 ? '0${d.substring(0, 2)} ${d.substring(2, 5)} ${d.substring(5)}' : '';
  }

  @override
  void dispose() {
    number.dispose();
    super.dispose();
  }

  String get e164 => toE164(number.text);
  bool get validNumber => RegExp(r'^\+2637[78]\d{7}$').hasMatch(e164);

  Future<void> _pay() async {
    final app = App.read(context);
    setState(() => starting = true);
    try {
      final payment = await app.startPayment(widget.pass, method: ecocash ? 'ecocash' : 'paynow_web', phone: ecocash ? e164 : null);
      if (!mounted) return;
      if (!ecocash && payment.redirectUrl != null) {
        await launchUrl(Uri.parse(payment.redirectUrl!), mode: LaunchMode.externalApplication);
      }
      if (!mounted) return;
      _push(context, PaymentWaitScreen(pass: widget.pass, payment: payment, number: ecocash ? e164 : null));
    } on ApiException catch (e) {
      if (mounted) toast(context, e.friendly);
    } finally {
      if (mounted) setState(() => starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final p = widget.pass;
    final now = DateTime.now();
    final starts = app.plusActive ? app.pass.endsAt! : now;
    final ends = app.passEnd(p);
    return SwPage(
      title: 'Checkout',
      body: Column(children: [
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 16), children: [
            const Kicker('Order'),
            const Hairline(),
            KV(p.label, money(p.price)),
            KV('Starts', app.plusActive ? '${_stamp(starts)} · after current pass' : 'Now · ${_stamp(now)}'),
            KV('Ends', _stamp(ends)),
            KV('Total', money(p.price), bold: true),
            const Kicker('Pay with'),
            _Method(
              badge: 'EC',
              title: 'EcoCash',
              sub: validNumber ? prettyPhone(e164) : 'Econet number',
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
                      hintText: '077 123 4567',
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12)),
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
            starting ? 'Starting payment…' : (ecocash ? 'Pay ${money(p.price)} with EcoCash' : 'Continue to Paynow'),
            onTap: starting || (ecocash && !validNumber) ? null : _pay,
          ),
        ),
      ]),
    );
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

// ───────────────────────────── 23 Waiting for EcoCash / Paynow ─────────────────────────────

/// Polls GET /payments/:ref every 5 s for up to 2 min. The pass is activated by
/// Paynow's paid callback on the server — the poll only reads the outcome.
class PaymentWaitScreen extends StatefulWidget {
  const PaymentWaitScreen({super.key, required this.pass, required this.payment, this.number});
  final PassOption pass;
  final Payment payment;
  final String? number;
  @override
  State<PaymentWaitScreen> createState() => _PaymentWaitScreenState();
}

class _PaymentWaitScreenState extends State<PaymentWaitScreen> {
  static const total = 120;
  int left = total;
  Timer? _t;
  late Payment payment = widget.payment;
  bool polling = false;

  bool get ecocash => payment.method == 'ecocash';

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
      if (left <= 0) _done();
    });
  }

  Future<void> _poll() async {
    if (polling) return;
    polling = true;
    try {
      payment = await App.read(context).pollPayment(payment.reference);
      if (payment.settled) _done();
    } on ApiException catch (_) {
      // transient: keep polling until the window closes
    } finally {
      polling = false;
    }
  }

  Future<void> _done() async {
    _t?.cancel();
    if (!mounted) return;
    final app = App.read(context);
    if (payment.status == 'paid') {
      await app.refreshPass();
      if (mounted) _replace(context, PaymentSuccessScreen(pass: widget.pass, payment: payment));
    } else {
      _replace(
        context,
        PaymentFailedScreen(
          pass: widget.pass,
          number: widget.number,
          reference: payment.reference,
          reason: payment.status == 'paid'
              ? ''
              : payment.failureReason ??
                  (left <= 0
                      ? 'Timed out. No approval received. Not charged.'
                      : payment.status == 'cancelled'
                          ? 'Payment cancelled. Not charged.'
                          : 'Declined. Not charged.'),
        ),
      );
    }
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
      title: ecocash ? 'Waiting for EcoCash' : 'Waiting for Paynow',
      body: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Spacer(),
          Align(alignment: Alignment.centerLeft, child: IconBox(ecocash ? I.smartphone : I.creditCard, marks: true)),
          const SizedBox(height: 16),
          Text(ecocash ? 'ENTER YOUR ECOCASH PIN ON THE POP-UP.' : 'FINISH PAYING IN THE PAYNOW PAGE.', style: T.display(32)),
          const SizedBox(height: 12),
          Text('${money(widget.pass.price)}${widget.number == null ? '' : ' · ${prettyPhone(widget.number!)}'}', style: T.body(13)),
          if (payment.instructions != null) ...[
            const SizedBox(height: 6),
            Text(payment.instructions!, style: T.body(12, color: C.n700)),
          ],
          const SizedBox(height: 12),
          LinearProgressIndicator(value: 1 - left / total, minHeight: 3, backgroundColor: C.a200, color: C.accent),
          const SizedBox(height: 6),
          Semantics(liveRegion: true, child: Text('Checking payment… $mm:$ss left', style: T.body(11.5, color: C.n700))),
          const SizedBox(height: 14),
          const Hairline(),
          KV('Reference', payment.reference),
          const KV('Merchant', 'StreetWise ZW (via Paynow)'),
          const Spacer(),
          if (!ecocash && payment.redirectUrl != null)
            Btn.secondary('Open Paynow again', icon: I.externalLink, onTap: () => launchUrl(Uri.parse(payment.redirectUrl!), mode: LaunchMode.externalApplication))
          else
            Btn.secondary('No pop-up? Try again', icon: I.refreshCw, onTap: () => Navigator.of(context).pop()),
          const SizedBox(height: 6),
          Btn.ghost('Stop waiting', onTap: () {
            _t?.cancel();
            Navigator.of(context).pop();
            toast(context, 'If you approve later, your pass still activates — check Subscription.');
          }),
        ]),
      ),
    );
  }
}

// ───────────────────────────── 24 Payment success ─────────────────────────────

class PaymentSuccessScreen extends StatelessWidget {
  const PaymentSuccessScreen({super.key, required this.pass, required this.payment});
  final PassOption pass;
  final Payment payment;

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final until = app.pass.endsAt == null ? '' : dayMonth(app.pass.endsAt!).toUpperCase();
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Spacer(),
            const Align(alignment: Alignment.centerLeft, child: IconBox(I.check)),
            const SizedBox(height: 18),
            Text(until.isEmpty ? 'PLUS IS ON.' : 'PLUS IS ON UNTIL $until.', style: T.display(36)),
            const SizedBox(height: 14),
            const Hairline(),
            KV('Paid', '${money(payment.amountCents / 100)} · ${payment.methodLabel}'),
            KV('Paynow ref', payment.reference),
            if (app.phone.isNotEmpty) KV('Receipt', 'Sent to ${app.phoneMasked}'),
            const Spacer(flex: 2),
            Btn('Start driving', icon: I.navigation, onTap: () => startDriving(context)),
            const SizedBox(height: 6),
            Btn.ghost('Done', onTap: () => Navigator.of(context).popUntil((r) => r.isFirst)),
          ]),
        ),
      ),
    );
  }
}

// ───────────────────────────── 25 Payment failed ─────────────────────────────

class PaymentFailedScreen extends StatelessWidget {
  const PaymentFailedScreen({super.key, required this.pass, required this.reference, required this.reason, this.number});
  final PassOption pass;
  final String? number;
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
            Btn('Try again', icon: I.refreshCw, onTap: () => _replace(context, CheckoutScreen(pass: pass))),
            const SizedBox(height: 6),
            Btn.ghost('Not now', onTap: () => Navigator.of(context).pop()),
          ]),
        ),
      ),
    );
  }
}

// ───────────────────────────── 26 Subscription · manage ─────────────────────────────

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});
  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  bool remind = true;

  @override
  void initState() {
    super.initState();
    App.read(context).refreshPass();
  }

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final days = app.plusDaysLeft;
    final pass = app.currentPass ?? app.catalogue.firstWhere((p) => p.id == 'week', orElse: () => app.catalogue.first);
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
              Text(days < 1 ? 'Ends today' : '$days day${days == 1 ? '' : 's'} left', style: T.heading(34)),
              const SizedBox(height: 8),
              LinearProgressIndicator(value: (days / pass.durationDays).clamp(0, 1), minHeight: 3, backgroundColor: C.a200, color: C.accent),
              const SizedBox(height: 8),
              Text('Ends ${dayMonth(app.pass.endsAt!)} · no auto-renew', style: T.body(12, color: C.n700)),
            ]),
          )
        else
          Text('NO ACTIVE PASS. CAMERA ALERTS STAY FREE.', style: T.display(26)),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: Btn(app.plusActive ? 'Extend pass' : 'Get Plus', height: 40, onTap: () => _push(context, app.plusActive ? CheckoutScreen(pass: pass) : const PickPassScreen()))),
          const SizedBox(width: 8),
          Expanded(child: Btn.secondary('Change pass', height: 40, onTap: () => _push(context, const PickPassScreen()))),
        ]),
        const SizedBox(height: 6),
        RowTile(
          icon: I.bell,
          title: 'Remind me before it ends',
          onTap: () => setState(() => remind = !remind),
          trailing: SqSwitch(value: remind, onChanged: (v) => setState(() => remind = v)),
        ),
        const Kicker('Payment history'),
        if (app.payments.isEmpty) Text('No payments yet.', style: T.body(12.5, color: C.n700)),
        for (final p in app.payments)
          RowTile(
            icon: I.receipt,
            title: app.catalogue.where((c) => c.id == p.passId).firstOrNull?.label ?? p.passId,
            subtitle: '${p.createdAt == null ? '' : dayMonth(p.createdAt!)} · ${p.methodLabel} · ${p.status}',
            chevron: false,
            trailing: Text(money(p.amountCents / 100), style: T.body(13.5, weight: FontWeight.w500)),
          ),
        const SizedBox(height: 10),
        GestureDetector(
          onTap: () => openLegal(context, LegalDoc.faq),
          child: Text('Refunds & billing help',
              style: T.body(12.5, color: C.a700, weight: FontWeight.w500).copyWith(decoration: TextDecoration.underline, decorationColor: C.a700)),
        ),
        const SizedBox(height: 14),
        Text('Nothing renews, so there is nothing to cancel. Receipts are kept for 12 months.', style: T.body(12, color: C.n700)),
      ]),
    );
  }
}
