export type ExercisePreset = {
  exercise: string
  muscle_group: string
  default_weight_kg: string
  default_reps?: string
}

export type LogForm = {
  exercise: string
  muscle_group: string
  sets: string
  reps: string
  weight_kg: string
  note: string
}

export const PRESETS: ExercisePreset[] = [
  { exercise: 'Hít đất (Push-up)',                  muscle_group: 'Ngực, vai trước, tay sau', default_weight_kg: '' },
  { exercise: 'One-arm Dumbbell Row',               muscle_group: 'Lưng, xô, tay trước', default_weight_kg: '10' },
  { exercise: 'One-arm Shoulder Press',             muscle_group: 'Vai', default_weight_kg: '10' },
  { exercise: 'Dumbbell Biceps Curl',               muscle_group: 'Tay trước', default_weight_kg: '10' },
  { exercise: 'One-arm Overhead Triceps Extension',  muscle_group: 'Tay sau', default_weight_kg: '10' },
  { exercise: 'Squat',                              muscle_group: 'Đùi, mông', default_weight_kg: '10' },
  { exercise: 'Deadlift',                           muscle_group: 'Lưng dưới, đùi sau, mông', default_weight_kg: '10' },
  { exercise: 'Bench Press',                        muscle_group: 'Ngực, vai, tay sau', default_weight_kg: '10' },
  { exercise: 'Pull-up / Chin-up',                  muscle_group: 'Lưng, xô, tay trước', default_weight_kg: '' },
  { exercise: 'Dumbbell Lateral Raise',             muscle_group: 'Vai ngang', default_weight_kg: '10' },
  { exercise: 'Plank',                              muscle_group: 'Core', default_weight_kg: '' },
  { exercise: 'Lunges',                             muscle_group: 'Đùi, mông', default_weight_kg: '10' },
  { exercise: 'Leg Press',                          muscle_group: 'Đùi trước', default_weight_kg: '10' },
  { exercise: 'Calf Raise',                         muscle_group: 'Bắp chân', default_weight_kg: '10' },
  { exercise: 'Crunch / Sit-up',                    muscle_group: 'Bụng trên', default_weight_kg: '' },
  { exercise: 'Russian Twist',                      muscle_group: 'Bụng chéo', default_weight_kg: '' },
  { exercise: 'Hip Thrust',                         muscle_group: 'Mông, đùi sau', default_weight_kg: '10' },
  { exercise: 'Face Pull',                          muscle_group: 'Vai sau, lưng trên', default_weight_kg: '10' },
  { exercise: 'Phồng má luân phiên (Cheek Puff)',   muscle_group: 'Cơ má, cơ mặt', default_weight_kg: '' },
  { exercise: 'Triceps Dips',                       muscle_group: 'Tay sau, ngực dưới', default_weight_kg: '' },
  { exercise: 'Arnold Press',                       muscle_group: 'Vai toàn phần', default_weight_kg: '10' },
  { exercise: 'Chạy bộ',                            muscle_group: 'Cardio, chân', default_weight_kg: '', default_reps: '100 bước' },
]

export const EMPTY_FORM: LogForm = {
  exercise: '',
  muscle_group: '',
  sets: '3',
  reps: '10',
  weight_kg: '10',
  note: '',
}

export function applyPresetToForm(form: LogForm, preset: ExercisePreset): LogForm {
  return {
    ...form,
    exercise: preset.exercise,
    muscle_group: preset.muscle_group,
    reps: preset.default_reps ?? form.reps,
    weight_kg: preset.default_weight_kg,
  }
}