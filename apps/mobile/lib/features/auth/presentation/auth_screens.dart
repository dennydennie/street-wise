import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/core/widgets/brand.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/features/legal/presentation/legal_screen.dart';
import 'package:streetwise_zw/features/onboarding/presentation/onboarding_screen.dart';
import 'package:streetwise_zw/app/shell.dart';

/// Where to go once the user is signed in (or chose to just listen).
void continueAfterAuth(BuildContext context) {
  final app = App.read(context);
  final next = app.onboarded ? const Shell() : const OnboardingScreen();
  Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => next), (_) => false);
}

// ───────────────────────────── 09 Welcome ─────────────────────────────

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Align(alignment: Alignment.centerLeft, child: Wordmark()),
            const SizedBox(height: 20),
            Text('KNOW THE ROBOT BEFORE YOU REACH IT.', style: T.display(40)),
            const Spacer(),
            Btn('Sign in with a passkey', icon: I.fingerprintPattern, onTap: () => showPasskeySheet(context)),
            const SizedBox(height: 10),
            Btn.secondary('Use phone number instead',
                icon: I.smartphone,
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PhoneEntryScreen()))),
            const SizedBox(height: 10),
            Btn.ghost('Just listen — no account', onTap: () => continueAfterAuth(context)),
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

// ───────────────────────────── 10 Passkey system sheet ─────────────────────────────

/// Stand-in for Android Credential Manager's sheet. OS-drawn in production, so it keeps
/// Android's rounded shape rather than the blueprint look.
Future<void> showPasskeySheet(BuildContext context, {bool create = false}) async {
  final app = App.read(context);
  final ok = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: Colors.white,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    builder: (ctx) => _PasskeySheet(create: create, name: app.displayName, phone: app.phoneMasked, initials: app.initials),
  );
  if (!context.mounted) return;
  if (ok == true) {
    app.signIn();
    if (create) {
      app.passkeys.insert(0, Passkey('Google Password Manager', 'Created ${dayMonth(DateTime.now())} 2026 · used today', thisPhone: true));
    }
    continueAfterAuth(context);
  } else if (ok == false) {
    // "Sign-in options" → phone fallback.
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PhoneEntryScreen()));
  }
}

class _PasskeySheet extends StatefulWidget {
  const _PasskeySheet({required this.create, required this.name, required this.phone, required this.initials});
  final bool create;
  final String name;
  final String phone;
  final String initials;

  @override
  State<_PasskeySheet> createState() => _PasskeySheetState();
}

class _PasskeySheetState extends State<_PasskeySheet> {
  bool scanning = false;

  Future<void> _scan() async {
    setState(() => scanning = true);
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final g = T.body(14, color: const Color(0xFF1F1F1F));
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 12),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 32, height: 4, decoration: BoxDecoration(color: C.n400, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 18),
          const Icon(I.keyRound, size: 26, color: C.a700),
          const SizedBox(height: 12),
          Text(widget.create ? 'Create a passkey for StreetWise ZW?' : 'Use your passkey for StreetWise ZW?',
              textAlign: TextAlign.center, style: g.copyWith(fontSize: 20, height: 1.3)),
          const SizedBox(height: 8),
          Text(widget.create ? 'It will be saved in Google Password Manager' : 'Saved in Google Password Manager',
              style: g.copyWith(fontSize: 12.5, color: C.n700)),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(border: Border.all(color: C.n300), borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: C.a100, borderRadius: BorderRadius.circular(6)),
                child: Text(widget.initials, style: T.heading(15, color: C.a700)),
              ),
              const SizedBox(width: 12),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(widget.name, style: g.copyWith(fontWeight: FontWeight.w600, fontSize: 13.5)),
                Text(widget.phone, style: g.copyWith(fontSize: 11.5, color: C.n700)),
              ]),
            ]),
          ),
          const SizedBox(height: 20),
          Semantics(
            button: true,
            label: 'Touch the fingerprint sensor',
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: scanning ? null : _scan,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: scanning ? C.a200 : Colors.transparent,
                  border: Border.all(color: C.a700, width: 1.2),
                ),
                child: Icon(scanning ? I.check : I.fingerprintPattern, color: C.a700, size: 30),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(scanning ? 'Verifying…' : 'Touch the fingerprint sensor', style: g.copyWith(fontSize: 12.5, color: C.n700)),
          const SizedBox(height: 14),
          Row(children: [
            if (!widget.create)
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: Text('Sign-in options', style: g.copyWith(color: C.a700, fontWeight: FontWeight.w600, fontSize: 13)),
              ),
            const Spacer(),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel', style: g.copyWith(color: C.a700, fontWeight: FontWeight.w600, fontSize: 13)),
            ),
          ]),
        ]),
      ),
    );
  }
}

