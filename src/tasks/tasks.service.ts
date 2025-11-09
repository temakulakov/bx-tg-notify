import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly taskRepository: Repository<Task>,
  ) { }

  async create(createTaskDto: CreateTaskDto) {
    const result = this.taskRepository.create(createTaskDto);
    return await this.taskRepository.save(result);
  }

  async save(task: Task): Promise<Task> {
    return this.taskRepository.save(task);
  }

  async findByBitrixId(bitrixId: number): Promise<Task | null> {
    return this.taskRepository.findOneBy({ bitrixId });
  }

  findAll() {
    return `This action returns all tasks`;
  }

  async findOne(id: number): Promise<Task | null> {
    const task = await this.taskRepository.findOneBy({ bitrixId: id });

    if (!task) {
      throw new BadRequestException(`Задачи с id ${id} не найдена в БД`);
    }

    return task;
  }

  update(id: number, updateTaskDto: UpdateTaskDto) {
    return `This action updates a #${id} task`;
  }

  remove(id: number) {
    return `This action removes a #${id} task`;
  }
}
