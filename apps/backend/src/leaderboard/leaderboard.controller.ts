import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

@Controller('season')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get(':seasonId/leaderboard')
  getLeaderboard(@Param('seasonId') seasonId: string, @Req() req: any) {
    return this.leaderboardService.getLeaderboard(seasonId, req.user.id);
  }
}
