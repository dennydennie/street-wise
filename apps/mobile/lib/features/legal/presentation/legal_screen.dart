import 'package:flutter/material.dart';

import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';

enum LegalDoc { terms, community, privacy, licences, faq, keepRunning }

const _docs = <LegalDoc, (String, String, List<(String, String)>)>{
  LegalDoc.terms: (
    'Terms of use',
    'streetwise.co.zw/terms',
    [
      ('A driving aid, not a guarantee', 'StreetWise ZW gives spoken reminders about cameras and road hazards. You remain responsible for obeying traffic laws and driving safely.'),
      ('Using the app while driving', 'Mount your phone before you set off. Typing is locked above 10 km/h; use voice reports or ask a passenger.'),
      ('Plus passes', 'Passes are bought ad hoc and never renew. Camera alerts stay free for everyone.'),
    ],
  ),
  LegalDoc.community: (
    'Community rules',
    'streetwise.co.zw/rules',
    [
      ('Report places, never people', 'Never post names, faces, phone numbers or number plates. Reports describe a location and what is there.'),
      ('Keep it current', 'Answer "Still there?" honestly. Three "gone" votes from different drivers hide a report.'),
      ('No abuse or spam', 'Abusive, offensive or promotional reports are removed. Repeat offenders lose posting rights.'),
      ('Flag and block', 'Flag any report that breaks these rules. Blocking a reporter hides their reports from you.'),
    ],
  ),
  LegalDoc.privacy: (
    'Privacy policy',
    'streetwise.co.zw/privacy',
    [
      ('On our servers', 'A hashed phone number, your display name, your reports and votes.'),
      ('Only on this phone', 'Trips, GPS history and the cached map. Trips never leave the phone.'),
      ('Location', 'Background location is used only while drive mode is on, to time alerts.'),
      ('Your controls', 'Download your data, erase your reports, or delete your account from Account › Privacy & data.'),
    ],
  ),
  LegalDoc.licences: (
    'Open-source licences',
    '',
    [
      ('Flutter', 'BSD 3-Clause. © The Flutter Authors.'),
      ('Lucide icons', 'ISC License. © Lucide Contributors.'),
      ('Barlow & Barlow Condensed', 'SIL Open Font License 1.1. © Jeremy Tribby.'),
      ('Map data', '© OpenStreetMap contributors, ODbL.'),
    ],
  ),
  LegalDoc.faq: (
    'FAQ',
    '',
    [
      ('Do I need an account?', 'No. Listening to camera alerts needs no sign-up. An account is only needed to post reports.'),
      ('Does it use a lot of data?', 'The camera list syncs once a day and is cached. Turn on Data saver to sync on Wi-Fi only.'),
      ('Why didn\'t I hear an alert?', 'Check that drive mode is on and StreetWise is allowed to run in the background (Help › Keep StreetWise running).'),
      ('How do I stop paying?', 'You don\'t need to. Passes never renew, so there is nothing to cancel.'),
    ],
  ),
  LegalDoc.keepRunning: (
    'Keep StreetWise running',
    '',
    [
      ('Why this matters', 'Some phones close apps in the background to save battery. Alerts then stop when the screen is off.'),
      ('Tecno & Itel', 'Settings › Battery › App launch › StreetWise ZW › Manage manually: allow all three.'),
      ('Samsung', 'Settings › Battery › Background usage limits › Never sleeping apps › add StreetWise ZW.'),
      ('Other phones', 'Settings › Apps › StreetWise ZW › Battery › Unrestricted.'),
    ],
  ),
};

void openLegal(BuildContext context, LegalDoc doc) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => LegalScreen(doc: doc)));

class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key, required this.doc});
  final LegalDoc doc;

  @override
  Widget build(BuildContext context) {
    final (title, url, sections) = _docs[doc]!;
    return SwPage(
      title: title,
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 32), children: [
        if (url.isNotEmpty) Kicker(url),
        for (final (h, b) in sections) ...[
          const SizedBox(height: 14),
          Text(h.toUpperCase(), style: T.heading(18)),
          const SizedBox(height: 4),
          Text(b, style: T.body(14, color: C.n800, height: 1.5)),
        ],
      ]),
    );
  }
}
