import { Injectable } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';


@Injectable()
export class AuthService {

  constructor(
    private jwtService: JwtService,
  ) {}

  private users = [];

  private nextId = 1;

  signup(dto: SignupDto) {

    const existingUser = this.users.find(
      (user) => user.email === dto.email,
    );

    if (existingUser) {
      return {
        message: 'Akun sudah ada, coba login',
      };
    }

    if (dto.password !== dto.confirmPassword) {
      return {
        message: 'Password dan konfirmasi password tidak sama',
      };
    }

    const newUser = {
      id: this.nextId++,
      fullName: dto.fullName,
      email: dto.email,
      password: dto.password,
     role: dto.role,
    };

    this.users.push(newUser);

    return {
      message: 'Signup berhasil',
      user: newUser,
    };
  }

  login(dto: LoginDto) {

    const user = this.users.find(
      (user) => user.email === dto.email,
    );

    if (!user) {
      return {
        message: 'Email tidak ditemukan',
      };
    }

    if (user.password !== dto.password) {
      return {
        message: 'Password salah',
      };
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      message: 'Login berhasil',

      access_token:
        this.jwtService.sign(payload),

      user,
    };
  }

  getAllUsers() {
    return this.users;
  }
}