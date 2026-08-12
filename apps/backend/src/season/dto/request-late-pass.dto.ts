import { IsString } from 'class-validator';

export class RequestLatePassDto {
  @IsString()
  teamId: string;
}
