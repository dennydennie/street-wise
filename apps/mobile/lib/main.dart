import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:streetwise_zw/features/auth/presentation/auth_screens.dart';
import 'package:streetwise_zw/app/shell.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(StreetWiseApp(state: AppState()));
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
        home: Builder(builder: (context) => App.read(context).onboarded ? const Shell() : const WelcomeScreen()),
      ),
    );
  }
}
