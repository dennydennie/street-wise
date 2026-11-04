import { redactText, toPublicSummary } from './redact';
import { analyzeWithRules } from './rule-based-report-analyzer';

describe('RuleBasedReportAnalyzer classification', () => {
  it.each([
    ['robot not working at Seke and Cripps', 'robot_out'],
    ['traffic lights off at Samora Machel', 'robot_out'],
    ['marobhoti haashande paJulius Nyerere', 'robot_out'],
    ['smash and grab at the lights', 'crime_hotspot'],
    ['mbavha dziriparobhoti', 'crime_hotspot'],
    ['phone snatched at the robot', 'crime_hotspot'],
    ['there is a big pothole on Rotten Row', 'pothole'],
    ['gomba guru pano', 'pothole'],
    ['imigodi eminengi emgwaqweni', 'pothole'],
    ['kombi stopping in the middle of the road', 'kombi_stop'],
    ['mushikashika vakamira munzira', 'kombi_stop'],
    ['ZUPCO stopping at the corner', 'kombi_stop'],
    ['water on the road at Mbare', 'flooding'],
    ['mvura yakawanda munzira', 'flooding'],
    ['speed trap after the bridge', 'camera'],
    ['police roadblock on Seke Road', 'camera'],
  ])('%s → %s', (transcript, type) => {
    expect(analyzeWithRules(transcript).type).toBe(type);
  });

  it('returns no type with zero confidence for unrelated speech', () => {
    const analysis = analyzeWithRules('hello how are you today');
    expect(analysis.type).toBeNull();
    expect(analysis.confidence).toBe(0);
  });

  it('tags a roadblock and a smash-and-grab', () => {
    expect(analyzeWithRules('police roadblock ahead').tags).toContain('roadblock');
    expect(analyzeWithRules('smash and grab at the lights at night').tags).toEqual(expect.arrayContaining(['smash_and_grab', 'night']));
  });

  it('raises severity for intensifiers and weapons, capped at 5', () => {
    expect(analyzeWithRules('pothole').severity).toBe(2);
    expect(analyzeWithRules('big deep pothole').severity).toBe(4);
    expect(analyzeWithRules('robbery with a gun and a knife, very dangerous').severity).toBe(5);
  });

  it('prefers the clearer phrase when two types are mentioned', () => {
    expect(analyzeWithRules('robot not working, kombi waiting').type).toBe('robot_out');
  });
});

describe('summary redaction', () => {
  it('removes Zimbabwe number plates', () => {
    expect(redactText('AEB 1234 hit the robot').text).toBe('[plate] hit the robot');
    expect(redactText('the car ABC-1234 was robbed').text).toBe('the car [plate] was robbed');
    expect(redactText('plate abc1234').text).toBe('plate [plate]');
  });

  it('does not treat ordinary words before a year as a plate', () => {
    expect(redactText('the 2024 floods were bad').redacted).toBe(false);
  });

  it('removes phone numbers', () => {
    expect(redactText('call 0771234567 for help').text).toBe('call [number] for help');
    expect(redactText('call +263 77 123 4567').text).toBe('call [number]');
  });

  it('removes honorific + name', () => {
    expect(redactText('Mr Moyo was robbed at the lights').text).toBe('[person] was robbed at the lights');
    expect(redactText('mrs. Chipo Dube saw it').text).toBe('[person] saw it');
    expect(redactText('Mai Rudo akabirwa').text).toBe('[person] akabirwa');
  });

  it('marks the analysis as redacted and keeps the place', () => {
    const analysis = analyzeWithRules('smash and grab, Mr Moyo in AEB 1234, call 0771234567, Seke and Cripps');
    expect(analysis.redacted).toBe(true);
    expect(analysis.summary).toBe('Smash and grab, [person] in [plate], call [number], Seke and Cripps');
  });

  it('clips long summaries to 160 characters', () => {
    const { summary } = toPublicSummary('pothole '.repeat(60));
    expect(summary.length).toBeLessThanOrEqual(160);
    expect(summary.endsWith('…')).toBe(true);
  });
});
