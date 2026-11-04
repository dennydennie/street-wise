import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:streetwise_zw/app/shell.dart';
import 'package:streetwise_zw/core/api/api_client.dart';
import 'package:streetwise_zw/core/services/passkey_service.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/auth/presentation/auth_screens.dart';
import 'package:streetwise_zw/features/legal/presentation/legal_screen.dart';

const _danger = Color(0xFF9B2C2C);

// ───────────────────────────── 08 Alerts & voice ─────────────────────────────

class AlertsVoiceScreen extends StatelessWidget {
  const AlertsVoiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    Widget toggleRow(String label, bool v, ValueChanged<bool> on, {String? sub}) => RowTile(
          title: label,
          subtitle: sub,
          onTap: () => on(!v),
          trailing: SqSwitch(value: v, onChanged: on),
        );
    return SwPage(
      title: 'Alerts & voice',
      bottom: const PushedNav(),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 20), children: [
        const Kicker('Alert timing'),
        Seg(
          options: const ['Early', 'Standard', 'Late'],
          index: app.alertTiming,
          onChanged: (i) {
            app.alertTiming = i;
            app.touch();
          },
        ),
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 4),
          child: Text(['About 500 m out', 'About 300 m · 15–20 s before', 'About 150 m out'][app.alertTiming],
              style: T.body(11.5, color: C.n700)),
        ),
        const Hairline(),
        RowTile(
          title: 'Voice language',
          chevron: false,
          trailing: Text(app.voiceLanguage, style: T.body(13, color: C.a700, weight: FontWeight.w500)),
          onTap: () async {
            final v = await showModalBottomSheet<String>(
              context: context,
              backgroundColor: C.bg,
              shape: const RoundedRectangleBorder(),
              builder: (ctx) => SafeArea(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  for (final l in ['English', 'Shona', 'Ndebele'])
                    ListTile(
                      title: Text(l, style: T.body(14)),
                      trailing: Dot(selected: l == app.voiceLanguage),
                      onTap: () => Navigator.pop(ctx, l),
                    ),
                ]),
              ),
            );
            if (v != null) {
              app.voiceLanguage = v;
              app.touch();
            }
          },
        ),
        const Kicker('Speak these reports'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final e in app.spoken.entries)
            InkWell(
              onTap: () {
                app.spoken[e.key] = !e.value;
                app.touch();
              },
              child: Semantics(
                toggled: e.value,
                child: Tag(e.key, outline: !e.value),
              ),
            ),
        ]),
        const SizedBox(height: 12),
        const Hairline(),
        toggleRow('50 m chime', app.chime50, (v) {
          app.chime50 = v;
          app.touch();
        }),
        toggleRow('Passenger mode', app.passengerMode, (v) {
          app.passengerMode = v;
          app.touch();
        }, sub: 'Unlocks typing and photos while moving'),
        toggleRow('Data saver', app.dataSaver, (v) {
          app.dataSaver = v;
          app.touch();
        }, sub: 'Sync the camera list on Wi-Fi only'),
        RowTile(
          title: 'Quiet hours',
          chevron: false,
          onTap: () {
            app.quietHours = !app.quietHours;
            app.touch();
          },
          trailing: Text(app.quietHours ? '22:00–05:00' : 'Off', style: T.body(13, color: C.a700, weight: FontWeight.w500)),
        ),
        const SizedBox(height: 12),
        Text("Camera alerts can't be switched off — they're the core safety reminder.", style: T.body(12, color: C.n700)),
      ]),
    );
  }
}

// ───────────────────────────── 14 Sign-in & passkeys ─────────────────────────────

class SignInPasskeysScreen extends StatefulWidget {
  const SignInPasskeysScreen({super.key});
  @override
  State<SignInPasskeysScreen> createState() => _SignInPasskeysScreenState();
}

class _SignInPasskeysScreenState extends State<SignInPasskeysScreen> {
  bool adding = false;

  @override
  void initState() {
    super.initState();
    final app = App.read(context);
    app.refreshSessions();
    app.refreshAccount();
  }

