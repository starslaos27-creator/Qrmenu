import {r as React, j as jsx} from './vendor-react-DCUvmuBu.js';

export function MenuBarcodeInput({value, setValue, setQuantity, inputClass}) {
  const [draft, setDraft] = React.useState(value || '');
  const [error, setError] = React.useState('');
  const input = React.useRef(null);
  const lockedCode = React.useRef(value?.trim() || '');
  const dirty = React.useRef(false);
  React.useEffect(() => {
    setDraft(value || '');
    if (!value) {lockedCode.current = ''; dirty.current = false;}
  }, [value]);
  function accept(add, select = true) {
    const code = (input.current?.value ?? draft).trim();
    if (!code) return;
    if (lockedCode.current && lockedCode.current !== code) {
      setError(`รหัสไม่ตรงกับ ${lockedCode.current} หากต้องการใช้รหัสใหม่ ให้กดเปลี่ยนรหัส`);
      if (select) input.current?.select();
      return;
    }
    lockedCode.current = code;
    dirty.current = false;
    setValue(code);
    setError('');
    if (add) setQuantity(current => String((Number(current) || 0) + 1));
    if (select) input.current?.select();
  }
  return jsx.jsxs('div', {className:'menu-barcode-input', children:[
    jsx.jsx('input', {ref:input, type:'text', className:inputClass, value:draft,
      placeholder:'สแกนหรือพิมพ์รหัส', autoComplete:'off',
      'aria-label':'บาร์โค้ด / Serial', 'aria-invalid':!!error,
      onFocus:event => event.target.select(),
      onChange:event => {dirty.current = true;setDraft(event.target.value); setError('');},
      onBlur:event => {
        if (event.currentTarget.parentElement.contains(event.relatedTarget)) return;
        if (dirty.current) accept(true, false);
      },
      onKeyDown:event => {
        if (event.key === 'Enter' || (event.key === 'Tab' && dirty.current)) {
          event.preventDefault(); event.stopPropagation();
          if (!event.repeat) accept(true);
        }
      }
    }),
    jsx.jsx('small', {children:'สแกนแล้วกด Enter / Tab หรือกรอกรหัสแล้วออกจากช่อง เพิ่มครั้งละ 1 ชิ้น'}),
    jsx.jsx('button', {type:'button', className:'menu-barcode-add-one',
      onMouseDown:event => event.preventDefault(), onClick:() => {accept(true); input.current?.focus();},
      children:'+ เพิ่ม 1 ชิ้น'}),
    value ? jsx.jsx('button', {type:'button', className:'menu-barcode-add-one',
      style:{marginLeft:6}, onClick:() => {lockedCode.current='';dirty.current=false;setValue('');setDraft('');setError('');input.current?.focus();},
      children:'เปลี่ยนรหัส'}) : null,
    error ? jsx.jsx('small', {role:'alert', style:{color:'#b42318'}, children:error}) : null
  ]});
}
