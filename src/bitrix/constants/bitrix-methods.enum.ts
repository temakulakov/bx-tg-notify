export enum BitrixMethod {
  // --- Пользователи ---
  USER_GET = 'user.get',

  // --- Проверка пользователя ---
  PROFILE = 'user.profile',

  // --- Получить задачу ---
  TASK = 'tasks.task.get',

  GET_FILE = 'disk.file.get',

  // --- Получить комментарий к задаче ---
  // Метод task.commentitem.get устарел с версии tasks 25.700.0
  // Используем im.dialog.messages.get для работы с чатом задач
  TASK_COMMENT = 'im.dialog.messages.get',
}
