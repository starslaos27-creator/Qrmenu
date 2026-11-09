const icons = [
  [/เครื่องดื่ม|เครื่องดื่ม|ເຄື່ອງດື່ມ|drink|beverage/i, '🍾'],
  [/เนื้อ|ເນື້ອ|meat/i, '🥩'],
  [/ผัก|ຜັກ|vegetable/i, '🥬'],
  [/เครื่องปรุง|ເຄື່ອງປຸງ|seasoning/i, '🧂'],
  [/น้ำแข็ง|ນ້ຳກ້ອນ|ice/i, '🧊'],
  [/ผลไม้|ໝາກໄມ້|fruit/i, '🍊'],
  [/ข้าว|แป้ง|ເຂົ້າ|rice|flour/i, '🍚'],
  [/ทะเล|ທະເລ|seafood/i, '🦐']
];

export function menuCategoryQuick(jsx, categories, selected, onSelect, name, locale) {
  if (!categories.length) return null;
  const label = locale === 'lo' ? 'ເລືອກໝວດໝູ່ດ່ວນ:' : locale === 'en' ? 'Quick categories:' : 'เลือกหมวดหมู่ด่วน:';
  return jsx.jsxs('div', {className:'menu-category-quick', role:'group', 'aria-label':label, children:[
    jsx.jsx('p', {className:'menu-category-quick-label', children:label}),
    jsx.jsx('div', {className:'menu-category-quick-options', children:categories.slice(0, 8).map(category => {
      const title = name(category, locale);
      const icon = icons.find(([pattern]) => pattern.test(title))?.[1] || '🍽️';
      return jsx.jsxs('button', {type:'button', 'aria-pressed':selected === category.id, onClick:() => onSelect(category.id), children:[
        jsx.jsx('span', {'aria-hidden':true, children:icon}),
        jsx.jsx('span', {children:title})
      ]}, category.id);
    })})
  ]});
}
