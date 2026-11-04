import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:streetwise_zw/app/shell.dart';
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

class SignInPasskeysScreen extends StatelessWidget {
  const SignInPasskeysScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    return SwPage(
      title: 'Sign-in & passkeys',
      bottom: const PushedNav(),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 20), children: [
        const Kicker('Passkeys'),
        for (final pk in app.passkeys)
          RowTile(
            icon: I.keyRound,
            title: pk.provider,
            subtitle: pk.detail,
            trailing: pk.thisPhone
                ? const Tag('This phone')
                : IconButton(
                    tooltip: 'Remove passkey',
                    icon: const Icon(I.trash2, size: 17, color: C.n700),
                    onPressed: () async {
                      // Can't remove the last sign-in method: the verified phone is the fallback.
                      final ok = await _confirm(context, 'Remove passkey?',
                          '${pk.provider} will no longer sign you in. You can still use SMS codes to ${app.phoneMasked}.');
                      if (ok) {
                        app.passkeys.remove(pk);
                        app.touch();
                      }
                    },
                  ),
          ),
        const SizedBox(height: 12),
        Btn.secondary('Add a passkey', icon: I.plus, onTap: () => showPasskeySheet(context, create: true)),
        const Kicker('Phone number'),
        RowTile(
          icon: I.smartphone,
          title: app.phone,
          subtitle: 'Verified',
          trailing: GestureDetector(
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PhoneEntryScreen(changeOnly: true))),
            child: Text('Change',
                style: T.body(13, color: C.a700, weight: FontWeight.w500)
                    .copyWith(decoration: TextDecoration.underline, decorationColor: C.a700)),
          ),
        ),
        const Kicker('Sessions'),
        RowTile(title: 'This phone · Tecno Spark 20', subtitle: 'Active now', chevron: false),
        const SizedBox(height: 6),
        Btn.ghost('Sign out of all other devices', onTap: () => toast(context, 'Signed out of all other devices')),
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
          subtitle: app.locationAlways ? 'Always · drive mode only' : 'Not allowed',
          trailing: Tag(app.locationAlways ? 'On' : 'Off', neutral: !app.locationAlways),
          onTap: () {
            app.locationAlways = !app.locationAlways;
            app.touch();
          },
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
              _keepCell('On our servers', 'Hashed phone, name, your reports & votes'),
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
        RowTile(
          icon: I.download,
          title: 'Download my data',
          onTap: () => toast(context, 'Preparing export · we\'ll send a link to ${app.phoneMasked}'),
        ),
        RowTile(
          icon: I.trash2,
          title: 'Erase my reports only',
          onTap: () async {
            if (await _confirm(context, 'Erase all your reports?',
                'Your ${app.postedCount} reports, photos and votes are deleted. Your account stays.')) {
              app.eraseMyReports();
              if (context.mounted) toast(context, 'Your reports are erased');
            }
          },
        ),
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

// ───────────────────────────── Blocked reporters ─────────────────────────────

class BlockedScreen extends StatelessWidget {
  const BlockedScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    return SwPage(
      title: 'Blocked reporters',
      bottom: const PushedNav(),
      body: app.blocked.isEmpty
          ? Center(child: Text('Nobody blocked.', style: T.body(13, color: C.n700)))
          : ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 20), children: [
              Text('Their reports are hidden from your map and alerts. They are not told.', style: T.body(12.5, color: C.n700)),
              const SizedBox(height: 8),
              for (final b in app.blocked.toList())
                RowTile(
                  icon: I.ban,
                  title: b,
                  chevron: false,
                  trailing: TextButton(
                    onPressed: () {
                      app.blocked.remove(b);
                      app.touch();
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
    final ctrl = TextEditingController();
    final sent = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: const RoundedRectangleBorder(),
        backgroundColor: C.bg,
        title: Text('REPORT A PROBLEM', style: T.heading(22)),
        content: TextField(
          controller: ctrl,
          maxLines: 4,
          decoration: const InputDecoration(hintText: 'What went wrong? e.g. camera at Samora × 4th is gone'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Send')),
        ],
      ),
    );
    if (sent == true && context.mounted) toast(context, 'Sent · thanks for helping keep the map right');
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
          item('Your ${app.postedCount} reports, photos and votes'),
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
          Btn('Confirm with passkey & delete', kind: BtnKind.dark, icon: I.fingerprintPattern, onTap: () async {
            final ok = await _confirm(context, 'Delete your account?', 'This can\'t be undone.', action: 'Delete');
            if (!ok || !context.mounted) return;
            app.deleteAccount();
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
