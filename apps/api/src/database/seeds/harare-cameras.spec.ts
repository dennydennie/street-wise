import { HARARE_CBD_CAMERAS } from './harare-cameras';

describe('Harare CBD camera seed', () => {
  it('has ~20 uniquely identified cameras inside the CBD', () => {
    expect(HARARE_CBD_CAMERAS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(HARARE_CBD_CAMERAS.map((c) => c.id)).size).toBe(HARARE_CBD_CAMERAS.length);
    for (const camera of HARARE_CBD_CAMERAS) {
      expect(camera.lat).toBeGreaterThan(-17.85);
      expect(camera.lat).toBeLessThan(-17.81);
      expect(camera.lng).toBeGreaterThan(31.03);
      expect(camera.lng).toBeLessThan(31.07);
    }
  });
});
