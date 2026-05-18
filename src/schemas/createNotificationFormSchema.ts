import { z } from 'zod';

const commonFields = {
  title: z.string().min(1, 'Completá el título'),
  message: z.string().min(1, 'Completá el mensaje'),
  notificationType: z.enum(['info', 'urgent'] as const),
};

export const createNotificationFormSchema = z.discriminatedUnion('linkTarget', [
  z.object({
    ...commonFields,
    linkTarget: z.literal('none'),
    studentId: z.number().optional(),
    groupId: z.string().optional(),
  }),
  z.object({
    ...commonFields,
    linkTarget: z.literal('student'),
    studentId: z.number().min(1, 'Seleccioná un alumno'),
    groupId: z.string().optional(),
  }),
  z.object({
    ...commonFields,
    linkTarget: z.literal('group'),
    studentId: z.number().optional(),
    groupId: z.string().min(1, 'Seleccioná un grupo'),
  }),
]);

export type CreateNotificationFormData = z.infer<typeof createNotificationFormSchema>;
