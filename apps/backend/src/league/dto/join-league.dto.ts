import { IsString, Length } from 'class-validator';

export class JoinLeagueDto {
  @IsString()
  @Length(6, 6)
  inviteCode!: string;
}