// ───────────────────────────── Phone entry (pre-OTP) ─────────────────────────────

class PhoneEntryScreen extends StatefulWidget {
  const PhoneEntryScreen({super.key, this.changeOnly = false});

  /// From Account › Sign-in: verify a new number then return.
  final bool changeOnly;

  @override
  State<PhoneEntryScreen> createState() => _PhoneEntryScreenState();
}

class _PhoneEntryScreenState extends State<PhoneEntryScreen> {
  late final ctrl = TextEditingController(text: widget.changeOnly ? '' : '77 123 4821');

  String get digits => ctrl.text.replaceAll(RegExp(r'\D'), '');
  bool get valid => RegExp(r'^7[13478]\d{7}$').hasMatch(digits);

  @override
  void dispose() {
    ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SwPage(
      title: widget.changeOnly ? 'Change number' : 'Your number',
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('WE\'LL TEXT YOU A 6-DIGIT CODE.', style: T.display(32)),
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
                  autofocus: widget.changeOnly,
                  keyboardType: TextInputType.phone,
                  autofillHints: const [AutofillHints.telephoneNumberNational],
                  onChanged: (_) => setState(() {}),
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
          Btn('Send code',
              onTap: valid
                  ? () {
                      final d = digits;
                      final pretty = '+263 ${d.substring(0, 2)} ${d.substring(2, 5)} ${d.substring(5)}';
                      Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => OtpScreen(phone: pretty, changeOnly: widget.changeOnly)));
                    }
                  : null),
        ]),
      ),
    );
  }
}

// ───────────────────────────── 11 OTP ─────────────────────────────

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key, required this.phone, this.changeOnly = false});
  final String phone;
  final bool changeOnly;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  String code = '';
  int resendIn = 42;
  Timer? _tick;
  Timer? _autoRead;
  bool verifying = false;

  @override
  void initState() {
    super.initState();
    _startCountdown();
    // SMS Retriever API stand-in: fills the code a few seconds after it "arrives".
    _autoRead = Timer(const Duration(seconds: 5), () {
      if (mounted && code.isEmpty) _fill('482193');
    });
  }

  void _startCountdown() {
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => resendIn = (resendIn - 1).clamp(0, 99));
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
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;
    final app = App.read(context);
    app.phone = widget.phone;
    if (widget.changeOnly) {
      app.touch();
      toast(context, 'Number verified');
      Navigator.of(context)
        ..pop()
        ..pop();
      return;
    }
    app.signIn();
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const CreatePasskeyScreen()));
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
              TextSpan(text: widget.phone, style: const TextStyle(fontWeight: FontWeight.w700)),
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
            Row(children: [
              Text(
                verifying ? 'Verifying…' : (resendIn > 0 ? 'Resend code in $mm:$ss · ' : ''),
                style: T.body(11.5, color: C.n700),
              ),
              if (!verifying && resendIn == 0)
                _TextLink('Resend code', () {
                  setState(() => resendIn = 42);
                  _startCountdown();
                  toast(context, 'New code sent to ${widget.phone}');
                }),
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
                            child: k == '⌫'
                                ? const Icon(I.delete, size: 20, semanticLabel: 'Delete')
                                : Text(k, style: T.body(20)),
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
  late final name = TextEditingController(text: App.read(context).displayName);
  bool agreed = false;

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  void _commit() {
    final app = App.read(context);
    app.displayName = name.text.trim().isEmpty ? 'Driver' : name.text.trim();
    app.agreedToRules = true;
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
              style: T.body(14),
              decoration: const InputDecoration(
                  border: InputBorder.none, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12), isDense: true),
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
          Btn('Create passkey',
              icon: I.fingerprintPattern,
              onTap: agreed
                  ? () {
                      _commit();
                      showPasskeySheet(context, create: true);
                    }
                  : null),
          const SizedBox(height: 6),
          Btn.ghost('Skip — keep using SMS codes',
              onTap: agreed
                  ? () {
                      _commit();
                      continueAfterAuth(context);
                    }
                  : null),
        ]),
      ),
    );
  }
}
