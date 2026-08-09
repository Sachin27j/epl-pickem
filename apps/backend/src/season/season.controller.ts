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
import { ScoringService } from '../scoring/scoring.service';
import { CreateGameweekDto } from './dto/create-gameweek.dto';
import { CreateGameweekResultDto } from './dto/create-gameweek-result.dto';
import { CreateSeasonDto } from './dto/create-season.dto';
import { SeasonService } from './season.service';

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

  @Get(':seasonId')
  getSeason(@Param('seasonId') seasonId: string, @Req() req: any) {
    return this.seasonService.getSeason(seasonId, req.user.id);
  }

  @Post(':seasonId/activate')
  activateSeason(@Param('seasonId') seasonId: string, @Req() req: any) {
    return this.seasonService.activateSeason(seasonId, req.user.id);
  }

  @Post(':seasonId/complete')
  completeSeason(@Param('seasonId') seasonId: string, @Req() req: any) {
    return this.seasonService.completeSeason(seasonId, req.user.id);
  }

  @Post(':seasonId/gameweek')
  createGameweek(
    @Param('seasonId') seasonId: string,
    @Body() dto: CreateGameweekDto,
    @Req() req: any,
  ) {
    return this.seasonService.createGameweek(seasonId, dto, req.user.id);
  }

  @Post(':seasonId/gameweek/:gameweekId/open')
  openGameweek(
    @Param('seasonId') seasonId: string,
    @Param('gameweekId') gameweekId: string,
    @Req() req: any,
  ) {
    return this.seasonService.openGameweek(seasonId, gameweekId, req.user.id);
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

  @Post(':seasonId/gameweek/:gameweekId/lock')
  lockGameweek(
    @Param('seasonId') seasonId: string,
    @Param('gameweekId') gameweekId: string,
    @Req() req: any,
  ) {
    return this.seasonService.lockGameweek(seasonId, gameweekId, req.user.id);
  }

  @Post(':seasonId/gameweek/:gameweekId/reveal')
  revealGameweek(
    @Param('seasonId') seasonId: string,
    @Param('gameweekId') gameweekId: string,
    @Req() req: any,
  ) {
    return this.seasonService.revealGameweek(seasonId, gameweekId, req.user.id);
  }
}
