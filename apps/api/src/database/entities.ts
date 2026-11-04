import { Area } from '../modules/areas/entities/area.entity';
import { OtpChallenge } from '../modules/auth/entities/otp-challenge.entity';
import { Passkey } from '../modules/auth/entities/passkey.entity';
import { Session } from '../modules/auth/entities/session.entity';
import { WebauthnChallenge } from '../modules/auth/entities/webauthn-challenge.entity';
import { Camera } from '../modules/cameras/entities/camera.entity';
import { UserPass } from '../modules/passes/entities/user-pass.entity';
import { Payment } from '../modules/payments/entities/payment.entity';
import { ModerationLogEntry } from '../modules/reports/entities/moderation-log.entity';
import { ReportFlag } from '../modules/reports/entities/report-flag.entity';
import { ReportVote } from '../modules/reports/entities/report-vote.entity';
import { Report } from '../modules/reports/entities/report.entity';
import { UserBlock } from '../modules/reports/entities/user-block.entity';
import { User } from '../modules/users/entities/user.entity';

/** The one entity registry used by the Nest app, the CLI data source and the seed script. */
export const entities = [
  User,
  OtpChallenge,
  Session,
  Passkey,
  WebauthnChallenge,
  Camera,
  Area,
  Report,
  ReportVote,
  ReportFlag,
  UserBlock,
  ModerationLogEntry,
  UserPass,
  Payment,
];
