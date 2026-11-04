import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** No sign-in needed. A valid bearer token is still read, so handlers can personalise. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
