import type { DataSource } from 'typeorm';
import { haversineMeters } from '../geo/haversine';
import type { ReverseGeocoder } from '../geo/reverse-geocoder';
import { AreasService } from './areas.service';
import { Area } from './entities/area.entity';

const SEKE = { id: 'area-seke', name: 'Seke Rd × Cripps Rd', lat: -17.8447, lng: 31.0342 } as Area;
/** ~111 m per 0.001° of latitude. */
const north = (metres: number) => ({ lat: SEKE.lat + metres / 111_195, lng: SEKE.lng });

const setup = (options: { geocoded?: string | null; cameras?: { name: string; lat: number; lng: number }[] } = {}) => {
  const stored: Area[] = [SEKE];
  const areaRepo = {
    // The Between() box prefilter is the database's job; return everything and let the service measure.
    find: jest.fn(async () => stored),
    create: jest.fn((value: Partial<Area>) => value),
    save: jest.fn(async (value: Area) => {
      const saved = { ...value, id: `area-${stored.length + 1}` } as Area;
      stored.push(saved);
      return saved;
    }),
  };
  const cameraRepo = { find: jest.fn(async () => options.cameras ?? []) };
  const manager = {
    getRepository: jest.fn((entity: unknown) => (entity === Area ? areaRepo : cameraRepo)),
    query: jest.fn(async () => []),
  };
  const dataSource = { manager, transaction: jest.fn(async (work: (m: unknown) => unknown) => work(manager)) };
  const geocoder: ReverseGeocoder = { nameFor: jest.fn(async () => options.geocoded ?? null) };
  return { service: new AreasService(dataSource as unknown as DataSource, geocoder), areaRepo, manager };
};

describe('AreasService.assign', () => {
  it('joins the existing area within 200 m', async () => {
    const { service, areaRepo } = setup();
    const point = north(150);
    expect(haversineMeters(point, SEKE)).toBeLessThan(200);
    expect((await service.assign(point)).id).toBe('area-seke');
    expect(areaRepo.save).not.toHaveBeenCalled();
  });

  it('creates a new area beyond 200 m, under the creation lock', async () => {
    const { service, areaRepo, manager } = setup();
    const area = await service.assign(north(260));
    expect(area.id).not.toBe('area-seke');
    expect(areaRepo.save).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1)', [expect.any(Number)]);
  });

  it('names a new area after the reverse geocoder first', async () => {
    const { service } = setup({ geocoded: 'Simon Mazorodze Rd', cameras: [{ name: 'Camera X', ...north(500) }] });
    expect((await service.assign(north(500))).name).toBe('Simon Mazorodze Rd');
  });

  it('falls back to the nearest camera within 300 m, then to coordinates', async () => {
    const camera = { name: 'Samora Machel × Julius Nyerere', ...north(520) };
    expect((await setup({ cameras: [camera] }).service.assign(north(500))).name).toBe('Samora Machel × Julius Nyerere');

    const far = { name: 'Far camera', ...north(1500) };
    const point = north(500);
    expect((await setup({ cameras: [far] }).service.assign(point)).name).toBe(`Near ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);
  });
});
