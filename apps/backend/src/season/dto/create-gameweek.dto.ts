import { IsDateString, IsInt, Min } from 'class-validator';

export class CreateGameweekDto {
  @IsInt()
  @Min(1)
  number!: number;

  @IsDateString()
  deadline!: string;
}
