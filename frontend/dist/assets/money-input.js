import {r as React, j as jsx} from './vendor-react-DCUvmuBu.js';

export function formatMoneyInput(value) {
  const raw = String(value ?? '').replaceAll(',', '');
  const [whole, decimal] = raw.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decimal === undefined ? '' : '.' + decimal);
}

// The parent receives an unformatted decimal string; commas are display only.
export function MoneyInput({value, onChange, min = '0', max, step = '0.01', type, ...props}) {
  const ref = React.useRef(null);
  const caret = React.useRef(null);
  const display = formatMoneyInput(value);
  const validate = raw => {
    if (raw === '') return '';
    if (!/^\d+(\.\d*)?$/.test(raw)) return 'กรุณากรอกจำนวนเงินให้ถูกต้อง';
    const amount = Number(raw);
    if (!Number.isFinite(amount)) return 'จำนวนเงินไม่ถูกต้อง';
    if (min !== undefined && amount < Number(min)) return `จำนวนเงินต้องไม่น้อยกว่า ${formatMoneyInput(min)}`;
    if (max !== undefined && amount > Number(max)) return `จำนวนเงินต้องไม่เกิน ${formatMoneyInput(max)}`;
    if (step !== 'any') {
      const ticks = (amount - Number(min || 0)) / Number(step);
      if (Math.abs(ticks - Math.round(ticks)) > 0.0001) return 'กรุณากรอกจำนวนเงินตามหน่วยที่กำหนด';
    }
    return '';
  };
  React.useLayoutEffect(() => {
    ref.current?.setCustomValidity(validate(String(value ?? '').replaceAll(',', '')));
    if (caret.current !== null && document.activeElement === ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });
  return jsx.jsx('input', {...props, ref, type:'text', inputMode:'decimal',
    'data-money-input':true, value:display,
    onKeyDown:event => {
      const input = event.currentTarget;
      const position = input.selectionStart;
      if (position === input.selectionEnd) {
        if (event.key === 'Backspace' && input.value[position - 1] === ',') input.setSelectionRange(position - 1, position - 1);
        if (event.key === 'Delete' && input.value[position] === ',') input.setSelectionRange(position + 1, position + 1);
      }
      props.onKeyDown?.(event);
    },
    onChange:event => {
      const input = event.currentTarget;
      const raw = input.value.replaceAll(',', '').replace(/\s/g, '');
      if (!/^\d*(\.\d*)?$/.test(raw)) {input.value = display; return;}
      const count = input.value.slice(0, input.selectionStart).replace(/[,\s]/g, '').length;
      const formatted = formatMoneyInput(raw);
      let index = 0, digits = 0;
      while (index < formatted.length && digits < count) {if (formatted[index] !== ',') digits++; index++;}
      caret.current = index;
      input.setCustomValidity(validate(raw));
      input.value = formatted;
      input.setSelectionRange(index, index);
      onChange?.({target:{value:raw}, currentTarget:{value:raw}});
    }
  });
}
