import { supabase } from './supabase'

const POST_IMAGES_BUCKET = 'post-images'

export async function uploadPostImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage(POST_IMAGES_BUCKET).upload(path, file)
  if (error) throw error

  const { data } = supabase.storage(POST_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
