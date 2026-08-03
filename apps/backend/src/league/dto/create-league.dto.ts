import { IsString, Length } from 'class-validator';

export class CreateLeagueDto {
  @IsString()
  @Length(3, 50)
  name!: string;
}
