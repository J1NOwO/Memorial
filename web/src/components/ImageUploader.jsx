// ImageUploader.jsx - 이미지 선택, 압축, 미리보기 컴포넌트
//
// Props:
//   localImages       : [{file, previewUrl, tempId}]  - 부모가 관리하는 state
//   onAdd             : (newImages) => void            - 압축 완료 후 추가할 이미지 배열 전달
//   onRemoveLocal     : (tempId) => void               - 로컬 이미지 제거
//   existingUrls      : string[]                       - 이미 저장된 URL (수정 모드)
//   onRemoveExisting  : (url) => void                  - 저장된 이미지 제거
//   disabled          : boolean                        - 추모 모드
//   onCompressingChange: (bool) => void                - 압축 중 여부 전달
//   maxTotal          : number (기본 5)

import { useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { useT } from '../hooks/useT';

const MAX_FILE_MB = 10;
const COMPRESS_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
};

export default function ImageUploader({
  localImages = [],
  onAdd,
  onRemoveLocal,
  existingUrls = [],
  onRemoveExisting,
  disabled = false,
  onCompressingChange,
  maxTotal = 5,
}) {
  const t = useT();
  const fileInputRef = useRef(null);

  const totalCount = existingUrls.length + localImages.length;
  const canAdd = totalCount < maxTotal && !disabled;

  // 파일 선택 처리
  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // 추가 가능 수 계산
    const remaining = maxTotal - totalCount;
    const selected = files.slice(0, remaining);

    // 용량 검사
    const oversized = selected.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      alert(t.img_error_size(MAX_FILE_MB, oversized.map(f => f.name).join(', ')));
      e.target.value = '';
      return;
    }

    onCompressingChange?.(true);
    try {
      const compressed = await Promise.all(
        selected.map(async (file) => {
          const compressedFile = await imageCompression(file, COMPRESS_OPTIONS);
          const previewUrl = await imageCompression.getDataUrlFromFile(compressedFile);
          return {
            file: compressedFile,
            previewUrl,
            tempId: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          };
        })
      );
      onAdd(compressed);
    } catch (err) {
      console.error('이미지 압축 실패:', err);
      alert(t.img_error_compress);
    } finally {
      onCompressingChange?.(false);
      e.target.value = ''; // 같은 파일 재선택 허용
    }
  }

  if (disabled) return null;

  return (
    <div style={S.wrap}>
      {/* 숨김 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 사진이 없을 때: 버튼만 표시 */}
      {totalCount === 0 && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={S.addBtn}
        >
          {t.img_add_photo}
        </button>
      )}

      {/* 사진이 있을 때: 가로 스크롤 미리보기 */}
      {totalCount > 0 && (
        <div style={S.previewScroll}>
          {/* 기존 저장 URL 이미지 */}
          {existingUrls.map((url) => (
            <div key={url} style={S.previewItem}>
              <img src={url} alt="" style={S.previewImg} />
              <button
                type="button"
                onClick={() => onRemoveExisting?.(url)}
                style={S.removeBtn}
                aria-label={t.img_remove}
              >×</button>
            </div>
          ))}

          {/* 새로 선택한 로컬 이미지 */}
          {localImages.map((img) => (
            <div key={img.tempId} style={S.previewItem}>
              <img src={img.previewUrl} alt="" style={S.previewImg} />
              <button
                type="button"
                onClick={() => onRemoveLocal?.(img.tempId)}
                style={S.removeBtn}
                aria-label={t.img_remove}
              >×</button>
            </div>
          ))}

          {/* + 추가 버튼 (최대 미만일 때) */}
          {canAdd && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={S.addMoreBtn}
              aria-label={t.img_add_photo}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 11, color: '#a89080' }}>{t.img_add_more}</span>
            </button>
          )}
        </div>
      )}

      {/* 첨부 수 안내 */}
      <p style={S.hint}>
        {totalCount > 0
          ? t.img_count(totalCount, maxTotal)
          : t.img_hint(maxTotal, MAX_FILE_MB)}
      </p>
    </div>
  );
}

const S = {
  wrap: {
    marginTop: 12,
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 16px',
    borderRadius: 10,
    border: '1.5px dashed #c4956a',
    backgroundColor: '#fef8f2',
    color: '#c4956a',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  previewScroll: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
    // 스크롤바 숨김 (크로스 브라우저)
    scrollbarWidth: 'none',
  },
  previewItem: {
    position: 'relative',
    flexShrink: 0,
  },
  previewImg: {
    width: 80,
    height: 80,
    objectFit: 'cover',
    borderRadius: 10,
    border: '1px solid #e0d8d0',
    display: 'block',
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: '#3d2e22',
    color: '#fffdf9',
    border: 'none',
    fontSize: 13,
    lineHeight: '20px',
    textAlign: 'center',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-sans)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreBtn: {
    width: 80,
    height: 80,
    flexShrink: 0,
    borderRadius: 10,
    border: '1.5px dashed #c4956a',
    backgroundColor: '#fef8f2',
    color: '#c4956a',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    fontFamily: 'var(--font-sans)',
  },
  hint: {
    fontSize: 11,
    color: '#a89080',
    marginTop: 6,
    marginBottom: 0,
  },
};
