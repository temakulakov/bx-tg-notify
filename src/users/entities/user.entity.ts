import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users_shebo')
@Unique(['bitrix_id']) // уникальность на уровне таблицы
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  bitrix_id: number;

  @Column({ type: 'simple-json', nullable: false })
  telegram_ids: number[];

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'boolean', default: false })
  isAdmin: boolean;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
