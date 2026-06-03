<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { focusTrap } from '../utils/ui';
  
  export let isOpen = false;
  export let title = 'Input';
  export let icon = 'default';
  export let fields = []; // Array di { name, label, type, placeholder, value, min, max, step }
  export let description = '';
  export let submitLabel = 'Submit';
  export let cancelLabel = 'Cancel';
  export let submitOnEnter = false;
  export let autoFocusFirstTextInput = false;
  export let presentation = 'modal'; // modal | dropdown
  /** @type {{ left: number; right: number; top: number; bottom: number; width: number; height: number } | null} */
  export let anchorRect = null;
  
  const dispatch = createEventDispatcher();
  
  let formValues = {};
  let showAdvancedFields = false;
  let contentEl;
  let wasOpen = false;
  let dropdownStyle = '';

  const DROPDOWN_WIDTH = 360;
  const DROPDOWN_MARGIN = 10;
  const DROPDOWN_MIN_HEIGHT = 220;
  const MOBILE_BREAKPOINT = 768;

  const DATE_PART_KEYS = ['year', 'month', 'day', 'hour'];
  const DATE_PART_MAX = { day: 2, month: 2, year: 4, hour: 2 };
  const DATE_PART_LABEL = { year: 'YYYY', month: 'MM', day: 'DD', hour: 'HH' };
  const DATE_FIX_PARTS = ['year', 'month', 'day', 'hour'];
  const DATE_FIX_LABEL = { year: 'Year', month: 'Month', day: 'Day', hour: 'Hour' };
  const DATE_FIX_MAX = { year: 4, month: 2, day: 2, hour: 2 };
  const YEAR_OPTIONS = [2019, 2020, 2021];
  const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
  const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));

  function defaultDateFixes() {
    return {
      year: [],
      month: [],
      day: [],
      hour: []
    };
  }

  function normalizeDateFixEntry(raw) {
    return {
      comparator: String(raw?.comparator || 'eq').trim().toLowerCase() || 'eq',
      value: String(raw?.value || '')
    };
  }

  function mergePinnedIntoDateParts(partsValue, fixedValue) {
    void fixedValue;

    const parts = partsValue && typeof partsValue === 'object'
      ? {
          day: String(partsValue.day || ''),
          month: String(partsValue.month || ''),
          year: String(partsValue.year || ''),
          hour: String(partsValue.hour || '')
        }
      : { day: '', month: '', year: '', hour: '' };

    return parts;
  }

  $: visibleFields = Array.isArray(fields)
    ? fields.filter((field) => {
        const passesAdvanced = showAdvancedFields || !field?.advanced;
        if (!passesAdvanced) return false;

        if (typeof field?.visibleWhen === 'function') {
          try {
            return !!field.visibleWhen(formValues);
          } catch {
            return true;
          }
        }

        return true;
      })
    : [];

  $: hasAdvancedFields = Array.isArray(fields)
    ? fields.some((field) => !!field?.advanced)
    : false;

  $: isDateFilterLayout = Array.isArray(fields)
    ? fields.some((field) => field?.type === 'dateParts' || field?.type === 'dateFixes')
    : false;

  $: isCompactDropdown = presentation === 'dropdown' && isDateFilterLayout;

  $: if (isOpen && !wasOpen && autoFocusFirstTextInput) {
    void focusFirstTextInput();
  }

  $: dropdownStyle = computeDropdownStyle(anchorRect, isCompactDropdown);

  $: wasOpen = isOpen;
  
  // Inizializza form values dai fields
  $: if (isOpen && fields.length > 0) {
    showAdvancedFields = false;
    formValues = fields.reduce((acc, field) => {
      if (field.type === 'checkbox') {
        acc[field.name] = !!field.value;
      } else if (field.type === 'dateParts') {
        const raw = field.value && typeof field.value === 'object' ? field.value : {};
        const pinTarget = typeof field.pinTarget === 'string' ? field.pinTarget : '';
        const fixedRaw = pinTarget && acc[pinTarget] && typeof acc[pinTarget] === 'object'
          ? acc[pinTarget]
          : null;
        const merged = mergePinnedIntoDateParts(raw, fixedRaw);
        const hasYear = String(merged.year || '').trim().length > 0;
        const hasMonth = String(merged.month || '').trim().length > 0;
        const hasDay = String(merged.day || '').trim().length > 0;
        const hasHour = String(merged.hour || '').trim().length > 0;
        const precision = hasHour ? 'hour' : hasDay ? 'day' : hasMonth ? 'month' : hasYear ? 'year' : 'year';
        acc[field.name] = { ...merged, _precision: precision };
      } else if (field.type === 'dateFixes') {
        const base = defaultDateFixes();
        const raw = field.value && typeof field.value === 'object' ? field.value : {};
        DATE_FIX_PARTS.forEach((part) => {
          const source = raw?.[part];
          if (Array.isArray(source)) {
            base[part] = source.map((entry) => normalizeDateFixEntry(entry));
            return;
          }

          if (source && typeof source === 'object' && source.enabled) {
            base[part] = [normalizeDateFixEntry(source)];
            return;
          }

          base[part] = [];
        });
        acc[field.name] = base;
      } else {
        acc[field.name] = field.value || '';
      }
      return acc;
    }, {});
  }

  function getDatePartsValue(fieldName) {
    const raw = formValues?.[fieldName];
    return raw && typeof raw === 'object'
      ? {
          day: String(raw.day || ''),
          month: String(raw.month || ''),
          year: String(raw.year || ''),
          hour: String(raw.hour || '')
        }
      : { day: '', month: '', year: '', hour: '' };
  }

  function getDayOptions(year, month) {
    const y = Number(year);
    const m = Number(month);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return [];
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: daysInMonth }, (_, index) => String(index + 1).padStart(2, '0'));
  }

  function updateDatePartsCascade(fieldName, part, value) {
    const next = getDatePartsValue(fieldName);
    next[part] = String(value || '');

    if (part === 'year') {
      if (!next.year) {
        next.month = '';
        next.day = '';
        next.hour = '';
      } else if (next.month) {
        const dayOptions = getDayOptions(next.year, next.month);
        if (next.day && !dayOptions.includes(next.day)) {
          next.day = '';
          next.hour = '';
        }
      }
    }

    if (part === 'month') {
      if (!next.month) {
        next.day = '';
        next.hour = '';
      } else {
        const dayOptions = getDayOptions(next.year, next.month);
        if (next.day && !dayOptions.includes(next.day)) {
          next.day = '';
          next.hour = '';
        }
      }
    }

    if (part === 'day' && !next.day) {
      next.hour = '';
    }

    formValues = { ...formValues, [fieldName]: next };
  }

  function moveDatePartsMonth(fieldName, delta) {
    const minYear = Math.min(...YEAR_OPTIONS);
    const maxYear = Math.max(...YEAR_OPTIONS);
    const current = getDatePartsValue(fieldName);
    const year = Number(current.year || minYear);
    const month = Number(current.month || 1);

    const minIndex = minYear * 12;
    const maxIndex = maxYear * 12 + 11;
    const currentIndex = year * 12 + Math.max(0, month - 1);
    const nextIndex = Math.max(minIndex, Math.min(maxIndex, currentIndex + Number(delta || 0)));

    const nextYear = Math.floor(nextIndex / 12);
    const nextMonth = (nextIndex % 12) + 1;

    updateDatePartsCascade(fieldName, 'year', String(nextYear));
    updateDatePartsCascade(fieldName, 'month', String(nextMonth).padStart(2, '0'));
  }

  function inferDatePartsPrecision(parts) {
    const safe = parts && typeof parts === 'object' ? parts : {};
    const hasYear = String(safe.year || '').trim().length > 0;
    const hasMonth = String(safe.month || '').trim().length > 0;
    const hasDay = String(safe.day || '').trim().length > 0;
    const hasHour = String(safe.hour || '').trim().length > 0;

    if (hasHour) return 'hour';
    if (hasDay) return 'day';
    if (hasMonth) return 'month';
    if (hasYear) return 'year';
    return 'year';
  }

  function getDatePartsPrecision(fieldName) {
    const raw = formValues?.[fieldName];
    const explicit = String(raw?._precision || '').trim().toLowerCase();
    if (explicit === 'year' || explicit === 'month' || explicit === 'day' || explicit === 'hour') {
      return explicit;
    }
    return inferDatePartsPrecision(getDatePartsValue(fieldName));
  }

  function applyDatePartsPrecision(parts, precision) {
    const safe = {
      day: String(parts?.day || ''),
      month: String(parts?.month || ''),
      year: String(parts?.year || ''),
      hour: String(parts?.hour || '')
    };

    if (precision === 'year') return { ...safe, month: '', day: '', hour: '' };
    if (precision === 'month') return { ...safe, day: '', hour: '' };
    if (precision === 'day') return { ...safe, hour: '' };
    return safe;
  }

  function setDatePartsPrecision(fieldName, precision) {
    const normalized = ['year', 'month', 'day', 'hour'].includes(String(precision || '').toLowerCase())
      ? String(precision).toLowerCase()
      : 'year';

    const current = getDatePartsValue(fieldName);
    const next = applyDatePartsPrecision(current, normalized);
    formValues = { ...formValues, [fieldName]: { ...next, _precision: normalized } };
  }

  function pad2(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.padStart(2, '0');
  }

  function formatDatePickerValue(parts, precision) {
    const year = String(parts?.year || '').trim();
    const month = pad2(parts?.month || '');
    const day = pad2(parts?.day || '');
    const hour = pad2(parts?.hour || '');

    if (precision === 'year') return year;
    if (precision === 'month') return year && month ? `${year}-${month}` : '';
    if (precision === 'day') return year && month && day ? `${year}-${month}-${day}` : '';
    return year && month && day && hour ? `${year}-${month}-${day}T${hour}:00` : '';
  }

  function updateDatePartsFromPicker(fieldName, precision, rawValue) {
    const value = String(rawValue || '').trim();
    const normalized = ['year', 'month', 'day', 'hour'].includes(String(precision || '').toLowerCase())
      ? String(precision).toLowerCase()
      : 'year';

    let next = { day: '', month: '', year: '', hour: '' };

    if (!value) {
      formValues = { ...formValues, [fieldName]: { ...next, _precision: normalized } };
      return;
    }

    if (normalized === 'year') {
      const match = value.match(/^(\d{4})$/);
      if (match) next = { ...next, year: match[1] };
      formValues = { ...formValues, [fieldName]: { ...next, _precision: normalized } };
      return;
    }

    if (normalized === 'month') {
      const match = value.match(/^(\d{4})-(\d{2})$/);
      if (match) next = { ...next, year: match[1], month: match[2] };
      formValues = { ...formValues, [fieldName]: { ...next, _precision: normalized } };
      return;
    }

    if (normalized === 'day') {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) next = { ...next, year: match[1], month: match[2], day: match[3] };
      formValues = { ...formValues, [fieldName]: { ...next, _precision: normalized } };
      return;
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::\d{2})?$/);
    if (match) {
      next = { ...next, year: match[1], month: match[2], day: match[3], hour: match[4] };
    }
    formValues = { ...formValues, [fieldName]: { ...next, _precision: normalized } };
  }

  function formatClassicDateInput(parts) {
    const year = String(parts?.year || '').trim();
    const month = String(parts?.month || '').trim();
    const day = String(parts?.day || '').trim();
    const hour = String(parts?.hour || '').trim();

    if (!year) return '';
    if (!month) return year;
    if (!day) return `${year}/${month}`;
    if (!hour) return `${year}/${month}/${day}`;
    return `${year}/${month}/${day}:${hour}`;
  }

  function isValidMonth(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 && n <= 12;
  }

  function isValidDay(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
    if (m < 1 || m > 12 || d < 1) return false;
    const maxDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return d <= maxDay;
  }

  function isValidDayBasic(value) {
    const d = Number(value);
    return Number.isFinite(d) && d >= 1 && d <= 31;
  }

  function isValidHour(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= 23;
  }

  function updateDatePartsFromClassicInput(fieldName, rawValue) {
    const source = String(rawValue || '');
    const sanitized = source.replace(/[^\d/:]/g, '');

    if (!sanitized) {
      formValues = { ...formValues, [fieldName]: { year: '', month: '', day: '', hour: '' } };
      return;
    }

    // If user is editing the classic formatted value (with separators),
    // preserve segment boundaries so changing year doesn't shift month/day/hour.
    if (sanitized.includes('/') || sanitized.includes(':')) {
      const [rawDatePart, rawHourPart = ''] = sanitized.split(':', 2);
      const [rawYear = '', rawMonth = '', rawDay = ''] = String(rawDatePart || '').split('/', 3);

      const year = String(rawYear || '').replace(/\D+/g, '').slice(0, 4);
      const monthRaw = String(rawMonth || '').replace(/\D+/g, '').slice(0, 2);
      const dayRaw = String(rawDay || '').replace(/\D+/g, '').slice(0, 2);
      const hourRaw = String(rawHourPart || '').replace(/\D+/g, '').slice(0, 2);

      let month = '';
      if (monthRaw.length === 1) {
        month = monthRaw;
      } else if (monthRaw.length === 2 && isValidMonth(monthRaw)) {
        month = monthRaw;
      }

      let day = '';
      if (dayRaw.length === 1) {
        day = dayRaw;
      } else if (dayRaw.length === 2) {
        // Keep DD while editing month/year to avoid collapsing trailing segments.
        // Full YYYY/MM/DD consistency is validated at submit time.
        if (isValidDayBasic(dayRaw)) {
          day = dayRaw;
        }
      }

      let hour = '';
      if (hourRaw.length === 1) {
        hour = hourRaw;
      } else if (hourRaw.length === 2 && isValidHour(hourRaw)) {
        hour = hourRaw;
      }

      formValues = {
        ...formValues,
        [fieldName]: {
          year,
          month,
          day,
          hour
        }
      };
      return;
    }

    // Fallback for pure digit input: keep auto-separators behavior.
    const digits = sanitized.replace(/\D+/g, '').slice(0, 10);
    const year = digits.slice(0, 4);
    const monthRaw = digits.slice(4, 6);
    const dayRaw = digits.slice(6, 8);
    const hourRaw = digits.slice(8, 10);

    let month = '';
    if (monthRaw.length === 1) {
      month = monthRaw;
    } else if (monthRaw.length === 2 && isValidMonth(monthRaw)) {
      month = monthRaw;
    }

    let day = '';
    if (dayRaw.length === 1) {
      day = dayRaw;
    } else if (dayRaw.length === 2) {
      if (isValidDayBasic(dayRaw)) {
        day = dayRaw;
      }
    }

    let hour = '';
    if (hourRaw.length === 1) {
      hour = hourRaw;
    } else if (hourRaw.length === 2 && isValidHour(hourRaw)) {
      hour = hourRaw;
    }

    formValues = {
      ...formValues,
      [fieldName]: {
        year,
        month,
        day,
        hour
      }
    };
  }

  function updateDatePart(fieldName, part, value) {
    const next = getDatePartsValue(fieldName);
    next[part] = value;
    formValues = { ...formValues, [fieldName]: next };
  }

  function focusDatePart(fieldName, partIndex) {
    if (!contentEl) return;
    const target = contentEl.querySelector(
      `[data-date-parts-field="${fieldName}"][data-part-index="${partIndex}"]`
    );
    if (!target || target.disabled) return;
    target.focus();
    target.select?.();
  }

  function handleDatePartInput(fieldName, part, partIndex, event) {
    const input = event.currentTarget;
    const digitsOnly = String(input?.value || '').replace(/\D+/g, '');
    const maxLen = DATE_PART_MAX[part] || 2;
    const nextValue = digitsOnly.slice(0, maxLen);

    updateDatePart(fieldName, part, nextValue);

    if (nextValue.length >= maxLen && partIndex < DATE_PART_KEYS.length - 1) {
      setTimeout(() => focusDatePart(fieldName, partIndex + 1), 0);
    }
  }

  function handleDatePartKeyDown(fieldName, partIndex, event) {
    const input = event.currentTarget;
    const valueLength = String(input?.value || '').length;
    const caretStart = typeof input?.selectionStart === 'number' ? input.selectionStart : valueLength;
    const caretEnd = typeof input?.selectionEnd === 'number' ? input.selectionEnd : valueLength;

    if (event.key === 'ArrowRight' && caretStart === valueLength && caretEnd === valueLength && partIndex < DATE_PART_KEYS.length - 1) {
      event.preventDefault();
      focusDatePart(fieldName, partIndex + 1);
      return;
    }

    if (event.key === 'ArrowLeft' && caretStart === 0 && caretEnd === 0 && partIndex > 0) {
      event.preventDefault();
      focusDatePart(fieldName, partIndex - 1);
    }
  }

  function getDateFixesValue(fieldName) {
    const raw = formValues?.[fieldName];
    const base = defaultDateFixes();
    if (!raw || typeof raw !== 'object') return base;

    DATE_FIX_PARTS.forEach((part) => {
      const source = raw?.[part];
      if (Array.isArray(source)) {
        base[part] = source.map((entry) => normalizeDateFixEntry(entry));
        return;
      }
      if (source && typeof source === 'object' && source.enabled) {
        base[part] = [normalizeDateFixEntry(source)];
        return;
      }
      base[part] = [];
    });

    return base;
  }

  function addDateFixEntry(fieldName, part, initial = {}) {
    const next = getDateFixesValue(fieldName);
    next[part] = [...next[part], normalizeDateFixEntry(initial)];
    formValues = { ...formValues, [fieldName]: next };
  }

  function addDateFixEntryAfter(fieldName, part, index, initial = {}) {
    const next = getDateFixesValue(fieldName);
    const entries = next[part].length > 0 ? next[part] : [normalizeDateFixEntry({})];
    const insertAt = Math.max(0, Math.min(Number(index) + 1, entries.length));
    next[part] = [
      ...entries.slice(0, insertAt),
      normalizeDateFixEntry(initial),
      ...entries.slice(insertAt)
    ];
    formValues = { ...formValues, [fieldName]: next };
  }

  function removeDateFixEntry(fieldName, part, index) {
    const next = getDateFixesValue(fieldName);
    const entries = next[part].filter((_, i) => i !== index);
    next[part] = entries.length > 0 ? entries : [normalizeDateFixEntry({})];
    formValues = { ...formValues, [fieldName]: next };
  }

  function updateDateFixEntry(fieldName, part, index, patch) {
    const next = getDateFixesValue(fieldName);
    next[part] = next[part].map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    formValues = { ...formValues, [fieldName]: next };
  }

  function moveDateFixEntry(fieldName, fromPart, index, toPart) {
    const targetPart = String(toPart || '').trim();
    if (!DATE_FIX_PARTS.includes(targetPart) || targetPart === fromPart) return;

    const next = getDateFixesValue(fieldName);
    const entry = next[fromPart]?.[index];
    if (!entry) return;

    next[fromPart] = next[fromPart].filter((_, i) => i !== index);
    next[targetPart] = [...next[targetPart], { ...entry, value: '' }];
    formValues = { ...formValues, [fieldName]: next };
  }

  function handleDateFixValueInput(fieldName, part, index, event) {
    const input = event.currentTarget;
    const digitsOnly = String(input?.value || '').replace(/\D+/g, '');
    const maxLen = DATE_FIX_MAX[part] || 2;
    updateDateFixEntry(fieldName, part, index, { value: digitsOnly.slice(0, maxLen) });
  }

  function handleSubmit() {
    dispatch('submit', formValues);
    close();
  }
  
  function close() {
    dispatch('close');
  }

  function isTextLikeField(field) {
    const type = String(field?.type || 'text').trim().toLowerCase();
    return type === 'text' || type === 'search' || type === 'url' || type === 'number' || type === 'textarea';
  }

  async function focusFirstTextInput() {
    await tick();
    // focusTrap sets focus after ~50ms on modal open; run after that to keep text input focused.
    setTimeout(() => {
      if (!contentEl) return;

      const field = contentEl.querySelector('input[type="text"], input[type="search"], input[type="url"], input[type="number"], textarea');
      if (!field || field.disabled) return;

      field.focus();
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        const currentValue = String(field.value || '');
        if (isDateFilterLayout && field instanceof HTMLInputElement) {
          const end = currentValue.length;
          field.setSelectionRange?.(end, end);
        } else {
          field.select?.();
        }
      }
    }, 90);
  }
  
  function handleKeyDown(e) {
    if (e.key === 'Escape') close();

    if (e.key !== 'Enter') return;

    const target = e.target;
    const isTextarea = target instanceof HTMLTextAreaElement;

    if (submitOnEnter && !isTextarea) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function computeDropdownStyle(rect, compactDate = false) {
    if (presentation !== 'dropdown' || !rect || typeof window === 'undefined') {
      return '';
    }

    const viewportW = window.innerWidth || 1024;
    const viewportH = window.innerHeight || 768;
    const isMobile = viewportW < MOBILE_BREAKPOINT;
    const anchorGap = isMobile ? 4 : 8;
    void compactDate;
    const width = Math.min(DROPDOWN_WIDTH, viewportW - DROPDOWN_MARGIN * 2);

    let left = Number(rect.left || 0);
    if (left + width > viewportW - DROPDOWN_MARGIN) {
      left = viewportW - DROPDOWN_MARGIN - width;
    }
    left = Math.max(DROPDOWN_MARGIN, left);

    const spaceBelow = Math.max(0, viewportH - Number(rect.bottom || 0) - DROPDOWN_MARGIN - anchorGap);
    const spaceAbove = Math.max(0, Number(rect.top || 0) - DROPDOWN_MARGIN - anchorGap);
    const preferBelow = spaceBelow >= Math.max(DROPDOWN_MIN_HEIGHT, spaceAbove);
    const side = preferBelow ? 'below' : 'above';

    const available = side === 'below' ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(140, Math.min(720, available));

    let top = Number(rect.bottom || 0) + anchorGap;
    if (side === 'above') {
      top = Number(rect.top || 0) - anchorGap - maxHeight;
    }
    top = Math.max(DROPDOWN_MARGIN, Math.min(top, viewportH - DROPDOWN_MARGIN - 120));

    return `position: fixed; left: ${left}px; top: ${top}px; width: ${width}px; max-height: ${Math.floor(maxHeight)}px; overflow: auto;`;
  }

  function handleWindowMouseDown(event) {
    if (!isOpen || presentation !== 'dropdown') return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!contentEl?.contains(target)) {
      close();
    }
  }

  function handleViewportChange() {
    if (!isOpen || presentation !== 'dropdown') return;
    dropdownStyle = computeDropdownStyle(anchorRect, isCompactDropdown);
  }

  function maybeFocusTrap(node) {
    if (presentation !== 'modal') return {};
    return focusTrap(node);
  }
  
  const iconMap = {
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>`,
    filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>`,
    default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>`
  };
</script>

<svelte:window
  on:keydown={handleKeyDown}
  on:mousedown={handleWindowMouseDown}
  on:resize={handleViewportChange}
  on:scroll={handleViewportChange}
/>

{#if isOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    use:maybeFocusTrap
    class={`fixed inset-0 z-[var(--z-dialog-overlay)] ${presentation === 'modal' ? 'flex items-center justify-center p-4' : 'pointer-events-none'}`}
  >
    <!-- Backdrop -->
    {#if presentation === 'modal'}
      <button
        type="button"
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
        on:click={close}
        aria-label="Close modal"
      ></button>
    {/if}
    
    <!-- Modal -->
    <div 
      bind:this={contentEl}
      style={presentation === 'dropdown' ? dropdownStyle : ''}
      class={`z-[var(--z-dialog-content)] bg-gray-900 rounded-xl shadow-2xl border border-gray-700 pointer-events-auto ${presentation === 'modal' ? 'relative w-full max-w-md' : ''}`}
    >
      <!-- Header -->
      <div class={`flex items-center justify-between border-b border-gray-700 bg-gradient-to-b from-gray-800 to-gray-900 ${isCompactDropdown ? 'px-4 py-2.5' : 'px-6 py-4'}`}>
        <div class="flex items-center space-x-3">
          <!-- Icon -->
          <div class="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <div class="w-5 h-5 text-blue-400">
              {@html iconMap[icon] || iconMap.default}
            </div>
          </div>
          
          <div>
            <h3 class="text-lg font-bold text-white">{title}</h3>
            {#if description}
              <p class="text-xs text-gray-400 mt-0.5">{description}</p>
            {/if}
          </div>
        </div>
        
        <button 
          on:click={close}
          class="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
          aria-label="Close"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <!-- Content -->
      <div class={isCompactDropdown ? 'px-4 py-3.5 space-y-2.5' : 'px-6 py-5 space-y-4'}>
        {#each visibleFields as field, fieldIndex}
          {@const fieldId = `input-modal-${field.name}`}
          {@const shouldAutofocus = autoFocusFirstTextInput && fieldIndex === 0 && isTextLikeField(field)}
          <div>
            <label for={fieldId} class={`block text-sm font-medium text-gray-300 ${isCompactDropdown ? 'mb-1' : 'mb-2'}`}>
              {field.label}
              {#if field.required}
                <span class="text-red-400">*</span>
              {/if}
            </label>
            
            {#if field.type === 'textarea'}
              <textarea
                id={fieldId}
                autofocus={shouldAutofocus}
                bind:value={formValues[field.name]}
                placeholder={field.placeholder || ''}
                rows={field.rows || 3}
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all resize-none"
              ></textarea>
            {:else if field.type === 'checkbox'}
              <label class="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  id={fieldId}
                  type="checkbox"
                  bind:checked={formValues[field.name]}
                  class="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
                <span class="text-sm text-gray-300">{field.placeholder || field.label}</span>
              </label>
            {:else if field.type === 'select'}
              <select
                id={fieldId}
                bind:value={formValues[field.name]}
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
              >
                {#each field.options || [] as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            {:else if field.type === 'preview'}
              <div
                id={fieldId}
                class={isCompactDropdown
                  ? 'w-full min-h-[84px] max-h-44 overflow-auto px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-lg text-emerald-200 font-mono text-[12px] leading-5 whitespace-pre-wrap break-all'
                  : 'w-full min-h-[96px] max-h-56 overflow-auto px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-lg text-emerald-200 font-mono text-sm leading-6 whitespace-pre-wrap break-all'}
              >
                {field.computePreview ? field.computePreview(formValues) : ''}
              </div>
            {:else if field.type === 'dateFixes'}
              {@const dateFixesValue = getDateFixesValue(field.name)}
              <div id={fieldId} class={isCompactDropdown ? 'space-y-1.5 rounded-lg border border-amber-600/45 bg-amber-950/20 p-2' : 'space-y-2.5 rounded-lg border border-amber-600/45 bg-amber-950/20 p-2.5'}>
                <div>
                  <div class="text-[11px] text-amber-100/90">Metadata constraints are combined with AND.</div>
                </div>

                {#each DATE_FIX_PARTS as part}
                  {@const entries = dateFixesValue[part].length > 0 ? dateFixesValue[part] : [normalizeDateFixEntry({})]}
                  <div class={isCompactDropdown ? 'space-y-1' : 'space-y-1.5'}>
                    {#each entries as entry, fixIndex}
                      <div class={isCompactDropdown ? 'grid grid-cols-[minmax(0,54px)_52px_minmax(0,72px)_auto_auto] gap-1.5 items-center rounded-md border border-amber-700/45 bg-amber-950/15 p-1.5' : 'grid grid-cols-[minmax(0,86px)_78px_1fr_auto_auto] gap-2 items-center rounded-md border border-amber-700/45 bg-amber-950/15 p-2'}>
                        <div class={isCompactDropdown ? 'text-xs font-semibold text-amber-100' : 'text-sm font-semibold text-amber-100'}>
                          {DATE_FIX_LABEL[part]}
                        </div>
                        <select
                          value={entry.comparator}
                          on:change={(event) => updateDateFixEntry(field.name, part, fixIndex, { comparator: String(event.currentTarget?.value || 'eq') })}
                          class={isCompactDropdown
                            ? 'px-2 py-1 bg-amber-950/35 border border-amber-700/60 rounded text-amber-50 text-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
                            : 'px-2.5 py-1.5 bg-amber-950/35 border border-amber-700/60 rounded text-amber-50 text-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'}
                          aria-label={`${DATE_FIX_LABEL[part]} comparator`}
                        >
                          <option value="eq">=</option>
                          <option value="ne">!=</option>
                          <option value="gte">&gt;=</option>
                          <option value="lte">&lt;=</option>
                        </select>
                        <input
                          type="text"
                          inputmode="numeric"
                          maxlength={DATE_FIX_MAX[part]}
                          value={entry.value}
                          placeholder={part === 'year' ? 'YYYY' : part === 'month' ? 'MM' : part === 'day' ? 'DD' : 'HH'}
                          on:input={(event) => handleDateFixValueInput(field.name, part, fixIndex, event)}
                          class={isCompactDropdown
                            ? 'w-full min-w-0 px-2 py-1 bg-amber-950/35 border border-amber-700/60 rounded text-amber-50 placeholder-amber-200/45 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 font-mono text-xs'
                            : 'px-2.5 py-1.5 bg-amber-950/35 border border-amber-700/60 rounded text-amber-50 placeholder-amber-200/45 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 font-mono text-sm'}
                          aria-label={`${DATE_FIX_LABEL[part]} value`}
                        />
                        <button
                          type="button"
                          on:click={() => addDateFixEntryAfter(field.name, part, fixIndex)}
                          class={isCompactDropdown
                            ? 'inline-flex h-6 w-6 shrink-0 items-center justify-center justify-self-end rounded-full border border-amber-500/70 bg-amber-600/25 text-amber-100 hover:bg-amber-600/40 hover:text-white'
                            : 'inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-500/70 bg-amber-600/25 text-amber-100 hover:bg-amber-600/40 hover:text-white'}
                          aria-label={`Add ${DATE_FIX_LABEL[part]} constraint`}
                        >
                          <svg class={isCompactDropdown ? 'h-3 w-3' : 'h-3.5 w-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path d="M12 5v14M5 12h14"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          on:click={() => removeDateFixEntry(field.name, part, fixIndex)}
                          class={isCompactDropdown
                            ? 'inline-flex h-6 w-6 shrink-0 items-center justify-center justify-self-end rounded-full border border-red-500/70 bg-red-600/25 text-red-100 hover:bg-red-600/40 hover:text-white'
                            : 'inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-500/70 bg-red-600/25 text-red-100 hover:bg-red-600/40 hover:text-white'}
                          aria-label={`Remove ${DATE_FIX_LABEL[part]} constraint`}
                        >
                          <svg class={isCompactDropdown ? 'h-3 w-3' : 'h-3.5 w-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    {/each}
                  </div>
                {/each}
              </div>
            {:else if field.type === 'dateParts'}
              {@const datePartsValue = getDatePartsValue(field.name)}
              {@const classicDateValue = formatClassicDateInput(datePartsValue)}
              <div id={fieldId} class={isCompactDropdown ? 'space-y-1.5' : 'space-y-2'}>
                <input
                  type="text"
                  inputmode="text"
                  value={classicDateValue}
                  placeholder="YYYY/MM/DD:HH"
                  on:input={(event) => updateDatePartsFromClassicInput(field.name, String(event.currentTarget?.value || ''))}
                  class={isCompactDropdown
                    ? 'w-full px-2 py-1.5 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono text-xs bg-gray-800 border border-gray-700 focus:border-blue-500'
                    : 'w-full px-2.5 py-2 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono text-sm bg-gray-800 border border-gray-700 focus:border-blue-500'}
                  aria-label={`${field.label} date and time`}
                />
              </div>
            {:else}
              <input
                id={fieldId}
                type={field.type || 'text'}
                autofocus={shouldAutofocus}
                bind:value={formValues[field.name]}
                placeholder={field.placeholder || ''}
                min={field.min}
                max={field.max}
                step={field.step}
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono text-sm"
              />
            {/if}
            
            {#if field.hint}
              <p class="text-xs text-gray-500 mt-1">{field.hint}</p>
            {/if}
          </div>
        {/each}

        {#if hasAdvancedFields}
          <div class="pt-1">
            <button
              type="button"
              class="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              on:click={() => (showAdvancedFields = !showAdvancedFields)}
              aria-expanded={showAdvancedFields}
            >
              <svg class="w-3.5 h-3.5 transition-transform {showAdvancedFields ? 'rotate-90' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 6l6 6-6 6"/>
              </svg>
              <span>{showAdvancedFields ? 'Hide advanced options' : 'Show advanced options'}</span>
            </button>
          </div>
        {/if}
      </div>
      
      <!-- Footer -->
      <div class={`border-t border-gray-700 bg-gray-800/50 flex items-center justify-between rounded-b-xl ${isCompactDropdown ? 'px-4 py-2.5' : 'px-6 py-4'}`}>
        <div class="text-xs text-gray-500">
          {#if submitOnEnter}
            <kbd class="px-2 py-1 bg-gray-700 rounded text-xs font-mono">Enter</kbd> to apply
          {:else}
            <kbd class="px-2 py-1 bg-gray-700 rounded text-xs font-mono">Ctrl+Enter</kbd> to submit
          {/if}
        </div>
        <div class="flex space-x-3">
          <button
            on:click={close}
            class="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            on:click={handleSubmit}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-lg hover:shadow-blue-500/30"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(1);
  }
</style>
