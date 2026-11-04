import type { CameraCheck } from '@streetwise/shared';

export type CameraSeed = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  checks: CameraCheck[];
  confidence: number;
};

// Approximate positions on the Harare CBD grid. East-west avenues (north to
// south) and north-south streets (west to east) are placed on a nominal grid,
// so every point needs a site survey before launch; `confidence` says so.
const AVE = {
  samora: -17.8268,
  nelsonMandela: -17.8288,
  jasonMoyo: -17.8301,
  georgeSilundika: -17.8316,
  robertMugabe: -17.8331,
  kennethKaunda: -17.8356,
} as const;
const ST = {
  chinhoyi: 31.0412,
  samNujoma: 31.0449,
  juliusNyerere: 31.0479,
  firstSt: 31.0497,
  secondSt: 31.0513,
  leopoldTakawira: 31.0528,
  fourthSt: 31.0561,
} as const;

const RL: CameraCheck[] = ['red_light', 'stop_line'];
const ALL: CameraCheck[] = ['red_light', 'stop_line', 'phone_use', 'seatbelt'];

const id = (n: number) => `5e0c0000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const HARARE_CBD_CAMERAS: CameraSeed[] = [
  { id: id(1), name: 'Samora Machel × Julius Nyerere', lat: AVE.samora, lng: ST.juliusNyerere, checks: ALL, confidence: 0.8 },
  { id: id(2), name: 'Samora Machel × Leopold Takawira', lat: AVE.samora, lng: ST.leopoldTakawira, checks: ALL, confidence: 0.8 },
  { id: id(3), name: 'Samora Machel × Sam Nujoma', lat: AVE.samora, lng: ST.samNujoma, checks: RL, confidence: 0.75 },
  { id: id(4), name: 'Samora Machel × Chinhoyi', lat: AVE.samora, lng: ST.chinhoyi, checks: RL, confidence: 0.7 },
  { id: id(5), name: 'Samora Machel × Fourth Street', lat: AVE.samora, lng: ST.fourthSt, checks: ALL, confidence: 0.75 },
  { id: id(6), name: 'Nelson Mandela × Julius Nyerere', lat: AVE.nelsonMandela, lng: ST.juliusNyerere, checks: RL, confidence: 0.75 },
  { id: id(7), name: 'Nelson Mandela × Second Street', lat: AVE.nelsonMandela, lng: ST.secondSt, checks: ['red_light', 'stop_line', 'phone_use'], confidence: 0.7 },
  { id: id(8), name: 'Nelson Mandela × Leopold Takawira', lat: AVE.nelsonMandela, lng: ST.leopoldTakawira, checks: RL, confidence: 0.7 },
  { id: id(9), name: 'Jason Moyo × Julius Nyerere', lat: AVE.jasonMoyo, lng: ST.juliusNyerere, checks: ALL, confidence: 0.8 },
  { id: id(10), name: 'Jason Moyo × First Street', lat: AVE.jasonMoyo, lng: ST.firstSt, checks: RL, confidence: 0.7 },
  { id: id(11), name: 'Jason Moyo × Sam Nujoma', lat: AVE.jasonMoyo, lng: ST.samNujoma, checks: RL, confidence: 0.7 },
  { id: id(12), name: 'George Silundika × Leopold Takawira', lat: AVE.georgeSilundika, lng: ST.leopoldTakawira, checks: RL, confidence: 0.7 },
  { id: id(13), name: 'George Silundika × Julius Nyerere', lat: AVE.georgeSilundika, lng: ST.juliusNyerere, checks: ['red_light', 'stop_line', 'seatbelt'], confidence: 0.7 },
  { id: id(14), name: 'Robert Mugabe × Julius Nyerere', lat: AVE.robertMugabe, lng: ST.juliusNyerere, checks: ALL, confidence: 0.8 },
  { id: id(15), name: 'Robert Mugabe × Leopold Takawira', lat: AVE.robertMugabe, lng: ST.leopoldTakawira, checks: RL, confidence: 0.75 },
  { id: id(16), name: 'Robert Mugabe × Chinhoyi', lat: AVE.robertMugabe, lng: ST.chinhoyi, checks: RL, confidence: 0.7 },
  { id: id(17), name: 'Robert Mugabe × Fourth Street', lat: AVE.robertMugabe, lng: ST.fourthSt, checks: ['red_light', 'stop_line', 'phone_use'], confidence: 0.75 },
  { id: id(18), name: 'Kenneth Kaunda × Julius Nyerere', lat: AVE.kennethKaunda, lng: ST.juliusNyerere, checks: RL, confidence: 0.7 },
  { id: id(19), name: 'Kenneth Kaunda × Sam Nujoma', lat: AVE.kennethKaunda, lng: ST.samNujoma, checks: RL, confidence: 0.65 },
  { id: id(20), name: 'Kenneth Kaunda × Fourth Street', lat: AVE.kennethKaunda, lng: ST.fourthSt, checks: ALL, confidence: 0.7 },
];
