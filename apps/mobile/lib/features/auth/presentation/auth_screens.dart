import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:streetwise_zw/app/shell.dart';
import 'package:streetwise_zw/core/api/api_client.dart';
import 'package:streetwise_zw/core/services/passkey_service.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/brand.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/legal/presentation/legal_screen.dart';
import 'package:streetwise_zw/features/onboarding/presentation/onboarding_screen.dart';

/// Where to go once the user is signed in (or chose to just listen).
void continueAfterAuth(BuildContext context) {
  final app = App.read(context);
  if (app.signedIn && (!app.agreedToRules || app.user?.displayName == null)) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CreatePasskeyScreen()));
    return;
  }
  final next = app.onboarded ? const Shell() : const OnboardingScreen();
  Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => next), (_) => false);
}

String _authError(Object e) => e is ApiException ? e.friendly : 'Something went wrong. Try again.';

// ───────────────────────────── 09 Welcome ─────────────────────────────

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});
  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  bool busy = false;

  /// 10 · The OS draws the passkey sheet (Credential Manager / browser WebAuthn).
  Future<void> _passkey() async {
    setState(() => busy = true);
    try {
      final r = await App.read(context).signInWithPasskey();
      if (!mounted || r == null) return;
      continueAfterAuth(context);
    } catch (e) {
      if (!mounted) return;
      if (!isPasskeyCancel(e)) {
        toast(context, e is ApiException ? e.friendly : 'No passkey found on this device. Use your phone number.');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Align(alignment: Alignment.centerLeft, child: Wordmark()),
            const SizedBox(height: 20),
            Text('KNOW THE ROBOT BEFORE YOU REACH IT.', style: T.display(40)),
            const Spacer(),
            if (app.config.passkeys) ...[
              Btn(busy ? 'Waiting for your passkey…' : 'Sign in with a passkey',
                  icon: I.fingerprintPattern, onTap: busy ? null : _passkey),
              const SizedBox(height: 10),
            ],
            Btn.secondary('Use phone number instead',
                icon: I.smartphone,
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PhoneEntryScreen()))),
            const SizedBox(height: 10),
            if (!app.signedIn) Btn.ghost('Just listen — no account', onTap: () => continueAfterAuth(context)),
            const SizedBox(height: 12),
            const LegalLine(),
          ]),
        ),
      ),
    );
  }
}

class LegalLine extends StatelessWidget {
  const LegalLine({super.key});

  @override
  Widget build(BuildContext context) {
    final base = T.body(11.5, color: C.n700);
    final link = base.copyWith(color: C.a700, decoration: TextDecoration.underline, decorationColor: C.a700);
    TextSpan l(String text, LegalDoc doc) => TextSpan(
          text: text,
          style: link,
          recognizer: TapGestureRecognizer()..onTap = () => openLegal(context, doc),
        );
    return Text.rich(
      TextSpan(style: base, children: [
        const TextSpan(text: 'By continuing you agree to the '),
        l('Terms', LegalDoc.terms),
        const TextSpan(text: ', '),
        l('Community rules', LegalDoc.community),
        const TextSpan(text: ' and '),
        l('Privacy policy', LegalDoc.privacy),
        const TextSpan(text: '.'),
      ]),
      textAlign: TextAlign.center,
    );
  }
}

// ───────────────────────────── Phone entry ─────────────────────────────

String toE164(String national) {
  final d = national.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^(263|0)'), '');
  return '+263$d';
}

String prettyPhone(String e164) {
  final d = e164.replaceFirst('+263', '');
  if (d.length != 9) return e164;
  return '+263 ${d.substring(0, 2)} ${d.substring(2, 5)} ${d.substring(5)}';
}

class PhoneEntryScreen extends StatefulWidget {
  const PhoneEntryScreen({super.key});
  @override
  State<PhoneEntryScreen> createState() => _PhoneEntryScreenState();
}

class _PhoneEntryScreenState extends State<PhoneEntryScreen> {
  final ctrl = TextEditingController();
  bool sending = false;

  String get e164 => toE164(ctrl.text);
  bool get valid => RegExp(r'^\+263[1-9]\d{8}$').hasMatch(e164);

  @override
  void dispose() {
    ctrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() => sending = true);
    try {
      final r = await App.read(context).requestOtp(e164);
      if (!mounted) return;
      Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => OtpScreen(phone: e164, resendAfter: r.resendAfterSeconds, devCode: r.devCode)));
    } catch (e) {
      if (mounted) toast(context, _authError(e));
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SwPage(
      title: 'Your number',
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text("WE'LL TEXT YOU A 6-DIGIT CODE.", style: T.display(32)),
          const SizedBox(height: 18),
          Text('Mobile number', style: T.body(12, color: C.n700)),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(color: C.surface, border: Border.all(color: C.divider)),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
                decoration: const BoxDecoration(border: Border(right: BorderSide(color: C.divider))),
                child: Text('+263', style: T.body(15, weight: FontWeight.w500)),
              ),
              Expanded(
                child: TextField(
                  controller: ctrl,
                  autofocus: true,
                  keyboardType: TextInputType.phone,
                  autofillHints: const [AutofillHints.telephoneNumberNational],
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) => valid && !sending ? _send() : null,
                  style: T.body(15),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(horizontal: 12),
                    hintText: '77 123 4567',
                  ),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 8),
          Text('Econet, NetOne and Telecel numbers.', style: T.body(11.5, color: C.n700)),
          const Spacer(),
          Btn(sending ? 'Sending…' : 'Send code', onTap: valid && !sending ? _send : null),
        ]),
      ),
    );
  }
}

