import 'package:flutter_test/flutter_test.dart';
import 'package:streetwise_zw/data/app_state.dart';

void main() {
  group('AppState', () {
    test('extending a pass stacks onto the current end date', () {
      final app = AppState()..plusUntil = DateTime.now().add(const Duration(days: 6));
      final before = app.plusUntil!;
      app.activatePass(passes[0], 'EcoCash');
      expect(app.plusUntil, before.add(const Duration(days: 1)));
      expect(app.payments.first.amount, 0.50);
    });

    test('anonymous listeners have no pass until they sign in', () {
      final app = AppState();
      expect(app.plusActive, isFalse);
      app.signIn();
      expect(app.plusActive, isTrue);
      expect(app.payments, hasLength(3));
    });

    test('a fresh pass starts now', () {
      final app = AppState()..plusUntil = null;
      app.activatePass(passes[1], 'EcoCash');
      expect(app.plusDaysLeft, inInclusiveRange(6, 7));
    });

    test('deleting the account wipes personal data', () {
      final app = AppState()..signIn();
      app.deleteAccount();
      expect(app.signedIn, isFalse);
      expect(app.myReports, isEmpty);
      expect(app.payments, isEmpty);
      expect(app.postedCount, 0);
    });

    test('finishing a pin posts it', () {
      final app = AppState();
      app.dropPin('Pothole');
      final pin = app.pinsToFinish.first;
      final before = app.postedCount;
      app.finishPin(pin);
      expect(app.pinsToFinish, isEmpty);
      expect(app.myReports.first.title, 'Pothole');
      expect(app.postedCount, before + 1);
    });
  });
}
