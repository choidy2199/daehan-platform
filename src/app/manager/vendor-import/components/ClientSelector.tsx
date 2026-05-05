'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Client } from '../lib/types';
import { loadClients, filterClients } from '../lib/storage';
import { colors, fonts, spacing, radius, borders, shadows } from '../lib/design-tokens';

interface ClientSelectorProps {
  value: Client | null;
  onChange: (c: Client | null) => void;
}

const DEBOUNCE_MS = 150;
const MAX_VISIBLE = 20;

export default function ClientSelector({ value, onChange }: ClientSelectorProps) {
  // 모든 거래처 (싱글턴 캐시)
  const allClients = useMemo<Client[]>(() => loadClients(), []);

  // 입력값 / 드롭다운 상태
  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<number | null>(null);
  const isComposing = useRef<boolean>(false);

  // 필터링된 거래처 목록
  const filtered = useMemo<Client[]>(() => {
    if (!isOpen) return [];
    return filterClients(query, allClients, MAX_VISIBLE);
  }, [query, allClients, isOpen]);

  // 드롭다운 열릴 때 첫 항목 자동 활성화
  useEffect(() => {
    if (isOpen && filtered.length > 0) {
      setActiveIdx(0);
    } else {
      setActiveIdx(-1);
    }
  }, [isOpen, filtered.length]);

  // 외부 클릭 닫기
  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      if (inputRef.current && inputRef.current.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // 거래처 선택
  const handleSelect = useCallback((client: Client) => {
    onChange(client);
    setQuery('');
    setIsOpen(false);
  }, [onChange]);

  // 입력 (IME-safe + debounce)
  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (isComposing.current) {
      // 한글 조합 중에는 즉시 반영 (compositionend 시 debounce 시작)
      setQuery(raw);
      return;
    }
    // debounce
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
    }
    setQuery(raw);  // input value는 즉시 (controlled)
    debounceTimer.current = window.setTimeout(() => {
      // 검색 결과 갱신은 useMemo로 자동
      // 여기서는 딱히 추가 액션 없음 (state 변경만으로 재렌더링)
    }, DEBOUNCE_MS);
  }, []);

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false;
    // composition 끝난 후 debounce
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = window.setTimeout(() => {
      // useMemo가 query 변경 감지하므로 추가 액션 불필요
    }, DEBOUNCE_MS);
  }, []);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filtered.length === 0) {
      if (e.key === 'Escape') setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((idx) => Math.min(idx + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((idx) => Math.max(idx - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < filtered.length) {
        handleSelect(filtered[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [isOpen, filtered, activeIdx, handleSelect]);

  // 변경 버튼 (선택 해제)
  const handleChangeClick = useCallback(() => {
    onChange(null);
    setQuery('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [onChange]);

  // 활성 항목 자동 스크롤
  useEffect(() => {
    if (activeIdx < 0 || !dropdownRef.current) return;
    const items = dropdownRef.current.querySelectorAll('[data-item-idx]');
    const target = items[activeIdx] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  // ───────────────────── render ─────────────────────

  // 거래처 선택됨 → 정보 카드
  if (value) {
    return (
      <div
        style={{
          padding: spacing.s3,
          border: `1px solid ${colors.success}`,
          borderRadius: radius.base,
          backgroundColor: colors.successBg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: spacing.s3,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: fonts.panelHeader.size,
            fontWeight: fonts.panelHeader.weight,
            color: colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          ✓ {value.name}
        </div>
        <button
          type="button"
          onClick={handleChangeClick}
          style={{
            flexShrink: 0,
            height: '28px',
            padding: `0 ${spacing.s3}`,
            backgroundColor: colors.bg,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.base,
            fontSize: fonts.bodySm.size,
            cursor: 'pointer',
            fontFamily: fonts.family,
          }}
        >
          변경
        </button>
      </div>
    );
  }

  // 거래처 미선택 → 검색 input + 드롭다운
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          padding: spacing.s3,
          border: `2px dashed ${colors.danger}`,
          borderRadius: radius.base,
          backgroundColor: colors.dangerBg,
        }}
      >
        <div
          style={{
            fontSize: fonts.bodySm.size,
            color: colors.danger,
            marginBottom: spacing.s2,
            fontWeight: 500,
          }}
        >
          ⚠️ 거래처 선택 (필수)
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="거래처명 / 대표자 / 사업자번호 / 관리코드 검색"
          autoComplete="nope"
          spellCheck={false}
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          name="vendor_search"
          onChange={handleInput}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          style={{
            width: '100%',
            height: '34px',
            padding: `0 ${spacing.s3}`,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.base,
            fontSize: fonts.body.size,
            fontFamily: fonts.family,
            backgroundColor: colors.bg,
            color: colors.text,
            boxSizing: 'border-box',
            outline: 'none',
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLInputElement).style.border = borders.focus;
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = `1px solid ${colors.border}`;
          }}
        />
      </div>

      {/* 드롭다운 */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: spacing.s3,
            right: spacing.s3,
            maxHeight: '280px',
            overflowY: 'auto',
            backgroundColor: colors.bg,
            border: borders.base,
            borderRadius: radius.base,
            boxShadow: shadows.pop,
            zIndex: 9999,
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: spacing.s4,
                textAlign: 'center',
                color: colors.textHint,
                fontSize: fonts.bodySm.size,
              }}
            >
              {query ? '검색 결과 없음' : '거래처를 검색하세요'}
            </div>
          ) : (
            filtered.map((c, i) => {
              const code2 = c.manageCode || c.code || '';
              const isActive = i === activeIdx;
              return (
                <div
                  key={c.code || i}
                  data-item-idx={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(c);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    padding: `${spacing.s2} ${spacing.s3}`,
                    fontSize: fonts.tableCell.size,
                    color: colors.text,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${colors.bgTertiary}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: spacing.s2,
                    backgroundColor: isActive ? colors.primaryLight : 'transparent',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.name}
                  </span>
                  {code2 && (
                    <span
                      style={{
                        fontSize: '10px',
                        color: colors.textHint,
                        flexShrink: 0,
                      }}
                    >
                      {code2}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
