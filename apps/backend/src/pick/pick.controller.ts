import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';

import { CreatePickDto } from './dto/create-pick.dto';
import { UpdatePickDto } from './dto/update-pick.dto';
import { PickService } from './pick.service';

@Controller('pick')
@UseGuards(JwtAuthGuard)
export class PickController {
  constructor(private readonly pickService: PickService) {}

  @Post()
  create(@Body() dto: CreatePickDto, @Req() req: any) {
    return this.pickService.create(dto, req.user.id);
  }

  @Get('gameweek/:gameweekId')
  getMyPick(@Param('gameweekId') gameweekId: string, @Req() req: any) {
    return this.pickService.getMyPick(gameweekId, req.user.id);
  }

  @Get('gameweek/:gameweekId/statuses')
  getPickStatuses(@Param('gameweekId') gameweekId: string, @Req() req: any) {
    return this.pickService.getPickStatuses(gameweekId, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePickDto, @Req() req: any) {
    return this.pickService.update(id, dto, req.user.id);
  }
}
