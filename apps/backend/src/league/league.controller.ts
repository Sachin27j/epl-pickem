import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import { LeagueService } from './league.service';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CreateLeagueDto } from './dto/create-league.dto';
import { JoinLeagueDto } from './dto/join-league.dto';

@Controller('league')
@UseGuards(JwtAuthGuard)
export class LeagueController {
  constructor(private readonly leagueService: LeagueService) {}

  @Post()
  create(@Body() dto: CreateLeagueDto, @Req() req: any) {
    return this.leagueService.create(dto.name, req.user.id);
  }

  @Post('join')
  join(@Body() dto: JoinLeagueDto, @Req() req: any) {
    return this.leagueService.join(dto.inviteCode, req.user.id);
  }
}
