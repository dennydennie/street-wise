import 'package:flutter/material.dart';
import 'package:streetwise_zw/app/shell.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/account/presentation/account_pages.dart';
import 'package:streetwise_zw/features/auth/presentation/auth_screens.dart';
import 'package:streetwise_zw/features/plus/presentation/plus_screens.dart';

void push(BuildContext context, Widget page) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

/// 13 Account tab. Every store-required control is one tap from here.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    return Column(children: [
      const TopBar('Account', back: false),
      Expanded(
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 20), children: [
          if (app.signedIn && !app.agreedToRules)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Blueprint(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Expanded(child: Text('Accept the Community rules to post reports.', style: T.body(13))),
                  TextButton(onPressed: () => push(context, const CreatePasskeyScreen()), child: const Text('Review')),
                ]),
              ),
            ),
          if (app.signedIn)
            InkWell(
              onTap: () => _editName(context),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
                child: Row(children: [
                  Container(
                    width: 46,
                    height: 46,
                    color: C.a100,
                    alignment: Alignment.center,
                    child: Text(app.initials, style: T.heading(20, color: C.a700)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(app.displayName, style: T.body(15, weight: FontWeight.w700)),
                      Text(app.phoneMasked, style: T.body(11.5, color: C.n700)),
                    ]),
                  ),
                  const Icon(I.chevronRight, size: 16, color: C.n600),
                ]),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Blueprint(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text('LISTENING WITHOUT AN ACCOUNT', style: T.kicker()),
                  const SizedBox(height: 6),
                  Text('Camera alerts work as they are. Sign in to post reports, confirm hazards and buy Plus.',
                      style: T.body(13, color: C.n800)),
                  const SizedBox(height: 12),
                  Btn('Sign in', icon: I.fingerprintPattern, onTap: () => push(context, const WelcomeScreen())),
                ]),
              ),
            ),
          RowTile(
            icon: I.creditCard,
            title: 'Subscription',
            subtitle: app.plusActive ? 'Plus · ${app.plusPassName} · ${app.plusDaysLeft} days left' : 'Free · camera alerts',
            onTap: () => push(context, app.plusActive ? const SubscriptionScreen() : const PickPassScreen()),
          ),
          if (app.signedIn)
            RowTile(
              icon: I.fingerprintPattern,
              title: 'Sign-in & passkeys',
              subtitle: '${app.passkeys.length} passkey${app.passkeys.length == 1 ? '' : 's'}${app.phone.isEmpty ? '' : ' · phone verified'}',
              onTap: () => push(context, const SignInPasskeysScreen()),
            ),
          RowTile(icon: I.slidersHorizontal, title: 'Alerts & voice', onTap: () => push(context, const AlertsVoiceScreen())),
          RowTile(icon: I.shieldCheck, title: 'Privacy & data', onTap: () => push(context, const PrivacyDataScreen())),
          RowTile(
            icon: I.ban,
            title: 'Blocked reporters',
            subtitle: app.blocks.isEmpty ? 'None' : '${app.blocks.length} hidden',
            onTap: () => push(context, const BlockedScreen()),
          ),
          RowTile(icon: I.circleHelp, title: 'Help & support', onTap: () => push(context, const HelpScreen())),
          RowTile(icon: I.fileText, title: 'Legal', onTap: () => push(context, const HelpScreen(legalFirst: true))),
          if (app.signedIn) ...[
            RowTile(
              icon: I.logOut,
              title: 'Sign out',
              chevron: false,
              onTap: () async {
                final shell = Shell.of(context);
                await app.signOut();
                shell?.setTab(0);
                if (context.mounted) toast(context, 'Signed out · still listening for cameras');
              },
            ),
            RowTile(icon: I.trash2, title: 'Delete account', onTap: () => push(context, const DeleteAccountScreen())),
          ],
        ]),
      ),
    ]);
  }

  Future<void> _editName(BuildContext context) async {
    final app = App.read(context);
    final ctrl = TextEditingController(text: app.displayName);
    final v = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: const RoundedRectangleBorder(),
        backgroundColor: C.bg,
        title: Text('DISPLAY NAME', style: T.heading(22)),
        content: TextField(controller: ctrl, autofocus: true, textCapitalization: TextCapitalization.words),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Save')),
        ],
      ),
    );
    if (v != null && v.trim().isNotEmpty) {
      try {
        await app.rename(v.trim());
      } catch (_) {
        if (context.mounted) toast(context, 'Couldn\'t save your name. Try again.');
      }
    }
  }
}