// ───────────────────────────── 11 OTP ─────────────────────────────

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key, required this.phone, this.resendAfter = 60, this.devCode});
  final String phone;
  final int resendAfter;

  /// Present only against a local API with OTP_DEV_ECHO (stands in for the SMS Retriever auto-read).
  final String? devCode;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  String code = '';
  late int resendIn = widget.resendAfter;
  String? devCode;
  Timer? _tick;
  Timer? _autoRead;
  bool verifying = false;
  String? error;

  @override
  void initState() {
    super.initState();
    devCode = widget.devCode;
    _startCountdown();
    _scheduleAutoRead();
  }

  void _scheduleAutoRead() {
    _autoRead?.cancel();
    final c = devCode;
    if (c == null) return;
    _autoRead = Timer(const Duration(milliseconds: 1500), () {
      if (mounted && code.isEmpty) _fill(c);
    });
  }

  void _startCountdown() {
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => resendIn = (resendIn - 1).clamp(0, 999));
      if (resendIn == 0) t.cancel();
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    _autoRead?.cancel();
    super.dispose();
  }

  void _fill(String s) {
    setState(() => code = s);
    _maybeVerify();
  }

  void _key(String k) {
    _autoRead?.cancel();
    if (verifying) return;
    setState(() {
      error = null;
      if (k == '⌫') {
        if (code.isNotEmpty) code = code.substring(0, code.length - 1);
      } else if (code.length < 6) {
        code += k;
      }
    });
    _maybeVerify();
  }

  Future<void> _maybeVerify() async {
    if (code.length != 6) return;
    setState(() => verifying = true);
    try {
      await App.read(context).verifyOtp(widget.phone, code);
      if (!mounted) return;
      continueAfterAuth(context);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = _authError(e);
        code = '';
      });
    } finally {
      if (mounted) setState(() => verifying = false);
    }
  }

  Future<void> _resend() async {
    try {
      final r = await App.read(context).requestOtp(widget.phone);
      if (!mounted) return;
      setState(() {
        resendIn = r.resendAfterSeconds;
        devCode = r.devCode;
        error = null;
      });
      _startCountdown();
      _scheduleAutoRead();
      toast(context, 'New code sent to ${prettyPhone(widget.phone)}');
    } catch (e) {
      if (mounted) toast(context, _authError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final mm = (resendIn ~/ 60).toString();
    final ss = (resendIn % 60).toString().padLeft(2, '0');
    return SwPage(
      title: 'Verify your number',
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text.rich(TextSpan(style: T.body(13, color: C.n800), children: [
              const TextSpan(text: 'Sent to '),
              TextSpan(text: prettyPhone(widget.phone), style: const TextStyle(fontWeight: FontWeight.w700)),
            ])),
            const SizedBox(height: 12),
            Semantics(
              label: 'Code, ${code.length} of 6 digits entered',
              child: Row(children: [
                for (var i = 0; i < 6; i++) ...[
                  Expanded(child: _OtpBox(char: i < code.length ? code[i] : '', active: i == code.length)),
                  if (i < 5) const SizedBox(width: 7),
                ],
              ]),
            ),
            const SizedBox(height: 12),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(error!, style: T.body(12, color: const Color(0xFF9B2C2C))),
              ),
            Row(children: [
              Text(verifying ? 'Verifying…' : (resendIn > 0 ? 'Resend code in $mm:$ss · ' : ''),
                  style: T.body(11.5, color: C.n700)),
              if (!verifying && resendIn == 0) _TextLink('Resend code', _resend),
              if (!verifying && resendIn == 0) Text(' · ', style: T.body(11.5, color: C.n700)),
              if (!verifying) _TextLink('Change number', () => Navigator.of(context).pop()),
            ]),
          ]),
        ),
        const Spacer(),
        _Keypad(onKey: _key),
      ]),
    );
  }
}

class _TextLink extends StatelessWidget {
  const _TextLink(this.text, this.onTap);
  final String text;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Text(text,
            style: T.body(11.5, color: C.a700, weight: FontWeight.w500)
                .copyWith(decoration: TextDecoration.underline, decorationColor: C.a700)),
      );
}

