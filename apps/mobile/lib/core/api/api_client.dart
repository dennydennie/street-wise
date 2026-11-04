import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// An error the API returned (or a network failure, with [status] 0).
class ApiException implements Exception {
  ApiException(this.status, this.message, {this.body});

  final int status;
  final String message;
  final Object? body;

  bool get isNetwork => status == 0;
  bool get isUnauthorized => status == 401;

  @override
  String toString() => 'ApiException($status): $message';

  /// A sentence fit for a toast.
  String get friendly => switch (status) {
        0 => 'No connection. Check your data and try again.',
        401 => 'Please sign in again.',
        429 => message.isNotEmpty ? message : 'Too many tries. Wait a moment.',
        >= 500 => 'StreetWise is having trouble. Try again shortly.',
        _ => message,
      };
}

/// Thin JSON-over-HTTP client with bearer auth, timeouts and uniform errors.
class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client, this.timeout = const Duration(seconds: 15)})
      : _http = client ?? http.Client();

  final String baseUrl;
  final Duration timeout;
  final http.Client _http;

  String? token;

  /// Called when an authenticated request comes back 401 (session revoked or expired).
  void Function()? onUnauthorized;

  Uri uri(String path, [Map<String, Object?>? query]) {
    final q = <String, String>{
      for (final e in (query ?? const {}).entries)
        if (e.value != null) e.key: '${e.value}',
    };
    return Uri.parse('$baseUrl$path').replace(queryParameters: q.isEmpty ? null : q);
  }

  Map<String, String> get _headers => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> get(String path, {Map<String, Object?>? query}) =>
      _send(() => _http.get(uri(path, query), headers: _headers));

  Future<dynamic> post(String path, [Object? body]) =>
      _send(() => _http.post(uri(path), headers: _headers, body: body == null ? null : jsonEncode(body)));

  Future<dynamic> patch(String path, [Object? body]) =>
      _send(() => _http.patch(uri(path), headers: _headers, body: body == null ? null : jsonEncode(body)));

  Future<dynamic> delete(String path) => _send(() => _http.delete(uri(path), headers: _headers));

  /// Multipart upload (server transcription).
  Future<dynamic> upload(String path, {required String field, required List<int> bytes, required String filename, Map<String, String>? fields}) {
    return _send(() async {
      final req = http.MultipartRequest('POST', uri(path))
        ..headers.addAll({'Accept': 'application/json', if (token != null) 'Authorization': 'Bearer $token'})
        ..fields.addAll(fields ?? const {})
        ..files.add(http.MultipartFile.fromBytes(field, bytes, filename: filename));
      return http.Response.fromStream(await _http.send(req));
    });
  }

  Future<dynamic> _send(Future<http.Response> Function() call) async {
    final hadToken = token != null;
    http.Response res;
    try {
      res = await call().timeout(timeout);
    } on TimeoutException {
      throw ApiException(0, 'Request timed out');
    } catch (e) {
      throw ApiException(0, 'Network error: $e');
    }

    final text = res.body;
    Object? body;
    if (text.isNotEmpty) {
      try {
        body = jsonDecode(text);
      } on FormatException {
        body = text;
      }
    }

    if (res.statusCode >= 200 && res.statusCode < 300) return body;

    if (res.statusCode == 401 && hadToken) onUnauthorized?.call();
    throw ApiException(res.statusCode, _message(body) ?? 'Request failed (${res.statusCode})', body: body);
  }

  static String? _message(Object? body) {
    if (body is Map) {
      final m = body['message'];
      if (m is String) return m;
      if (m is List && m.isNotEmpty) return m.map((e) => '$e').join('. ');
      final err = body['error'];
      if (err is String) return err;
    }
    if (body is String && body.length < 200) return body;
    return null;
  }
}
