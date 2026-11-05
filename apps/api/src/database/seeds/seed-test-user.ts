import dataSource from '../../data-source';
import { User } from '../../modules/users/entities/user.entity';

/**
 * Creates (or refreshes) the tester account named by TEST_ACCOUNT_PHONE
 * (`pnpm db:seed:test-user`, also run on deploy when the variable is set).
 * It signs in with TEST_ACCOUNT_CODE and never gets an SMS. It starts on the
 * free tier with the community rules accepted, so a tester can report at once
 * and try buying Plus.
 */
const run = async (): Promise<void> => {
  const phone = process.env.TEST_ACCOUNT_PHONE;
  if (!phone) {
    console.log('TEST_ACCOUNT_PHONE is not set; no test user to seed');
    return;
  }
  await dataSource.initialize();
  try {
    const users = dataSource.getRepository(User);
    const existing = await users.findOne({ where: { phone } });
    if (existing) {
      await users.update({ id: existing.id }, { phoneSignInEnabled: true, agreedToRulesAt: existing.agreedToRulesAt ?? new Date() });
      console.log(`Test user ${phone} already exists; phone sign-in kept on`);
    } else {
      await users.save(users.create({ phone, displayName: 'Test driver', agreedToRulesAt: new Date() }));
      console.log(`Seeded test user ${phone}`);
    }
  } finally {
    await dataSource.destroy();
  }
};

run().catch((error) => {
  console.error('Test user seed failed', error);
  process.exit(1);
});
