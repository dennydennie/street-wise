import 'package:flutter/material.dart';

/// Industry design-system tokens (from `_ds/industry-…/styles.css`).
/// Paper ground for everyday screens; deep steel (`accent900`) for drive screens.
abstract final class C {
  static const bg = Color(0xFFF2F2F3);
  static const surface = Color(0xFFE9E9EA);
  static const text = Color(0xFF1D1F20);
  static const accent = Color(0xFF5980A6);
  static const divider = Color(0x291D1F20); // text @ 16%

  static const n100 = Color(0xFFF5F5F8);
  static const n200 = Color(0xFFE7E7EA);
  static const n300 = Color(0xFFD4D4D7);
  static const n400 = Color(0xFFB7B7BA);
  static const n500 = Color(0xFF98989B);
  static const n600 = Color(0xFF7A7A7D);
  static const n700 = Color(0xFF5D5D60);
  static const n800 = Color(0xFF424244);
  static const n900 = Color(0xFF2B2B2D);

  static const a100 = Color(0xFFEEF6FF);
  static const a200 = Color(0xFFD6EBFF);
  static const a300 = Color(0xFFB5D9FD);
  static const a400 = Color(0xFF94BCE3);
  static const a500 = Color(0xFF749DC4);
  static const a600 = Color(0xFF597EA3);
  static const a700 = Color(0xFF416180);
  static const a800 = Color(0xFF2C455D);
  static const a900 = Color(0xFF1D2D3D);

  /// Drive-screen palette (steel ground, paper type).
  static const dBg = a900;
  static const dText = Color(0xFFF2F2F3);
  static const dMuted = Color(0xFFB7C3CF);
  static const dLine = Color(0x33F2F2F3);
}

abstract final class T {
  static TextStyle heading(double size, {Color? color, double height = 1.05}) =>
      TextStyle(
        fontFamily: 'Barlow Condensed',
        fontSize: size,
        fontWeight: FontWeight.w600,
        height: height,
        letterSpacing: -0.2,
        color: color ?? C.text,
      );

  /// Uppercase display headings ("MOUNT YOUR PHONE…").
  static TextStyle display(double size, {Color? color}) =>
      heading(size, color: color, height: 1.0);

  static TextStyle body(double size,
          {Color? color, FontWeight weight = FontWeight.w400, double height = 1.4}) =>
      TextStyle(fontFamily: 'Barlow', fontSize: size, fontWeight: weight, height: height, color: color ?? C.text);

  /// Small uppercase kicker ("BACKGROUND LOCATION", "PASSKEYS").
  static TextStyle kicker({Color? color}) => TextStyle(
        fontFamily: 'Barlow',
        fontSize: 10.5,
        fontWeight: FontWeight.w500,
        letterSpacing: 1.1,
        color: color ?? C.a700,
      );
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    fontFamily: 'Barlow',
    scaffoldBackgroundColor: C.bg,
    colorScheme: ColorScheme.fromSeed(
      seedColor: C.accent,
      primary: C.accent,
      surface: C.bg,
      onSurface: C.text,
    ),
    splashFactory: InkRipple.splashFactory,
    dividerColor: C.divider,
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(fontFamily: 'Barlow', bodyColor: C.text, displayColor: C.text),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: C.a900,
      contentTextStyle: T.body(13, color: C.dText),
      shape: const RoundedRectangleBorder(),
    ),
  );
}
