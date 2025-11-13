import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tasks')
@Unique(['id'])
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 555 })
  title: string;

  @Column({ type: 'int' })
  bitrixId: number;

  @Column({ type: 'longtext' })
  description: string;

  @Column({ type: 'datetime', nullable: true })
  deadline: Date | null;

  @Column({ type: 'simple-json', nullable: false })
  responsible_ids: number[];

  @Column({ type: 'int' })
  created_by: number;

  @Column({ type: 'boolean', default: false })
  replicate: boolean;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
