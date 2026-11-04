import 'package:passkeys/authenticator.dart';
import 'package:passkeys/types.dart';

/// Bridges the API's WebAuthn JSON to the platform authenticator
/// (Android Credential Manager / browser WebAuthn). The OS draws the sheet.
class PasskeyService {
  final _auth = PasskeyAuthenticator();

  /// navigator.credentials.create() with the server's creation options; returns RegistrationResponseJSON.
  Future<Map<String, dynamic>> create(Map<String, dynamic> options) async {
    final res = await _auth.register(RegisterRequestType.fromJson(options));
    return res.toJson();
  }

  /// navigator.credentials.get() with the server's request options; returns AuthenticationResponseJSON.
  Future<Map<String, dynamic>> get(Map<String, dynamic> options) async {
    final res = await _auth.authenticate(AuthenticateRequestType.fromJson(options));
    return res.toJson();
  }
}

/// True when the user dismissed the OS sheet (not an error worth showing).
bool isPasskeyCancel(Object e) {
  final s = '$e'.toLowerCase();
  return s.contains('cancel') || s.contains('notallowed') || s.contains('abort');
}