  Future<void> _add() async {
    setState(() => adding = true);
    try {
      await App.read(context).createPasskey();
      if (mounted) toast(context, 'Passkey added');
    } catch (e) {
      if (mounted && !isPasskeyCancel(e)) toast(context, e is ApiException ? e.friendly : 'This device couldn\'t create a passkey.');
    } finally {
      if (mounted) setState(() => adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    return SwPage(
      title: 'Sign-in & passkeys',
      bottom: const PushedNav(),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 20), children: [
        const Kicker('Passkeys'),
        if (app.passkeys.isEmpty) Text('No passkeys yet. You sign in with SMS codes.', style: T.body(12.5, color: C.n700)),
        for (final pk in app.passkeys)
          RowTile(
            icon: I.keyRound,
            title: pk.label ?? 'Passkey',
            subtitle: 'Created ${pk.createdAt == null ? '—' : dayMonth(pk.createdAt!)}'
                '${pk.lastUsedAt == null ? ' · not used yet' : ' · used ${ago(pk.lastUsedAt)}'}',
            trailing: IconButton(
              tooltip: 'Remove passkey',
              icon: const Icon(I.trash2, size: 17, color: C.n700),
              onPressed: () async {
                final ok = await _confirm(context, 'Remove passkey?',
                    '${pk.label ?? 'This passkey'} will no longer sign you in. You can still use SMS codes to ${app.phoneMasked}.');
                if (!ok || !context.mounted) return;
                try {
                  await app.deletePasskey(pk);
                } on ApiException catch (e) {
                  if (context.mounted) toast(context, e.friendly);
                }
              },
            ),
          ),
        const SizedBox(height: 12),
        Btn.secondary(adding ? 'Waiting for your device…' : 'Add a passkey', icon: I.plus, onTap: adding ? null : _add),
        const Kicker('Phone number'),
        RowTile(
          icon: I.smartphone,
          title: app.phone.isEmpty ? 'No phone number' : prettyPhone(app.phone),
          subtitle: app.phone.isEmpty ? null : 'Verified',
          chevron: false,
          trailing: GestureDetector(
            onTap: () => toast(context, 'To change your number, contact support@streetwise.co.zw from Help.'),
            child: Text('Change',
                style: T.body(13, color: C.a700, weight: FontWeight.w500)
                    .copyWith(decoration: TextDecoration.underline, decorationColor: C.a700)),
          ),
        ),
        const Kicker('Sessions'),
        if (app.sessions.isEmpty) Text('Loading sessions…', style: T.body(12.5, color: C.n700)),
        for (final s in app.sessions)
          RowTile(
            title: s.current ? 'This device · ${s.deviceLabel ?? 'Unknown'}' : (s.deviceLabel ?? 'Unknown device'),
            subtitle: s.current ? 'Active now' : 'Last seen ${ago(s.lastSeenAt)}',
            chevron: false,
          ),
        const SizedBox(height: 6),
        if (app.sessions.where((s) => !s.current).isNotEmpty)
          Btn.ghost('Sign out of all other devices', onTap: () async {
            try {
              await app.signOutOtherDevices();
              if (context.mounted) toast(context, 'Signed out of all other devices');
            } on ApiException catch (e) {
              if (context.mounted) toast(context, e.friendly);
            }
          }),
      ]),
    );
  }
}

// ───────────────────────────── 15 Privacy & data ─────────────────────────────

