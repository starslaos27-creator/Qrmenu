export function menuUnitField(jsx, Field, inputClass, value, setValue) {
  return jsx.jsx(Field, {label:'หน่วยเรียก (เช่น ขวด, กก., ถุง) *', children:jsx.jsx('input', {
    type:'text', className:inputClass, value, required:true, maxLength:40,
    pattern:'.*\\S.*', placeholder:'เช่น ขวด, กก., แพ็ค',
    onChange:event => setValue(event.target.value)
  })});
}
