import { IsString, Length } from 'class-validator';

export class CreateSeasonDto {
  @IsString()
  @Length(2, 50)
  name!: string;

  @IsString()
  leagueId!: string;
}
