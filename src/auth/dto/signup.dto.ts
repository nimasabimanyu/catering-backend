import { IsEmail, IsNotEmpty, IsString, } from 'class-validator';

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  role: string;

  @IsString()
  password: string;

  @IsString()
  confirmPassword: string;
}
