const supabase = require('../db');

// Sube una imagen en base64 a un bucket de Supabase Storage y devuelve la
// URL pública. Devuelve { url } o { error }.
async function subirImagen(bucket, prefijo, imagenBase64, extension) {
  if (!imagenBase64) return { error: 'Falta la imagen' };

  let buffer;
  try {
    buffer = Buffer.from(imagenBase64, 'base64');
  } catch (e) {
    return { error: 'La imagen no es un base64 válido' };
  }
  if (buffer.length > 4 * 1024 * 1024) {
    return { error: 'La imagen no debe superar 4 MB' };
  }

  const permitidas = ['jpg', 'jpeg', 'png', 'webp'];
  const ext = permitidas.includes(String(extension || '').toLowerCase())
    ? String(extension).toLowerCase()
    : 'jpg';

  const ruta = `${prefijo}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(ruta, buffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
  if (error) return { error: error.message };

  const { data } = supabase.storage.from(bucket).getPublicUrl(ruta);
  return { url: data.publicUrl };
}

module.exports = { subirImagen };
