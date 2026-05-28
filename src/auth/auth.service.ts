import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password dan konfirmasi password tidak sama');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar, silakan login');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        password: hashedPassword,
      },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    });

    return { message: 'Signup berhasil', user };
  }

  // ============================================
  // LOGIN STEP 1: cek email+password, generate OTP
  // ============================================
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Email tidak ditemukan');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Password salah');
    }

    // Generate OTP 6 digit
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // berlaku 5 menit

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpiry },
    });

    // SIMULASI: tampilkan OTP di console server
    console.log(`========================================`);
    console.log(`🔐 OTP untuk ${user.email}: ${otp}`);
    console.log(`========================================`);

    return {
      message: 'OTP telah dibuat. Silakan verifikasi.',
      email: user.email,
      // SIMULASI ONLY: di produksi nyata, OTP TIDAK boleh dikirim di response.
      // Seharusnya OTP dikirim via email/SMS. Ini hanya untuk ujian.
      otp,
    };
  }

  // ============================================
  // LOGIN STEP 2: verifikasi OTP, baru kasih token JWT
  // ============================================
  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    if (!user.otpCode || !user.otpExpiry) {
      throw new BadRequestException('Tidak ada OTP aktif, silakan login ulang');
    }
    if (new Date() > user.otpExpiry) {
      throw new BadRequestException('OTP sudah kadaluarsa, silakan login ulang');
    }
    if (user.otpCode !== dto.otp) {
      throw new UnauthorizedException('Kode OTP salah');
    }

    // OTP valid → hapus OTP supaya tidak bisa dipakai lagi
    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpiry: null },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    return {
      message: 'Login berhasil',
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedException('User tidak ditemukan');
    return user;
  }
}