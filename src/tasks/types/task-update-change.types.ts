export type TaskUpdateField =
    | 'title'
    | 'description'
    | 'deadline'
    | 'responsible_ids';

export interface TaskUpdateChange {
    field: TaskUpdateField;
    previousValue: unknown;
    currentValue: unknown;
}
