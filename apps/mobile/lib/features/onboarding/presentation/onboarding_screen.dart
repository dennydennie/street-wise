import 'package:flutter/material.dart';

import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/app/shell.dart';

/// 01 Onboarding · safety first. Three steps:
/// 1 voice-first intro, 2 background-location prominent disclosure, 3 OEM battery allow-listing.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  int step = 0;

  void _next() {
    if (step < 2) {
      setState(() => step++);
    } else {
      App.read(context).finishOnboarding();
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const Shell()), (_) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final (title, kicker, body, cta, skip) = switch (step) {
      0 => (
          'ALERTS YOU HEAR, NOT READ.',
          'Voice first',
          'StreetWise speaks camera and hazard alerts through your car audio. You never need to look at the screen.',
          'Next',
          null,
        ),
      1 => (
          'MOUNT YOUR PHONE. KEEP YOUR HANDS ON THE WHEEL.',
          'Background location',
          'Drive mode only. Trips stay on this phone.',
          'Allow location while driving',
          'Not now',
        ),
      _ => (
          'KEEP STREETWISE RUNNING.',
          'Battery settings',
          'Tecno, Itel and Samsung phones close apps in the background. Allow StreetWise so alerts keep playing with the screen off.',
          'Open battery settings',
          'Later',
        ),
    };

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              for (var i = 0; i < 3; i++) ...[
                Expanded(child: Container(height: 2, color: i <= step ? C.accent : C.n300)),
                if (i < 2) const SizedBox(width: 6),
              ],
            ]),
            const SizedBox(height: 14),
            Text('STEP ${step + 1} OF 3', style: T.kicker()),
            const SizedBox(height: 14),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: Text(title, key: ValueKey(step), style: T.display(38)),
            ),
            const Spacer(),
            Blueprint(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(kicker.toUpperCase(), style: T.kicker()),
                const SizedBox(height: 6),
                Text(body, style: T.body(13, color: C.n800)),
                if (step == 1 && !app.signedIn) ...[
                  const SizedBox(height: 6),
                  Text('Used to time alerts to your speed and distance. Never shared.', style: T.body(12, color: C.n700)),
                ],
              ]),
            ),
            const SizedBox(height: 14),
            Btn(cta, onTap: () {
              if (step == 1) {
                app.locationAlways = true;
                app.touch();
                app.locate(request: true); // OS permission prompt, after the prominent disclosure
              }
              _next();
            }),
            const SizedBox(height: 8),
            if (skip != null)
              Btn.ghost(skip, onTap: () {
                if (step == 1) app.locationAlways = false;
                _next();
              })
            else
              const SizedBox(height: 40),
          ]),
        ),
      ),
    );
  }
}
