import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ZW_PHONE_PATTERN } from '@streetwise/shared';

export class PasskeyRegistrationOptionsDto {
  @ApiPropertyOptional({ example: 'Pixel 8' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

export class PasskeyRegistrationVerifyDto extends PasskeyRegistrationOptionsDto {
  @ApiProperty()
  @IsUUID()
  challengeId: string;

  @ApiProperty({ description: 'RegistrationResponseJSON from navigator.credentials.create / Credential Manager' })
  @IsObject()
  response: Record<string, unknown>;
}

export class PasskeyAuthenticationOptionsDto {
  @ApiPropertyOptional({ example: '+263771234567' })
  @IsOptional()
  @Matches(ZW_PHONE_PATTERN, { message: 'phone must be in +263 format, e.g. +263771234567' })
  phone?: string;
}

export class PasskeyAuthenticationVerifyDto {
  @ApiProperty()
  @IsUUID()
  challengeId: string;

  @ApiProperty({ description: 'AuthenticationResponseJSON from navigator.credentials.get / Credential Manager' })
  @IsObject()
  response: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Pixel 8' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceLabel?: string;
}
