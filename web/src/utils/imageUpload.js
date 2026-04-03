// imageUpload.js - Firebase Storage 이미지 업로드/삭제 유틸
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * 로컬 이미지 배열을 Firebase Storage에 업로드하고 URL 배열 반환
 * @param {Array<{file: File}>} localImages
 * @param {string} basePath - 예: "answers/userId/answerId"
 * @returns {Promise<string[]>} 업로드된 URL 배열
 */
export async function uploadImages(localImages, basePath) {
  const urls = [];
  for (const img of localImages) {
    const safeName = img.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}_${safeName}`;
    const storageRef = ref(storage, `${basePath}/${filename}`);
    const snapshot = await uploadBytes(storageRef, img.file);
    const url = await getDownloadURL(snapshot.ref);
    urls.push(url);
  }
  return urls;
}

/**
 * Firebase Storage URL로 파일 삭제 (실패해도 무시)
 * @param {string} url
 */
export async function deleteImageByUrl(url) {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (err) {
    // 파일이 없거나 권한 없는 경우 무시
    console.warn('이미지 삭제 실패 (무시):', err.message);
  }
}
