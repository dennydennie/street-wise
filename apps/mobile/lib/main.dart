import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:streetwise_zw/app/shell.dart';
import 'package:streetwise_zw/core/services/location_service.dart';
import 'package:streetwise_zw/core/services/passkey_service.dart';
import 'package:streetwise_zw/core/services/voice_service.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/brand.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/auth/presentation/auth_screens.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  final state = AppState(location: LocationService(), voice: VoiceService(), passkeyDevice: PasskeyService());
  runApp(StreetWiseApp(state: state));
  state.init();
}

class StreetWiseApp extends StatelessWidget {
  const StreetWiseApp({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return App(
      state: state,
      child: MaterialApp(
        title: 'StreetWise ZW',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: const _Root(),
      ),
    );
  }
}

/// Waits for local state (token, flags, cached cameras), then picks the first screen.
class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    if (!app.ready) {
      return const Scaffold(body: Center(child: Wordmark(size: 26)));
    }
    return app.onboarded ? const Shell() : const WelcomeScreen();
  }
}
