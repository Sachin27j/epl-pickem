import { IsString, Length } from 'class-validator';

export class JoinLeagueDto {
  @IsString()
  @Length(8, 8)
  inviteCode!: string;
}
