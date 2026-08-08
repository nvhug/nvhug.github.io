import { supabase } from './supabase'

const POST_IMAGES_BUCKET = 'post-images'
const FOOD_THUMBS_BUCKET = 'food-photos'

export async function uploadPostImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage(POST_IMAGES_BUCKET).upload(path, file)
  if (error) throw error

  const { data } = supabase.storage(POST_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Upload a base64 data URL thumbnail. Returns the public CDN URL. */
export async function uploadFoodThumb(dataUrl: string, userId: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage(FOOD_THUMBS_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  const { data } = supabase.storage(FOOD_THUMBS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Delete a food thumbnail by its public URL. Silently ignores non-storage URLs (e.g. legacy base64). */
export async function deleteFoodThumb(publicUrl: string): Promise<void> {
  const marker = `/object/public/${FOOD_THUMBS_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return
  await supabase.storage(FOOD_THUMBS_BUCKET).remove([publicUrl.slice(idx + marker.length)])
}