class PrivacyDataScreen extends StatelessWidget {
  const PrivacyDataScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    return SwPage(
      title: 'Privacy & data',
      bottom: const PushedNav(),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 20), children: [
        const Kicker('Permissions'),
        RowTile(
          icon: I.mapPin,
          title: 'Location',
          subtitle: app.here.real ? 'Allowed · drive mode only' : 'Not allowed — tap to allow',
          trailing: Tag(app.here.real ? 'On' : 'Off', neutral: !app.here.real),
          onTap: () => app.locate(request: true),
        ),
        RowTile(
          icon: I.smartphone,
          title: 'Physical activity',
          subtitle: 'Detects when you start and stop driving',
          trailing: Tag(app.physicalActivity ? 'On' : 'Off', neutral: !app.physicalActivity),
          onTap: () {
            app.physicalActivity = !app.physicalActivity;
            app.touch();
          },
        ),
        const Kicker('What we keep'),
        Container(
          decoration: BoxDecoration(border: Border.all(color: C.divider)),
          child: IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _keepCell('On our servers', 'Phone, name, your reports & votes'),
              const VerticalDivider(width: 1, color: C.divider),
              _keepCell('Only on this phone', 'Trips, GPS history, cached map'),
            ]),
          ),
        ),
        const SizedBox(height: 6),
        RowTile(
          title: 'Crash reports & usage stats',
          onTap: () {
            app.crashReports = !app.crashReports;
            app.touch();
          },
          trailing: SqSwitch(
              value: app.crashReports,
              onChanged: (v) {
                app.crashReports = v;
                app.touch();
              }),
        ),
        if (app.signedIn) ...[
          RowTile(
            icon: I.download,
            title: 'Download my data',
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const _ExportScreen())),
          ),
          RowTile(
            icon: I.trash2,
            title: 'Erase my reports only',
            onTap: () async {
              if (!await _confirm(context, 'Erase all your reports?',
                  'Your ${app.myReports.length} reports and their votes are deleted. Your account stays.')) {
                return;
              }
              try {
                final n = await app.eraseMyReports();
                if (context.mounted) toast(context, '$n report${n == 1 ? '' : 's'} erased');
              } on ApiException catch (e) {
                if (context.mounted) toast(context, e.friendly);
              }
            },
          ),
        ],
        RowTile(
          icon: I.fileText,
          title: 'Privacy policy',
          subtitle: 'streetwise.co.zw/privacy',
          external: true,
          onTap: () => openLegal(context, LegalDoc.privacy),
        ),
      ]),
    );
  }

  Widget _keepCell(String k, String v) => Expanded(
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(k, style: T.body(11, color: C.n700)),
            const SizedBox(height: 3),
            Text(v, style: T.body(12.5)),
          ]),
        ),
      );
}

/// Shows the JSON export from GET /me/export with a copy button.
class _ExportScreen extends StatefulWidget {
  const _ExportScreen();
  @override
  State<_ExportScreen> createState() => _ExportScreenState();
}

class _ExportScreenState extends State<_ExportScreen> {
  String? json;
  String? error;

  @override
  void initState() {
    super.initState();
    App.read(context).api.exportMe().then((v) {
      if (mounted) setState(() => json = const JsonEncoder.withIndent('  ').convert(v));
    }).catchError((Object e) {
      if (mounted) setState(() => error = e is ApiException ? e.friendly : '$e');
    });
  }

  @override
  Widget build(BuildContext context) {
    return SwPage(
      title: 'My data',
      body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(
          child: json == null
              ? Center(child: Text(error ?? 'Preparing your export…', style: T.body(13, color: C.n700)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: SelectableText(json!, style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5)),
                ),
        ),
        if (json != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Btn('Copy all', icon: I.download, onTap: () {
              Clipboard.setData(ClipboardData(text: json!));
              toast(context, 'Copied ${(json!.length / 1024).toStringAsFixed(1)} KB');
            }),
          ),
      ]),
    );
  }
}

// ───────────────────────────── Blocked reporters ─────────────────────────────

class BlockedScreen extends StatelessWidget {
  const BlockedScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    return SwPage(
      title: 'Blocked reporters',
      bottom: const PushedNav(),
      body: app.blocks.isEmpty
          ? Center(child: Text('Nobody blocked.', style: T.body(13, color: C.n700)))
          : ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 20), children: [
              Text('Their reports are hidden from your map and alerts. Reporters stay anonymous and are not told.',
                  style: T.body(12.5, color: C.n700)),
              const SizedBox(height: 8),
              for (final b in app.blocks.toList())
                RowTile(
                  icon: I.ban,
                  title: 'Reporter blocked',
                  subtitle: b.createdAt == null ? null : 'Since ${dayMonth(b.createdAt!)}',
                  chevron: false,
                  trailing: TextButton(
                    onPressed: () async {
                      try {
                        await app.unblock(b);
                      } on ApiException catch (e) {
                        if (context.mounted) toast(context, e.friendly);
                      }
                    },
                    child: Text('Unblock', style: T.body(13, color: C.a700, weight: FontWeight.w500)),
                  ),
                ),
            ]),
    );
  }
}

