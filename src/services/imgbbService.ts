/* ─────────────────────────────────────────────────────────────
   ImgBB Image Upload Service (API v1)
   Uploads user profile photos and media from mobile/desktop
   directly to ImgBB and returns the permanent hosted URL.
   ───────────────────────────────────────────────────────────── */

const IMGBB_API_KEY = '41afc89465e5e33fb120d84b5f2d7ad0';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

export interface ImgBBUploadResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: string | number;
    height: string | number;
    size: string | number;
    time: string | number;
    expiration: string | number;
    image?: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb?: {
      url: string;
    };
    medium?: {
      url: string;
    };
    delete_url?: string;
  };
  success: boolean;
  status: number;
}

/**
 * Uploads a File, Blob, or Base64 image to ImgBB API v1 and returns the hosted image URL.
 */
export async function uploadImageToImgBB(
  imageInput: File | Blob | string,
  name?: string,
): Promise<string> {
  const formData = new FormData();

  if (typeof imageInput === 'string') {
    // Strip data URI prefix if present (e.g. "data:image/jpeg;base64,...")
    const base64Clean = imageInput.includes('base64,')
      ? imageInput.split('base64,')[1]
      : imageInput;
    formData.append('image', base64Clean);
  } else {
    formData.append('image', imageInput);
  }

  if (name) {
    formData.append('name', name);
  }

  const response = await fetch(`${IMGBB_UPLOAD_URL}?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`نەتوانرا وێنەکە بەرزبکرێتەوە (HTTP ${response.status})`);
  }

  const result = (await response.json()) as ImgBBUploadResponse;

  if (!result.success || !result.data?.url) {
    throw new Error('نەتوانرا بەستەری وێنەکە لە ImgBB وەربگیرێتەوە.');
  }

  return result.data.url || result.data.display_url;
}
