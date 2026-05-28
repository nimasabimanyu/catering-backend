import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreatePackageDto) {
    return this.prisma.package.create({
      data: dto,
      include: { category: true },
    });
  }

  findAll(categoryId?: number) {
    return this.prisma.package.findMany({
      where: categoryId ? { categoryId } : undefined,
      orderBy: { id: 'asc' },
      include: { category: true },
    });
  }

  async findOne(id: number) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!pkg) throw new NotFoundException('Paket tidak ditemukan');
    return pkg;
  }

  async update(id: number, dto: UpdatePackageDto) {
    await this.findOne(id);
    return this.prisma.package.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.package.delete({ where: { id } });
    return { message: `Paket dengan id ${id} berhasil dihapus` };
  }
}