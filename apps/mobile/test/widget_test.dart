import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:streetwise_zw/core/api/api_client.dart';
import 'package:streetwise_zw/core/services/location_service.dart';
import 'package:streetwise_zw/core/storage/local_store.dart';
import 'package:streetwise_zw/data/api/streetwise_api.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/drive/presentation/drive_screens.dart';

/// A tiny in-memory stand-in for the StreetWise API.
class FakeApi {
  final requests = <http.Request>[];
  String? token;
  final reports = <Map<String, dynamic>>[];
  bool rejectToken = false;

  static const user = {
    'id': '00000000-0000-0000-0000-000000000001',
    'phone': '+263771234821',
    'displayName': 'Tendai M.',
    'agreedToRulesAt': '2026-11-04T07:42:00Z',
    'createdAt': '2026-11-04T07:40:00Z',
  };

  http.Response _json(Object body, [int status = 200]) =>
      http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

  Future<http.Response> handle(http.Request r) async {
    requests.add(r);
    final path = r.url.path;
    final authed = r.headers['Authorization'] == 'Bearer tok-1' && !rejectToken;
    final body = r.body.isEmpty ? <String, dynamic>{} : jsonDecode(r.body) as Map<String, dynamic>;

    if (path == '/auth/otp/request') return _json({'expiresInSeconds': 300, 'resendAfterSeconds': 60, 'devCode': '482193'}, 202);
    if (path == '/auth/otp/verify') {
      if (body['code'] != '482193') return _json({'message': 'Wrong code'}, 400);
      return _json({'accessToken': 'tok-1', 'tokenType': 'Bearer', 'expiresInSeconds': 2592000, 'isNewUser': false, 'user': user});
    }
    if (path.startsWith('/me') || (path == '/reports' && r.method == 'POST')) {
      if (!authed) return _json({'message': 'Unauthorized'}, 401);
    }
    switch ((r.method, path)) {
      case ('GET', '/me'):
        return _json(user);
      case ('GET', '/me/pass'):
        return _json({'active': true, 'passId': 'week', 'endsAt': DateTime.now().add(const Duration(days: 6)).toUtc().toIso8601String()});
      case ('GET', '/me/payments'):
        return _json([
          {'reference': 'SWZ-7Q4K2M', 'passId': 'week', 'method': 'ecocash', 'status': 'paid', 'amountCents': 150, 'currency': 'USD', 'createdAt': '2026-11-04T18:51:00Z'}
        ]);
      case ('GET', '/me/reports'):
        return _json(reports);
      case ('GET', '/me/passkeys'):
      case ('GET', '/me/blocks'):
        return _json([]);
      case ('POST', '/reports'):
        final rep = {
          'id': '00000000-0000-0000-0000-00000000000${reports.length + 2}',
          'type': body['type'] ?? 'pothole',
          'lat': body['lat'],
          'lng': body['lng'],
          'status': body['draft'] == true ? 'draft' : 'live',
          'stillThereCount': 0,
          'goneCount': 0,
          'createdAt': DateTime.now().toUtc().toIso8601String(),
          'isMine': true,
          'transcript': body['transcript'],
          'locationName': 'Seke × Cripps',
        };
        reports.add(rep);
        return _json(rep, 201);
      case ('GET', '/briefings'):
        return _json(briefingJson);
      case ('POST', '/support/messages'):
        return _json({'status': 'received'}, 202);
    }
    return _json({'message': 'Not found'}, 404);
  }

  static final briefingJson = {
    'generatedAt': '2026-11-04T20:00:00Z',
    'at': '2026-11-04T20:00:00Z',
    'timeBand': 'night',
    'areas': [
      {
        'areaId': 'a1',
        'name': 'Seke × Cripps',
        'lat': -17.8445,
        'lng': 31.0335,
        'distanceM': 420.5,
        'priority': 'high',
        'score': 18.2,
        'alert': true,
        'headline': "Crime hotspot — don't stop at the robot",
        'advice': '4 smash-and-grabs reported, mostly 19:00–23:00. Windows up, doors locked.',
        'items': [
          {
            'type': 'crime_hotspot',
            'label': 'Crime hotspot',
            'liveCount': 0,
            'reportsLast90d': 4,
            'confirmations': 6,
            'latestAt': '2026-11-02T21:10:00Z',
            'peakBand': 'night',
            'peakHours': '19:00–23:00',
            'shareInCurrentBand': 0.8,
            'relevantNow': true,
            'summary': 'Smash-and-grab at the lights'
          },
          {
            'type': 'pothole',
            'label': 'Pothole',
            'liveCount': 1,
            'reportsLast90d': 2,
            'confirmations': 1,
            'latestAt': null,
            'peakBand': 'midday',
            'shareInCurrentBand': 0.1,
            'relevantNow': false,
            'summary': ''
          }
        ],
        'hourly': List.generate(24, (h) => h >= 19 && h <= 23 ? 3 : 0),
      }
    ],
  };
}

