import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('phrases')
export class Phrase {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 500, unique: false })
    text: string;

    @CreateDateColumn({ type: 'datetime', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
    updatedAt: Date;
}

