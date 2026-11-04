import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { CamerasService } from './cameras.service';
import { ListCamerasQuery } from './dto/cameras.dto';

@ApiTags('cameras')
@Controller('cameras')
export class CamerasController {
  constructor(private readonly cameras: CamerasService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  list(@Query() query: ListCamerasQuery) {
    return this.cameras.list(query.since ? new Date(query.since) : undefined);
  }
}