Future<(AppState, FakeApi)> makeState() async {
  SharedPreferences.setMockInitialValues({});
  final fake = FakeApi();
  final client = ApiClient(baseUrl: 'http://api.test', client: MockClient(fake.handle));
  final state = AppState(api: StreetWiseApi(client), store: await LocalStore.open());
  return (state, fake);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('models', () {
    test('briefing parses priority, relevance and hourly prevalence', () {
      final b = Briefing.fromJson(FakeApi.briefingJson);
      final a = b.areas.single;
      expect(b.timeBand, 'night');
      expect(a.priority, Priority.high);
      expect(a.alert, isTrue);
      expect(a.relevant.single.type, ReportType.crimeHotspot);
      expect(a.notNow.single.type, ReportType.pothole);
      expect(a.lead!.peakHours, '19:00–23:00');
      expect(a.hourly, hasLength(24));
      expect(a.liveCount, 1);
    });

    test('report parsing tolerates missing optional fields', () {
      final r = Report.fromJson({'id': 'x', 'type': 'robot_out', 'lat': -17.8, 'lng': 31.0});
      expect(r.type, ReportType.robotOut);
      expect(r.status, 'live');
      expect(r.title, 'Robot out');
      expect(r.place, '-17.8000, 31.0000');
    });
  });

  group('AppState against the API', () {
    test('OTP sign-in stores the token and loads the account', () async {
      final (app, fake) = await makeState();
      final otp = await app.requestOtp('+263771234821');
      expect(otp.devCode, '482193');
      await app.verifyOtp('+263771234821', otp.devCode!);
      expect(app.signedIn, isTrue);
      expect(app.client.token, 'tok-1');
      await app.refreshAccount();
      expect(app.plusActive, isTrue);
      expect(app.payments.single.reference, 'SWZ-7Q4K2M');
      expect(app.phoneMasked, '+263 77 ••• 4821');
      expect(fake.requests.any((r) => r.url.path == '/me/pass'), isTrue);
    });

    test('a wrong OTP surfaces the API message', () async {
      final (app, _) = await makeState();
      expect(() => app.verifyOtp('+263771234821', '000000'),
          throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Wrong code')));
    });

    test('anonymous reports stay on the phone, then post as drafts after sign-in', () async {
      final (app, fake) = await makeState();
      final sent = await app.submitReport(type: ReportType.pothole, at: const Fix(-17.84, 31.03), transcript: 'big pothole');
      expect(sent, isFalse);
      expect(app.pendingPins, hasLength(1));
      expect(fake.reports, isEmpty);

      await app.verifyOtp('+263771234821', '482193');
      await app.refreshAccount();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(app.pendingPins, isEmpty);
      expect(fake.reports.single['status'], 'draft');
      expect(fake.reports.single['transcript'], 'big pothole');
    });

    test('signed-in reports go straight to the API with transcript and capture time', () async {
      final (app, fake) = await makeState();
      await app.verifyOtp('+263771234821', '482193');
      final sent = await app.submitReport(type: ReportType.robotOut, at: const Fix(-17.84, 31.03, heading: 92), transcript: 'robot not working');
      expect(sent, isTrue);
      final req = fake.requests.lastWhere((r) => r.url.path == '/reports' && r.method == 'POST');
      final body = jsonDecode(req.body) as Map<String, dynamic>;
      expect(body['type'], 'robot_out');
      expect(body['transcript'], 'robot not working');
      expect(body['heading'], 92);
      expect(body['capturedAt'], isNotNull);
      expect(app.myReports.first.type, ReportType.robotOut);
    });

    test('a revoked session (401) signs the user out locally', () async {
      final (app, fake) = await makeState();
      await app.verifyOtp('+263771234821', '482193');
      fake.rejectToken = true;
      await app.refreshAccount();
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(app.signedIn, isFalse);
      expect(app.client.token, isNull);
    });

    test('extending stacks onto the current end date', () async {
      final (app, _) = await makeState();
      final end = DateTime.now().add(const Duration(days: 6));
      app.pass = MyPass(active: true, passId: 'week', endsAt: end);
      expect(app.passEnd(PassOption.fallback.first), end.add(const Duration(days: 1)));
      app.pass = MyPass();
      expect(app.passEnd(PassOption.fallback[1]).difference(DateTime.now()).inDays, inInclusiveRange(6, 7));
    });

    test('briefings load from the API for the current position', () async {
      final (app, fake) = await makeState();
      await app.refreshBriefing(lat: -17.84, lng: 31.03);
      expect(app.briefing!.areas.single.alert, isTrue);
      final q = fake.requests.last.url.queryParameters;
      expect(q['lat'], '-17.84');
      expect(q['lng'], '31.03');
    });
  });

  group('support', () {
    test('support messages post category, text, optional reply e-mail and location', () async {
      final (app, fake) = await makeState();
      await app.api.supportMessage(category: 'wrong_camera', message: 'Camera at Samora × 4th is gone', replyEmail: 'd@example.com', lat: -17.83, lng: 31.05);
      final body = jsonDecode(fake.requests.last.body) as Map<String, dynamic>;
      expect(fake.requests.last.url.path, '/support/messages');
      expect(body['category'], 'wrong_camera');
      expect(body['replyEmail'], 'd@example.com');
      expect(body['lat'], -17.83);
      await app.api.supportMessage(category: 'bug', message: 'Crashes on start');
      final anon = jsonDecode(fake.requests.last.body) as Map<String, dynamic>;
      expect(anon.containsKey('replyEmail'), isFalse);
      expect(anon.containsKey('lat'), isFalse);
    });
  });

  group('drive helpers', () {
    test('offline keyword fallback understands English and Shona', () {
      expect(guessType('smash and grab at the lights'), ReportType.crimeHotspot);
      expect(guessType('robot not working'), ReportType.robotOut);
      expect(guessType('gomba guru'), ReportType.pothole);
      expect(guessType('mvura yakawanda'), ReportType.flooding);
      expect(guessType('hello'), isNull);
    });

    test('isAhead respects heading', () {
      const east = Fix(-17.83, 31.05, heading: 90);
      expect(isAhead(east, -17.83, 31.06), isTrue);
      expect(isAhead(east, -17.83, 31.04), isFalse);
      expect(formatDistance(640), '640 m');
      expect(formatDistance(1100), '1.1 km');
    });
  });
}