// ───────────────────────────── 18 Help & legal ─────────────────────────────

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key, this.legalFirst = false});
  final bool legalFirst;

  @override
  Widget build(BuildContext context) {
    final help = [
      const Kicker('Get help'),
      RowTile(icon: I.circleHelp, title: 'Take the tour', onTap: () => Shell.of(context)?.startTour()),
      RowTile(icon: I.circleHelp, title: 'FAQ', onTap: () => openLegal(context, LegalDoc.faq)),
      RowTile(icon: I.smartphone, title: 'Keep StreetWise running', onTap: () => openLegal(context, LegalDoc.keepRunning)),
      RowTile(
        icon: I.mail,
        title: 'Contact support',
        subtitle: 'support@streetwise.co.zw',
        onTap: () {
          Clipboard.setData(const ClipboardData(text: 'support@streetwise.co.zw'));
          toast(context, 'Email address copied');
        },
      ),
      RowTile(icon: I.flag, title: 'Report a bug or wrong camera', onTap: () => _bug(context)),
    ];
    final legal = [
      const Kicker('Legal'),
      RowTile(icon: I.fileText, title: 'Terms of use', external: true, onTap: () => openLegal(context, LegalDoc.terms)),
      RowTile(icon: I.fileText, title: 'Community rules', external: true, onTap: () => openLegal(context, LegalDoc.community)),
      RowTile(icon: I.fileText, title: 'Privacy policy', external: true, onTap: () => openLegal(context, LegalDoc.privacy)),
      RowTile(icon: I.fileText, title: 'Open-source licences', onTap: () => openLegal(context, LegalDoc.licences)),
    ];
    return SwPage(
      title: legalFirst ? 'Legal' : 'Help & support',
      bottom: const PushedNav(),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
        children: legalFirst ? [...legal, ...help] : [...help, ...legal],
      ),
    );
  }

  Future<void> _bug(BuildContext context) async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: C.bg,
      shape: const RoundedRectangleBorder(),
      builder: (_) => const _SupportSheet(),
    );
    if (sent == true && context.mounted) toast(context, 'Sent to support · thanks for helping keep the map right');
  }
}

/// Help › Report a bug or wrong camera → POST /support/messages (e-mailed to support).
class _SupportSheet extends StatefulWidget {
  const _SupportSheet();
  @override
  State<_SupportSheet> createState() => _SupportSheetState();
}

class _SupportSheetState extends State<_SupportSheet> {
  static const categories = [('wrong_camera', 'Wrong or missing camera'), ('bug', 'Something isn\'t working'), ('billing', 'Payments & passes'), ('other', 'Something else')];
  int category = 0;
  final message = TextEditingController();
  final email = TextEditingController();
  bool includeLocation = true;
  bool sending = false;

  @override
  void dispose() {
    message.dispose();
    email.dispose();
    super.dispose();
  }

  bool get valid =>
      message.text.trim().length >= 5 && (email.text.trim().isEmpty || RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email.text.trim()));

  Future<void> _send() async {
    final app = App.read(context);
    setState(() => sending = true);
    try {
      final here = app.here;
      await app.api.supportMessage(
        category: categories[category].$1,
        message: message.text.trim(),
        replyEmail: email.text.trim().isEmpty ? null : email.text.trim(),
        lat: includeLocation && here.real ? here.lat : null,
        lng: includeLocation && here.real ? here.lng : null,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.friendly);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final here = App.of(context).here;
    InputDecoration deco(String hint) => InputDecoration(
          hintText: hint,
          hintStyle: T.body(13, color: C.n600),
          filled: true,
          fillColor: C.surface,
          border: const OutlineInputBorder(borderRadius: BorderRadius.zero, borderSide: BorderSide(color: C.divider)),
          enabledBorder: const OutlineInputBorder(borderRadius: BorderRadius.zero, borderSide: BorderSide(color: C.divider)),
          focusedBorder: const OutlineInputBorder(borderRadius: BorderRadius.zero, borderSide: BorderSide(color: C.a700)),
        );
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Center(child: Container(width: 32, height: 3, color: C.n400)),
            const SizedBox(height: 16),
            Text('REPORT A PROBLEM', style: T.heading(24)),
            const SizedBox(height: 8),
            for (var i = 0; i < categories.length; i++)
              InkWell(
                onTap: () => setState(() => category = i),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  child: Row(children: [Dot(selected: category == i), const SizedBox(width: 12), Text(categories[i].$2, style: T.body(13.5))]),
                ),
              ),
            const SizedBox(height: 8),
            TextField(
              controller: message,
              maxLines: 4,
              maxLength: 2000,
              onChanged: (_) => setState(() {}),
              style: T.body(14),
              decoration: deco(category == 0 ? 'e.g. The camera at Samora × 4th is gone' : 'What happened?'),
            ),
            TextField(
              controller: email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              onChanged: (_) => setState(() {}),
              style: T.body(14),
              decoration: deco('Your e-mail, if you want a reply (optional)'),
            ),
            if (here.real)
              InkWell(
                onTap: () => setState(() => includeLocation = !includeLocation),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Row(children: [
                    SqCheck(value: includeLocation),
                    const SizedBox(width: 12),
                    Expanded(child: Text('Include my current location', style: T.body(13.5))),
                  ]),
                ),
              )
            else
              const SizedBox(height: 12),
            Btn(sending ? 'Sending…' : 'Send to support', icon: I.mail, onTap: valid && !sending ? _send : null),
          ]),
        ),
      ),
    );
  }
}

