import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CreateSeasonDto } from './dto/create-season.dto';
import { SeasonService } from './season.service';
import { CreateGameweekDto } from './dto/create-gameweek.dto';
import { CreateGameweekResultDto } from './dto/create-gameweek-result.dto';
import { ScoringService } from '../scoring/scoring.service';

@Controller('season')
@UseGuards(JwtAuthGuard)
export class SeasonController {
  constructor(
    private readonly seasonService: SeasonService,
    private readonly scoringService: ScoringService,
  ) {}

  @Post()
  create(@Body() dto: CreateSeasonDto, @Req() req: any) {
    return this.seasonService.create(dto, req.user.id);
  }

  @Post(':seasonId/gameweek')
  createGameweek(
    @Param('seasonId') seasonId: string,
    @Body() dto: CreateGameweekDto,
    @Req() req: any,
  ) {
    return this.seasonService.createGameweek(seasonId, dto, req.user.id);
  }
  @Post(':seasonId/gameweek/:gameweekId/result')
  createResult(
    @Param('seasonId') seasonId: string,
    @Param('gameweekId') gameweekId: string,
    @Body() dto: CreateGameweekResultDto,
    @Req() req: any,
  ) {
    return this.seasonService.createResult(
      seasonId,
      gameweekId,
      dto,
      req.user.id,
    );
  }

  @Post(':seasonId/gameweek/:gameweekId/score')
  calculateScore(@Param('gameweekId') gameweekId: string, @Req() req: any) {
    return this.scoringService.scoreGameweek(gameweekId, req.user.id);
  }
}