class _OtpBox extends StatelessWidget {
  const _OtpBox({required this.char, required this.active});
  final String char;
  final bool active;
  @override
  Widget build(BuildContext context) => AspectRatio(
        aspectRatio: 0.9,
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: char.isEmpty && !active ? C.n100 : Colors.white.withValues(alpha: 0.6),
            border: Border.all(color: active ? C.a700 : C.divider, width: active ? 1.4 : 1),
          ),
          child: Text(char, style: T.heading(24)),
        ),
      );
}

class _Keypad extends StatelessWidget {
  const _Keypad({required this.onKey});
  final ValueChanged<String> onKey;

  @override
  Widget build(BuildContext context) {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '⌫'],
    ];
    return Container(
      color: C.surface,
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(children: [
        for (final r in rows)
          Row(children: [
            for (final k in r)
              Expanded(
                child: k.isEmpty
                    ? const SizedBox(height: 56)
                    : InkWell(
                        onTap: () => onKey(k),
                        child: SizedBox(
                          height: 56,
                          child: Center(
                            child: k == '⌫' ? const Icon(I.delete, size: 20, semanticLabel: 'Delete') : Text(k, style: T.body(20)),
                          ),
                        ),
                      ),
              ),
          ]),
      ]),
    );
  }
}

// ───────────────────────────── 12 Create passkey · agree ─────────────────────────────

class CreatePasskeyScreen extends StatefulWidget {
  const CreatePasskeyScreen({super.key});
  @override
  State<CreatePasskeyScreen> createState() => _CreatePasskeyScreenState();
}

class _CreatePasskeyScreenState extends State<CreatePasskeyScreen> {
  late final name = TextEditingController(text: App.read(context).user?.displayName ?? '');
  late bool agreed = App.read(context).agreedToRules;
  bool busy = false;

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  Future<bool> _saveProfile() async {
    final n = name.text.trim();
    if (n.isEmpty) {
      toast(context, 'Add a display name — it shows on your reports.');
      return false;
    }
    try {
      await App.read(context).completeProfile(displayName: n, agreed: agreed);
      return true;
    } catch (e) {
      if (mounted) toast(context, _authError(e));
      return false;
    }
  }

  void _done() {
    final app = App.read(context);
    final next = app.onboarded ? const Shell() : const OnboardingScreen();
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => next), (_) => false);
  }

  Future<void> _create() async {
    setState(() => busy = true);
    try {
      if (!await _saveProfile()) return;
      if (!mounted) return;
      try {
        await App.read(context).createPasskey();
        if (mounted) toast(context, 'Passkey saved. Next time, just use your fingerprint.');
      } catch (e) {
        if (mounted && !isPasskeyCancel(e)) toast(context, 'Couldn\'t create a passkey here. You can add one later in Account.');
      }
      if (mounted) _done();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _skip() async {
    setState(() => busy = true);
    try {
      if (await _saveProfile() && mounted) _done();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final base = T.body(12.5, color: C.n800);
    final link = base.copyWith(color: C.a700, decoration: TextDecoration.underline, decorationColor: C.a700);
    return SwPage(
      title: 'Finish setting up',
      body: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Align(alignment: Alignment.centerLeft, child: Icon(I.keyRound, size: 26, color: C.a700)),
          const SizedBox(height: 12),
          Text('NEXT TIME, SIGN IN WITH YOUR FINGERPRINT.', style: T.display(30)),
          const SizedBox(height: 14),
          Text('Display name · shown on your reports', style: T.body(11.5, color: C.n700)),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(color: C.surface, border: Border.all(color: C.divider)),
            child: TextField(
              controller: name,
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.nickname],
              maxLength: 60,
              onChanged: (_) => setState(() {}),
              style: T.body(14),
              decoration: const InputDecoration(
                  counterText: '',
                  hintText: 'e.g. Tendai M.',
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  isDense: true),
            ),
          ),
          const Spacer(),
          InkWell(
            onTap: () => setState(() => agreed = !agreed),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(top: 2), child: SqCheck(value: agreed)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text.rich(TextSpan(style: base, children: [
                    const TextSpan(text: 'I agree to the '),
                    TextSpan(
                        text: 'Terms of use',
                        style: link,
                        recognizer: TapGestureRecognizer()..onTap = () => openLegal(context, LegalDoc.terms)),
                    const TextSpan(text: ' and '),
                    TextSpan(
                        text: 'Community rules',
                        style: link,
                        recognizer: TapGestureRecognizer()..onTap = () => openLegal(context, LegalDoc.community)),
                    const TextSpan(text: ': report places, never people or plates.'),
                  ])),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 10),
          Btn(busy ? 'Saving…' : 'Create passkey', icon: I.fingerprintPattern, onTap: agreed && !busy ? _create : null),
          const SizedBox(height: 6),
          Btn.ghost('Skip — keep using SMS codes', onTap: agreed && !busy ? _skip : null),
        ]),
      ),
    );
  }
}
