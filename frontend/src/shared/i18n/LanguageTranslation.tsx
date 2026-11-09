import { useEffect, useRef, type RefObject } from "react";
import th from "../../../i18n/th.json";
import lo from "../../../i18n/lo.json";
import en from "../../../i18n/en.json";
import ko from "../../../i18n/ko.json";
import vi from "../../../i18n/vi.json";
import zh from "../../../i18n/zh.json";
import { useLanguage, type Locale } from "./LanguageProvider";

const dictionaries: Record<Locale, Record<string, string>> = { th, lo, en, ko, vi, zh };
const translatedAttributes = ["placeholder", "title", "aria-label"] as const;

/** Applies the same locale dictionary to old screens still rendered in the same-origin legacy iframe. */
export default function LanguageTranslation({ frameRef }: { frameRef?: RefObject<HTMLIFrameElement | null> }) {
  const { locale } = useLanguage();
  const textState = useRef(new WeakMap<Text, { source: string; translated: string }>()).current;
  const attrState = useRef(new WeakMap<Element, Map<string, { source: string; translated: string }>>()).current;

  useEffect(() => {
    const sourceToTarget = new Map<string, string>();
    const templateTranslations: Array<{ pattern: RegExp; target: string; names: string[] }> = [];
    const source = dictionaries.th;
    const target = dictionaries[locale];
    for (const [key, thaiText] of Object.entries(source)) {
      if (!thaiText) continue;
      const translated = target[key] ?? thaiText;
      if (!sourceToTarget.has(thaiText)) sourceToTarget.set(thaiText, translated);
      const normalized = normalizeText(thaiText);
      if (!sourceToTarget.has(normalized)) sourceToTarget.set(normalized, translated);
      const placeholders = [...thaiText.matchAll(/\{(\w+)\}/g)];
      if (placeholders.length && translated !== thaiText) {
        const parts = thaiText.split(/\{\w+\}/g).map(escapeRegExp);
        const expression = parts.map((part, index) => index < placeholders.length ? `${part}([\\s\\S]+?)` : part).join("");
        templateTranslations.push({ pattern: new RegExp(`^${expression}$`), target: translated, names: placeholders.map((match) => match[1]) });
      }
    }

    const translateValue = (value: string) => {
      const exact = sourceToTarget.get(value);
      if (exact) return exact;
      const normalized = normalizeText(value);
      const direct = sourceToTarget.get(normalized);
      if (direct) return direct;

      for (const template of templateTranslations) {
        const match = normalized.match(template.pattern);
        if (!match) continue;
        return template.target.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
          const index = template.names.indexOf(name);
          return index >= 0 ? match[index + 1] : placeholder;
        });
      }

      // Old navigation sometimes renders its icon and label in one text node.
      // Preserve that decoration while looking up the actual Thai/Lao label.
      const decorated = normalized.match(/^([\p{P}\p{S}]*\s*)([\p{L}\p{M}\p{N}].*?)(\s*[\p{P}\p{S}]*)$/u);
      if (decorated) {
        const translated = sourceToTarget.get(normalizeText(decorated[2]));
        if (translated) return `${decorated[1]}${translated}${decorated[3]}`;
      }
      return value;
    };

    const observers: MutationObserver[] = [];
    const listeners: Array<() => void> = [];

    const translateRoot = (root: Document | HTMLElement) => {
      const translateText = (node: Text) => {
        const parent = node.parentElement;
        if (!parent || parent.closest("[data-language-ui],script,style,noscript,textarea,code,pre")) return;
        const prior = textState.get(node);
        const current = node.nodeValue ?? "";
        const original = prior && current === prior.translated ? prior.source : current;
        const trimmed = original.trim();
        const cleanSource = normalizeLegacyText(trimmed);
        const translated = translateValue(cleanSource);
        const completeTranslation = translated === cleanSource ? translateDynamicText(cleanSource, locale) : translated;
        const next = original.replace(trimmed, completeTranslation);
        textState.set(node, { source: original, translated: next });
        if (current !== next) node.nodeValue = next;
      };

      const translateElement = (element: Element) => {
        if (element.closest("[data-language-ui]")) return;
        let states = attrState.get(element);
        for (const attribute of translatedAttributes) {
          if (!element.hasAttribute(attribute)) continue;
          const current = element.getAttribute(attribute) ?? "";
          const prior = states?.get(attribute);
          const original = prior && current === prior.translated ? prior.source : current;
          const trimmed = original.trim();
          const cleanSource = normalizeLegacyText(trimmed);
          const translated = translateValue(cleanSource);
          const completeTranslation = translated === cleanSource ? translateDynamicText(cleanSource, locale) : translated;
          const next = original.replace(trimmed, completeTranslation);
          if (!states) { states = new Map(); attrState.set(element, states); }
          states.set(attribute, { source: original, translated: next });
          if (current !== next) element.setAttribute(attribute, next);
        }
      };

      const walker = (root.nodeType === Node.DOCUMENT_NODE ? root as Document : root.ownerDocument!).createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) translateText(walker.currentNode as Text);
      if (root.nodeType === Node.ELEMENT_NODE) translateElement(root as Element);
      root.querySelectorAll("*").forEach(translateElement);
    };

    const observe = (documentRoot: Document) => {
      if (!documentRoot.body) return;
      translateRoot(documentRoot);
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "characterData") translateRoot(record.target.parentElement ?? documentRoot.body!);
          else if (record.type === "attributes") translateRoot(record.target as HTMLElement);
          else for (const node of record.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) translateRoot(node as HTMLElement);
            else if (node.nodeType === Node.TEXT_NODE && node.parentElement) translateRoot(node.parentElement);
          }
        }
      });
      observer.observe(documentRoot.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...translatedAttributes] });
      observers.push(observer);
    };

    observe(document);
    // Start empty so findFrame always installs the load listener even when React
    // committed the lazy legacy iframe before this effect ran.
    let frame: HTMLIFrameElement | null = null;
    const observeFrame = () => {
      try {
        if (frame?.contentDocument) observe(frame.contentDocument);
        frame?.contentWindow?.postMessage({ type: "shopqr:set-locale", locale }, window.location.origin);
      } catch { /* Cross-origin frames are intentionally left untouched. */ }
    };
    const findFrame = () => {
      const next = frameRef?.current ?? document.querySelector<HTMLIFrameElement>('iframe[title="ShopQR restaurant and customer application"]');
      if (next === frame) return;
      if (frame) frame.removeEventListener("load", observeFrame);
      frame = next;
      if (frame) {
        frame.addEventListener("load", observeFrame);
        observeFrame();
      }
    };
    findFrame();
    const frameWatcher = new MutationObserver(findFrame);
    frameWatcher.observe(document.documentElement, { childList: true, subtree: true });
    observers.push(frameWatcher);
    listeners.push(() => { if (frame) frame.removeEventListener("load", observeFrame); });

    return () => {
      observers.forEach((observer) => observer.disconnect());
      listeners.forEach((remove) => remove());
    };
  }, [locale, frameRef]);

  return null;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeLegacyText(value: string) {
  return value.replace(/[\u0080-\u00ff\u0152\u0153\u0178\u017d\u20ac\u2010-\u2027\u2030\u203a]+/g, (fragment) => {
    const bytes: number[] = [];
    for (const character of fragment) {
      const point = character.codePointAt(0)!;
      const byte = cp1252Bytes.get(point) ?? (point <= 0xff ? point : undefined);
      if (byte === undefined) return fragment;
      bytes.push(byte);
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    } catch {
      return fragment;
    }
  }).replace(/\\+([{}"'])/g, "$1");
}

const cp1252Bytes = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function translateDynamicText(text: string, locale: Locale) {
  if (locale === "th") return text;
  const en = locale !== "lo";
  const matchDynamic = (pattern: RegExp, render: (match: RegExpMatchArray) => string) => {
    const match = text.match(pattern);
    return match ? render(match) : null;
  };
  const errorPrefixes: Record<string, [string, string]> = {
    "เปลี่ยนสถานะ": ["Could not change status", "ປ່ຽນສະຖານະບໍ່ສຳເລັດ"],
    "ยกเลิกออเดอร์": ["Could not cancel order", "ຍົກເລີກອໍເດີບໍ່ສຳເລັດ"],
    "บันทึกรายการ": ["Could not save item", "ບັນທຶກລາຍການບໍ່ສຳເລັດ"],
    "โหลดรายการครัว": ["Could not load kitchen orders", "ໂຫຼດລາຍການຄົວບໍ່ສຳເລັດ"],
    "โหลดข้อมูลครัว": ["Could not load kitchen data", "ໂຫຼດຂໍ້ມູນຄົວບໍ່ສຳເລັດ"],
    "โหลดโปรโมชั่น": ["Could not load promotions", "ໂຫຼດໂປຣໂມຊັນບໍ່ສຳເລັດ"],
    "บันทึกโปรโมชั่น": ["Could not save promotion", "ບັນທຶກໂປຣໂມຊັນບໍ່ສຳເລັດ"],
    "เปลี่ยนรหัสผ่าน": ["Could not change password", "ປ່ຽນລະຫັດຜ່ານບໍ່ສຳເລັດ"],
    "อัปโหลด": ["Upload failed", "ອັບໂຫຼດບໍ່ສຳເລັດ"],
    "ลบรูป": ["Could not delete image", "ລຶບຮູບບໍ່ສຳເລັດ"],
    "โหลดการตั้งค่า": ["Could not load settings", "ໂຫຼດການຕັ້ງຄ່າບໍ່ສຳເລັດ"],
    "โหลดลิงก์เชิญ": ["Could not load invitation links", "ໂຫຼດລິ້ງເຊີນບໍ່ສຳເລັດ"],
    "สร้างลิงก์เชิญ": ["Could not create invitation link", "ສ້າງລິ້ງເຊີນບໍ່ສຳເລັດ"],
    "นำสมาชิกออก": ["Could not remove member", "ນຳສະມາຊິກອອກບໍ່ສຳເລັດ"],
    "เพิ่มหมวดหมู่": ["Could not add category", "ເພີ່ມໝວດໝູ່ບໍ່ສຳເລັດ"],
    "จัดลำดับ": ["Could not reorder", "ຈັດລຳດັບບໍ່ສຳເລັດ"],
    "บันทึก": ["Could not save", "ບັນທຶກບໍ່ສຳເລັດ"],
    "ลบ": ["Could not delete", "ລຶບບໍ່ສຳເລັດ"],
  };
  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^บัญชี (.+)$/, (m) => en ? `Account ${m[1]}` : `ບັນຊີ ${m[1]}`],
    [/^รายรับ (.+)$/, (m) => en ? `Income ${m[1]}` : `ລາຍຮັບ ${m[1]}`],
    [/^ค่าใช้จ่ายและต้นทุน (.+)$/, (m) => en ? `Expenses and costs ${m[1]}` : `ລາຍຈ່າຍ ແລະ ຕົ້ນທຶນ ${m[1]}`],
    [/^รายจ่ายและต้นทุน (.+)$/, (m) => en ? `Expenses and costs ${m[1]}` : `ລາຍຈ່າຍ ແລະ ຕົ້ນທຶນ ${m[1]}`],
    [/^รายจ่ายวันนี้ (.+)$/, (m) => en ? `Today's expenses ${m[1]}` : `ລາຍຈ່າຍມື້ນີ້ ${m[1]}`],
    [/^ต้นทุน (.+)$/, (m) => en ? `Cost ${m[1]}` : `ຕົ້ນທຶນ ${m[1]}`],
    [/^ยอดจริง (.+)$/, (m) => en ? `Actual amount ${m[1]}` : `ຍອດຈິງ ${m[1]}`],
    [/^ค่าบริการ (.+)$/, (m) => en ? `Service charge ${m[1]}` : `ຄ່າບໍລິການ ${m[1]}`],
    [/^ขาด (\d+) รายการ$/, (m) => en ? `${m[1]} items missing` : `ຂາດ ${m[1]} ລາຍການ`],
    [/^(\d+) วัตถุดิบ$/, (m) => en ? `${m[1]} ingredients` : `${m[1]} ວັດຖຸດິບ`],
    [/^เพิ่มอีก · (\d+)$/, (m) => en ? `Add more · ${m[1]}` : `ເພີ່ມອີກ · ${m[1]}`],
    [/^(.+) ออเดอร์ชำระแล้ว$/, (m) => en ? `${m[1]} paid orders` : `${m[1]} ອໍເດີຊຳລະແລ້ວ`],
    [/^(.+) โต๊ะค้างชำระวันนี้$/, (m) => en ? `${m[1]} tables with unpaid bills today` : `${m[1]} ໂຕະຄ້າງຊຳລະມື້ນີ້`],
    [/^ · โต๊ะ (.+)$/, (m) => en ? ` · Table ${m[1]}` : ` · ໂຕະ ${m[1]}`],
    [/^อัปเดตล่าสุด (.+)$/, (m) => en ? `Last updated ${m[1]}` : `ອັບເດດຫຼ້າສຸດ ${m[1]}`],
    [/^แสดง (.+) ถึง (.+)$/, (m) => en ? `Showing ${m[1]} to ${m[2]}` : `ສະແດງ ${m[1]} ຫາ ${m[2]}`],
    [/^ออเดอร์โต๊ะ (.+)$/, (m) => en ? `Table ${m[1]} order` : `ອໍເດີໂຕະ ${m[1]}`],
    [/^ลบโต๊ะ (.+) ใช่ไหม\?$/, (m) => en ? `Delete table ${m[1]}?` : `ລຶບໂຕະ ${m[1]} ບໍ?`],
    [/^ลบโซน (.+) ใช่ไหม\?$/, (m) => en ? `Delete zone ${m[1]}?` : `ລຶບໂຊນ ${m[1]} ບໍ?`],
    [/^ลบโซน (.+)$/, (m) => en ? `Delete zone ${m[1]}` : `ລຶບໂຊນ ${m[1]}`],
    [/^เลื่อน (.+) ขึ้น$/, (m) => en ? `Move ${m[1]} up` : `ຍ້າຍ ${m[1]} ຂຶ້ນ`],
    [/^เลื่อน (.+) ลง$/, (m) => en ? `Move ${m[1]} down` : `ຍ້າຍ ${m[1]} ລົງ`],
    [/^แก้ชื่อ (.+)$/, (m) => en ? `Rename ${m[1]}` : `ປ່ຽນຊື່ ${m[1]}`],
    [/^ลบเมนู “(.+)” ใช่ไหม\?$/, (m) => en ? `Delete menu “${m[1]}”?` : `ລຶບເມນູ “${m[1]}” ບໍ?`],
    [/^ต้องการลบหมวดหมู่ “(.+)” หรือไม่\?$/, (m) => en ? `Delete category “${m[1]}”?` : `ຕ້ອງການລຶບໝວດໝູ່ “${m[1]}” ບໍ?`],
    [/^ต้องการลบโปรโมชั่น “(.+)” หรือไม่\?$/, (m) => en ? `Delete promotion “${m[1]}”?` : `ຕ້ອງການລຶບໂປຣໂມຊັນ “${m[1]}” ບໍ?`],
    [/^หมวดหมู่ “(.+)” มีเมนู (\d+) รายการ การลบจะลบเมนูเหล่านั้นด้วย ต้องการดำเนินการต่อหรือไม่\?$/, (m) => en ? `Category “${m[1]}” contains ${m[2]} menu items. Deleting it will also delete them. Continue?` : `ໝວດໝູ່ “${m[1]}” ມີເມນູ ${m[2]} ລາຍການ ການລຶບຈະລຶບເມນູເຫຼົ່ານັ້ນນຳ ດຳເນີນຕໍ່ບໍ?`],
    [/^สร้างโต๊ะสำเร็จ (\d+) โต๊ะ$/, (m) => en ? `Created ${m[1]} tables` : `ສ້າງໂຕະສຳເລັດ ${m[1]} ໂຕະ`],
    [/^ แถม (\d+) เดือน$/, (m) => en ? ` ${m[1]} bonus months` : ` ແຖມ ${m[1]} ເດືອນ`],
    [/^แถม (\d+) เดือน$/, (m) => en ? `${m[1]} bonus months` : `ແຖມ ${m[1]} ເດືອນ`],
    [/^ประหยัด (.+)%$/, (m) => en ? `Save ${m[1]}%` : `ປະຢັດ ${m[1]}%`],
    [/^⭐ โปรเหลือ (\d+) วัน (.+)$/, (m) => en ? `⭐ Pro: ${m[1]} days left ${m[2]}` : `⭐ Pro ເຫຼືອ ${m[1]} ມື້ ${m[2]}`],
    [/^ครบกำหนด (.+)$/, (m) => en ? `Expires ${m[1]}` : `ໝົດອາຍຸ ${m[1]}`],
    [/^ท่านได้ชำระแล้ว แพ็กเกจยังไม่หมดอายุ ใช้งานได้ถึง (.+)$/, (m) => en ? `Already paid. Your plan is active until ${m[1]}` : `ຊຳລະແລ້ວ ແພັກເກດໃຊ້ໄດ້ເຖິງ ${m[1]}`],
    [/^คัดลอกลิงก์นี้ด้วยตนเอง: (.+)$/, (m) => en ? `Copy this link manually: ${m[1]}` : `ສຳເນົາລິ້ງນີ້ດ້ວຍຕົນເອງ: ${m[1]}`],
    [/^นำ (.+) ออกจากร้านหรือไม่\?$/, (m) => en ? `Remove ${m[1]} from the shop?` : `ນຳ ${m[1]} ອອກຈາກຮ້ານບໍ?`],
    [/^(.+) · (Online|Offline · Last seen (.+)) · เปิดเมนูโปรไฟล์$/, (m) => en ? `${m[1]} · ${m[2]} · Open profile menu` : `${m[1]} · ${m[2] === "Online" ? "ອອນລາຍ" : `ອອບລາຍ · ເຫັນລ່າສຸດ ${m[3]}`} · ເປີດເມນູໂປຣໄຟລ໌`],
    [/^(.+) · (Online|Offline, last seen (.+)) · เปิดเมนูโปรไฟล์$/, (m) => en ? `${m[1]} · ${m[2]} · Open profile menu` : `${m[1]} · ${m[2] === "Online" ? "ອອນລາຍ" : `ອອບລາຍ · ເຫັນຫຼ້າສຸດ ${m[3]}`} · ເປີດເມນູໂປຣໄຟລ໌`],
    [/^Online$/, () => en ? "Online" : "ອອນລາຍ"],
    [/^Offline, last seen (.+)$/, (m) => en ? `Offline, last seen ${m[1]}` : `ອອບລາຍ · ເຫັນຫຼ້າສຸດ ${m[1]}`],
    [/^Offline · Last seen (.+)$/, (m) => en ? `Offline · Last seen ${m[1]}` : `ອອບລາຍ · ເຫັນລ່າສຸດ ${m[1]}`],
    [/^โปรเหลือ (\d+) วัน (.+)$/, (m) => en ? `Pro: ${m[1]} days left ${m[2]}` : `Pro ເຫຼືອ ${m[1]} ມື້ ${m[2]}`],
    [/^(วันจันทร์|วันอังคาร|วันพุธ|วันพฤหัสบดี|วันศุกร์|วันเสาร์|วันอาทิตย์) ช่วงที่ (\d+) เปิดใช้งาน$/, (m) => `${translateDay(m[1], locale)} ${en ? `slot ${m[2]} enabled` : `ຊ່ວງທີ ${m[2]} ເປີດໃຊ້ງານ`}`],
    [/^(วันจันทร์|วันอังคาร|วันพุธ|วันพฤหัสบดี|วันศุกร์|วันเสาร์|วันอาทิตย์) เวลาเปิดช่วงที่ (\d+)$/, (m) => `${translateDay(m[1], locale)} ${en ? `slot ${m[2]} opening time` : `ເວລາເປີດຊ່ວງທີ ${m[2]}`}`],
    [/^(วันจันทร์|วันอังคาร|วันพุธ|วันพฤหัสบดี|วันศุกร์|วันเสาร์|วันอาทิตย์) เวลาปิดช่วงที่ (\d+)$/, (m) => `${translateDay(m[1], locale)} ${en ? `slot ${m[2]} closing time` : `ເວລາປິດຊ່ວງທີ ${m[2]}`}`],
    [/^เพิ่มหมวดหมู่ไม่สำเร็จ \((.+)\)$/, (m) => en ? `Could not add category (${m[1]})` : `ເພີ່ມໝວດໝູ່ບໍ່ສຳເລັດ (${m[1]})`],
    [/^จัดลำดับไม่สำเร็จ \((.+)\)$/, (m) => en ? `Could not reorder (${m[1]})` : `ຈັດລຳດັບບໍ່ສຳເລັດ (${m[1]})`],
    [/^ส่งความคิดเห็นไม่สำเร็จ \((.+)\)$/, (m) => en ? `Could not send feedback (${m[1]})` : `ສົ່ງຄຳຄິດເຫັນບໍ່ສຳເລັດ (${m[1]})`],
    [/^ยืนยันรายการไม่สำเร็จ \((.+)\)$/, (m) => en ? `Could not confirm item (${m[1]})` : `ຢືນຢັນລາຍການບໍ່ສຳເລັດ (${m[1]})`],
    [/^แสดง (.+) ถึง (.+)$/, (m) => en ? `Showing ${m[1]} to ${m[2]}` : `ສະແດງ ${m[1]} ຫາ ${m[2]}`],
    [/^บันทึกไม่สำเร็จ \((.+)\)$/, (m) => en ? `Could not save (${m[1]})` : `ບັນທຶກບໍ່ສຳເລັດ (${m[1]})`],
    [/^ลบไม่สำเร็จ \((.+)\)$/, (m) => en ? `Could not delete (${m[1]})` : `ລຶບບໍ່ສຳເລັດ (${m[1]})`],
    [/^(.+?)ไม่สำเร็จ \((.+)\)$/, (m) => `${errorPrefixes[m[1]]?.[locale === "en" ? 0 : 1] ?? (en ? "Action failed" : "ດຳເນີນການບໍ່ສຳເລັດ")} (${m[2]})`],
  ];
  for (const [pattern, render] of patterns) {
    const translated = matchDynamic(pattern, render);
    if (translated) return translated;
  }
  const localizedDate = translateThaiDate(text, locale);
  if (localizedDate !== text) return localizedDate;
  let match = text.match(/^(\d+) รายการ • หน้า (\d+) \/ (\d+)$/);
  if (match) {
    return locale !== "lo"
      ? `${match[1]} records • Page ${match[2]} / ${match[3]}`
      : `${match[1]} ລາຍການ • ໜ້າ ${match[2]} / ${match[3]}`;
  }
  match = text.match(/^(\d+) ออเดอร์มีต้นทุนไม่ครบ กำไรหักเฉพาะต้นทุนที่ทราบ$/);
  if (match) {
    return locale !== "lo"
      ? `${match[1]} orders have incomplete costs. Profit includes known costs only.`
      : `${match[1]} ອໍເດີມີຕົ້ນທຶນບໍ່ຄົບ ກຳໄລຄິດສະເພາະຕົ້ນທຶນທີ່ຮູ້ແລ້ວ`;
  }
  return text;
}

function translateDay(day: string, locale: Locale) {
  const index = ["วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์", "วันอาทิตย์"].indexOf(day);
  const english = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const lao = ["ວັນຈັນ", "ວັນອັງຄານ", "ວັນພຸດ", "ວັນພະຫັດ", "ວັນສຸກ", "ວັນເສົາ", "ວັນອາທິດ"];
  return (locale === "lo" ? lao : english)[index] ?? day;
}

function translateThaiDate(text: string, locale: Locale) {
  const months: Record<string, [string, string]> = {
    "ม.ค.": ["Jan", "ມ.ກ."], มกราคม: ["January", "ມັງກອນ"],
    "ก.พ.": ["Feb", "ກ.ພ."], กุมภาพันธ์: ["February", "ກຸມພາ"],
    "มี.ค.": ["Mar", "ມ.ນ."], มีนาคม: ["March", "ມີນາ"],
    "เม.ย.": ["Apr", "ມ.ສ."], เมษายน: ["April", "ເມສາ"],
    "พ.ค.": ["May", "ພ.ພ."], พฤษภาคม: ["May", "ພຶດສະພາ"],
    "มิ.ย.": ["Jun", "ມິ.ຖ."], มิถุนายน: ["June", "ມິຖຸນາ"],
    "ก.ค.": ["Jul", "ກ.ລ."], กรกฎาคม: ["July", "ກໍລະກົດ"],
    "ส.ค.": ["Aug", "ສ.ຫ."], สิงหาคม: ["August", "ສິງຫາ"],
    "ก.ย.": ["Sep", "ກ.ຍ."], กันยายน: ["September", "ກັນຍາ"],
    "ต.ค.": ["Oct", "ຕ.ລ."], ตุลาคม: ["October", "ຕຸລາ"],
    "พ.ย.": ["Nov", "ພ.ຈ."], พฤศจิกายน: ["November", "ພະຈິກ"],
    "ธ.ค.": ["Dec", "ທ.ວ."], ธันวาคม: ["December", "ທັນວາ"],
  };
  let translated = text;
  for (const [thai, [english, lao]] of Object.entries(months)) {
    translated = translated.replaceAll(thai, locale === "lo" ? lao : english);
  }
  if (locale !== "lo") translated = translated.replace(/\b(25\d{2})\b/g, (year) => String(Number(year) - 543));
  return translated;
}