// ───────────────────────────── 19 Delete account ─────────────────────────────

class DeleteAccountScreen extends StatelessWidget {
  const DeleteAccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    Widget item(String t) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(children: [
            const Icon(I.check, size: 15, color: C.n800),
            const SizedBox(width: 10),
            Expanded(child: Text(t, style: T.body(13))),
          ]),
        );
    return SwPage(
      title: 'Delete account',
      body: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('THIS PERMANENTLY DELETES YOUR ACCOUNT.', style: T.display(30)),
          const SizedBox(height: 10),
          const Hairline(),
          const Kicker('Deleted within 30 days'),
          item('Your name, phone number and passkeys'),
          item('Your ${app.myReports.length} reports and votes'),
          item('Reputation and blocked list'),
          const Kicker('Kept'),
          Text('Anonymous moderation logs · 90 days', style: T.body(13)),
          const SizedBox(height: 18),
          Blueprint(
            padding: const EdgeInsets.all(12),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(I.externalLink, size: 15, color: C.n700),
              const SizedBox(width: 10),
              Expanded(
                child: Text.rich(TextSpan(style: T.body(12.5, color: C.n800), children: [
                  const TextSpan(text: 'Also on the web: '),
                  TextSpan(
                    text: 'streetwise.co.zw/delete-account',
                    style: const TextStyle(color: C.a700, decoration: TextDecoration.underline, decorationColor: C.a700),
                  ),
                ])),
              ),
            ]),
          ),
          const Spacer(),
          Btn('Delete my account', kind: BtnKind.dark, icon: I.trash2, onTap: () async {
            final ok = await _confirm(context, 'Delete your account?', 'This can\'t be undone.', action: 'Delete');
            if (!ok || !context.mounted) return;
            try {
              await app.deleteAccount();
            } on ApiException catch (e) {
              if (context.mounted) toast(context, e.friendly);
              return;
            }
            if (!context.mounted) return;
            Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const AccountDeletedScreen()), (_) => false);
          }),
          const SizedBox(height: 6),
          Btn.ghost('Keep my account', onTap: () => Navigator.of(context).pop()),
        ]),
      ),
    );
  }
}

// ───────────────────────────── 20 Account deleted ─────────────────────────────

class AccountDeletedScreen extends StatelessWidget {
  const AccountDeletedScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final erased = DateTime.now().add(const Duration(days: 30));
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Spacer(flex: 2),
            const Align(alignment: Alignment.centerLeft, child: IconBox(I.check)),
            const SizedBox(height: 18),
            Text('YOUR ACCOUNT IS DELETED.', style: T.display(38)),
            const SizedBox(height: 8),
            Text('Server data erased by ${dayMonth(erased)}.', style: T.body(13, color: C.n800)),
            const Spacer(flex: 3),
            Btn('Keep listening', icon: I.navigation, onTap: () {
              Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const Shell()), (_) => false);
            }),
            const SizedBox(height: 6),
            Btn.ghost('Close app', onTap: () => SystemNavigator.pop()),
          ]),
        ),
      ),
    );
  }
}

Future<bool> _confirm(BuildContext context, String title, String body, {String action = 'Confirm'}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: const RoundedRectangleBorder(),
      backgroundColor: C.bg,
      title: Text(title.toUpperCase(), style: T.heading(22)),
      content: Text(body, style: T.body(13.5, color: C.n800)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(action, style: TextStyle(color: action == 'Delete' ? _danger : C.a700, fontWeight: FontWeight.w600)),
        ),
      ],
    ),
  );
  return r ?? false;
}
