import 'package:streetwise_zw/core/api/api_client.dart';
import 'package:streetwise_zw/data/models.dart';

/// Every StreetWise API endpoint the app uses, typed. One method per route.
class StreetWiseApi {
  StreetWiseApi(this.client);
  final ApiClient client;

  Json _m(Object? v) => (v as Map).cast<String, dynamic>();
  List<Json> _l(Object? v) => (v as List).whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();

  // ── Public ──
  Future<PublicConfig> config() async => PublicConfig.fromJson(_m(await client.get('/config/public')));

  Future<List<Camera>> cameras({DateTime? since}) async {
    final r = _m(await client.get('/cameras', query: {'since': since?.toUtc().toIso8601String()}));
    return _l(r['cameras']).map(Camera.fromJson).toList();
  }

  Future<List<PassOption>> passCatalogue() async {
    final r = await client.get('/passes/catalogue');
    final list = r is Map ? r['passes'] ?? r['items'] : r;
    return _l(list).map(PassOption.fromJson).toList();
  }

  Future<Briefing> briefings({required double lat, required double lng, int radiusM = 2000, DateTime? at, int limit = 10}) async =>
      Briefing.fromJson(_m(await client.get('/briefings', query: {
        'lat': lat,
        'lng': lng,
        'radiusM': radiusM,
        'limit': limit,
        if (at != null) 'at': at.toUtc().toIso8601String(),
      })));

  Future<AreaBriefing> area(String id, {DateTime? at}) async =>
      AreaBriefing.fromJson(_m(await client.get('/areas/$id', query: {if (at != null) 'at': at.toUtc().toIso8601String()})));

  /// Live reports inside `minLng,minLat,maxLng,maxLat`.
  Future<List<Report>> reportsInBox(double minLng, double minLat, double maxLng, double maxLat) async =>
      _l(await client.get('/reports', query: {'bbox': '$minLng,$minLat,$maxLng,$maxLat'})).map(Report.fromJson).toList();

  // ── Auth ──
  Future<OtpRequestResult> requestOtp(String phone) async =>
      OtpRequestResult.fromJson(_m(await client.post('/auth/otp/request', {'phone': phone})));

  Future<AuthResult> verifyOtp(String phone, String code, {String? deviceLabel}) async => AuthResult.fromJson(
      _m(await client.post('/auth/otp/verify', {'phone': phone, 'code': code, 'deviceLabel': ?deviceLabel})));

  Future<(String challengeId, Json options)> passkeyRegistrationOptions({String? label}) async {
    final r = _m(await client.post('/auth/passkeys/registration/options', {'label': ?label}));
    return ('${r['challengeId']}', _m(r['options']));
  }

  Future<PasskeyInfo> passkeyRegistrationVerify(String challengeId, Json response, {String? label}) async =>
      PasskeyInfo.fromJson(_m(await client.post('/auth/passkeys/registration/verify',
          {'challengeId': challengeId, 'response': response, 'label': ?label})));

  Future<(String challengeId, Json options)> passkeyAuthenticationOptions({String? phone}) async {
    final r = _m(await client.post('/auth/passkeys/authentication/options', {'phone': ?phone}));
    return ('${r['challengeId']}', _m(r['options']));
  }

  Future<AuthResult> passkeyAuthenticationVerify(String challengeId, Json response, {String? deviceLabel}) async =>
      AuthResult.fromJson(_m(await client.post('/auth/passkeys/authentication/verify',
          {'challengeId': challengeId, 'response': response, 'deviceLabel': ?deviceLabel})));

  // ── Me ──
  Future<UserProfile> me() async => UserProfile.fromJson(_m(await client.get('/me')));

  Future<UserProfile> updateMe({String? displayName, DateTime? agreedToRulesAt}) async => UserProfile.fromJson(_m(await client.patch('/me', {
        'displayName': ?displayName,
        if (agreedToRulesAt != null) 'agreedToRulesAt': agreedToRulesAt.toUtc().toIso8601String(),
      })));

  Future<void> deleteMe() => client.delete('/me');
  Future<Object?> exportMe() => client.get('/me/export');

  Future<List<SessionInfo>> sessions() async => _l(await client.get('/me/sessions')).map(SessionInfo.fromJson).toList();
  Future<void> signOutOtherDevices() => client.post('/me/sessions/sign-out-others');
  Future<void> revokeSession(String id) => client.delete('/me/sessions/$id');

  Future<List<PasskeyInfo>> passkeys() async => _l(await client.get('/me/passkeys')).map(PasskeyInfo.fromJson).toList();
  Future<void> deletePasskey(String id) => client.delete('/me/passkeys/$id');

  // ── Reports ──
  Future<ReportAnalysis> analyze(String transcript) async =>
      ReportAnalysis.fromJson(_m(await client.post('/reports/analyze', {'transcript': transcript})));

  Future<Report> createReport({
    ReportType? type,
    required double lat,
    required double lng,
    String? note,
    String? transcript,
    int? heading,
    DateTime? capturedAt,
    bool draft = false,
  }) async =>
      Report.fromJson(_m(await client.post('/reports', {
        if (type != null) 'type': type.wire,
        'lat': lat,
        'lng': lng,
        if (note != null && note.isNotEmpty) 'note': note,
        if (transcript != null && transcript.isNotEmpty) 'transcript': transcript,
        'heading': ?heading,
        if (capturedAt != null) 'capturedAt': capturedAt.toUtc().toIso8601String(),
        if (draft) 'draft': true,
      })));

  Future<Report> updateReport(String id, {ReportType? type, String? note, bool? publish}) async => Report.fromJson(_m(await client.patch('/reports/$id', {
        if (type != null) 'type': type.wire,
        'note': ?note,
        'publish': ?publish,
      })));

  Future<void> deleteReport(String id) => client.delete('/reports/$id');
  Future<Report> vote(String id, {required bool stillThere}) async =>
      Report.fromJson(_m(await client.post('/reports/$id/votes', {'vote': stillThere ? 'still_there' : 'gone'})));
  Future<void> flag(String id, {required String reason, bool blockReporter = false}) =>
      client.post('/reports/$id/flags', {'reason': reason, 'blockReporter': blockReporter});

  Future<List<Report>> myReports() async => _l(await client.get('/me/reports')).map(Report.fromJson).toList();
  Future<int> eraseMyReports() async => (_m(await client.delete('/me/reports'))['deleted'] as num?)?.toInt() ?? 0;

  Future<List<BlockInfo>> blocks() async => _l(await client.get('/me/blocks')).map(BlockInfo.fromJson).toList();
  Future<void> unblock(String id) => client.delete('/me/blocks/$id');

  // ── Transcription (server fallback) ──
  Future<String> transcribe(List<int> audio, {required String filename, String? language}) async {
    final r = _m(await client.upload('/transcriptions',
        field: 'audio', bytes: audio, filename: filename, fields: {'language': ?language}));
    return '${r['text'] ?? ''}';
  }

  // ── Passes & payments ──
  Future<MyPass> myPass() async => MyPass.fromJson(_m(await client.get('/me/pass')));
  Future<List<Payment>> myPayments() async => _l(await client.get('/me/payments')).map(Payment.fromJson).toList();

  Future<Payment> createPayment({required String passId, required String method, String? phone}) async => Payment.fromJson(
      _m(await client.post('/payments', {'passId': passId, 'method': method, 'phone': ?phone})));

  Future<Payment> payment(String reference) async => Payment.fromJson(_m(await client.get('/payments/$reference')));
}
