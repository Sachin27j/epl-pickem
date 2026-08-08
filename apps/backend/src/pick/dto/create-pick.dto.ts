import { IsString } from 'class-validator';

export class CreatePickDto {
  @IsString()
  gameweekId!: string;

  @IsString()
  teamId!: string;
}
