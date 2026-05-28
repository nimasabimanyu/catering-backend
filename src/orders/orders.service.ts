import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  // ==========================================================
  // TRANSAKSI MULTI-TABEL: create order + items + update stock
  // ==========================================================
  async create(userId: number, dto: CreateOrderDto) {
    const packageIds = dto.items.map((i) => i.packageId);
    const packages = await this.prisma.package.findMany({
      where: { id: { in: packageIds } },
    });

    if (packages.length !== packageIds.length) {
      throw new BadRequestException('Ada paket yang tidak ditemukan');
    }

    let totalAmount = 0;
    const itemsData = dto.items.map((item) => {
      const pkg = packages.find((p) => p.id === item.packageId)!;
      if (!pkg.isActive) {
        throw new BadRequestException(`Paket "${pkg.name}" sedang tidak tersedia`);
      }
      if (pkg.stock < item.quantity) {
        throw new BadRequestException(
          `Stok paket "${pkg.name}" tidak cukup (tersisa ${pkg.stock})`,
        );
      }
      const subtotal = pkg.price * item.quantity;
      totalAmount += subtotal;
      return {
        packageId: item.packageId,
        quantity: item.quantity,
        subtotal,
      };
    });

    // Prisma $transaction = atomic operation
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          totalAmount,
          eventDate: new Date(dto.eventDate),
          eventAddress: dto.eventAddress,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes,
          items: { create: itemsData },
        },
        include: {
          items: { include: { package: true } },
          user: { select: { id: true, fullName: true, email: true } },
        },
      });

      for (const item of dto.items) {
        await tx.package.update({
          where: { id: item.packageId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return created;
    });

    return {
      message: 'Pesanan berhasil dibuat',
      order,
    };
  }

  findAll(currentUserId: number, currentRole: UserRole) {
    return this.prisma.order.findMany({
      where: currentRole === UserRole.ADMIN ? undefined : { userId: currentUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { package: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async findOne(id: number, currentUserId: number, currentRole: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { package: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

    if (currentRole !== UserRole.ADMIN && order.userId !== currentUserId) {
      throw new ForbiddenException('Anda tidak punya akses ke pesanan ini');
    }
    return order;
  }

  async updateStatus(id: number, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: {
        items: { include: { package: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async cancel(id: number, currentUserId: number, currentRole: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

    if (currentRole !== UserRole.ADMIN && order.userId !== currentUserId) {
      throw new ForbiddenException('Anda tidak punya akses ke pesanan ini');
    }
    if (currentRole !== UserRole.ADMIN && order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Pesanan yang sudah dikonfirmasi tidak bisa dibatalkan sendiri',
      );
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Pesanan sudah dibatalkan');
    }

    // TRANSAKSI: rollback stock + ubah status
    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.package.update({
          where: { id: item.packageId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    return { message: 'Pesanan berhasil dibatalkan' };
  }
}