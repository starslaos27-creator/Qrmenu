import LanguageControl from "../../shared/i18n/LanguageControl";
import { useLanguage, type Locale } from "../../shared/i18n/LanguageProvider";
import diningBanner from "../../assets/star-restaurant/qr-dining-banner.png";
import papayaSalad from "../../assets/star-restaurant/papaya-salad.jpg";

const messages: Record<Locale, {
  home: string; menu: string; promotions: string; about: string; contact: string; login: string;
  badge: string; headline: string; headlineAccent: string; intro: string; explore: string;
  offerTag: string; offerTitle: string; offerDescription: string; offerButton: string;
  menuTitle: string; menuDescription: string; dishesTitle: string; dishes: [string, string, string];
  stepsTitle: string; steps: [string, string, string]; aboutTitle: string; aboutText: string; contactText: string;
}> = {
  th: {
    home: "หน้าหลัก", menu: "เมนูอาหาร", promotions: "โปรโมชั่น", about: "เกี่ยวกับเรา", contact: "ติดต่อเรา", login: "Login",
    badge: "รสชาติที่คิดถึง เสิร์ฟด้วยใจทุกจาน", headline: "อร่อยทุกคำ", headlineAccent: "สดใหม่ทุกวัน",
    intro: "แวะมาสัมผัสอาหารจานโปรด วัตถุดิบคุณภาพ และบรรยากาศอบอุ่นที่ STAR Restaurant",
    explore: "ดูเมนูแนะนำ", offerTag: "โปรโมชั่นพิเศษ", offerTitle: "มื้ออร่อย คุ้มกว่าเดิม",
    offerDescription: "เลือกเมนูโปรดจากวัตถุดิบสดใหม่ พร้อมข้อเสนอพิเศษที่ STAR Restaurant คัดสรรให้คุณ",
    offerButton: "เลือกเมนูวันนี้", menuTitle: "เมนูที่อยากชวนให้ลอง", menuDescription: "อาหารจานโปรด ปรุงสดใหม่ทุกวัน",
    dishesTitle: "อร่อยครบทุกสไตล์", dishes: ["ส้มตำไทย", "ซีฟู้ดสดใหม่", "อาหารจานพิเศษ"],
    stepsTitle: "สั่งอาหารง่าย ๆ ด้วย QR Code", steps: ["สแกน QR Code ที่โต๊ะ", "เลือกอาหารจานโปรด", "ยืนยันรายการ แล้วรอรับอาหาร"],
    aboutTitle: "ยินดีต้อนรับสู่ STAR Restaurant", aboutText: "เราใส่ใจในทุกจาน เพื่อให้ทุกมื้อของคุณเต็มไปด้วยรสชาติและความประทับใจ",
    contactText: "แวะมาหาเรา แล้วให้อาหารจานโปรดทำให้วันของคุณพิเศษขึ้น",
  },
  lo: {
    home: "ໜ້າຫຼັກ", menu: "ເມນູອາຫານ", promotions: "ໂປຣໂມຊັນ", about: "ກ່ຽວກັບຮ້ານ", contact: "ຕິດຕໍ່", login: "Login",
    badge: "ລົດຊາດທີ່ຄິດຮອດ ປຸງດ້ວຍໃຈທຸກຈານ", headline: "ແຊບທຸກຄຳ", headlineAccent: "ສົດໃໝ່ທຸກມື້",
    intro: "ມາລອງອາຫານຈານໂປດ ວັດຖຸດິບຄຸນນະພາບ ແລະ ບັນຍາກາດອົບອຸ່ນທີ່ STAR Restaurant",
    explore: "ເບິ່ງເມນູແນະນຳ", offerTag: "ໂປຣໂມຊັນພິເສດ", offerTitle: "ມື້ແຊບ ຄຸ້ມກວ່າເກົ່າ",
    offerDescription: "ເລືອກເມນູຈາກວັດຖຸດິບສົດໃໝ່ ພ້ອມຂໍ້ສະເໜີພິເສດຈາກ STAR Restaurant",
    offerButton: "ເລືອກເມນູມື້ນີ້", menuTitle: "ເມນູທີ່ຢາກໃຫ້ລອງ", menuDescription: "ອາຫານຈານໂປດ ປຸງສົດໃໝ່ທຸກມື້",
    dishesTitle: "ແຊບຄົບທຸກແບບ", dishes: ["ຕຳໝາກຫຸ່ງໄທ", "ອາຫານທະເລສົດ", "ເມນູພິເສດ"],
    stepsTitle: "ສັ່ງອາຫານງ່າຍໆ ດ້ວຍ QR Code", steps: ["ສະແກນ QR Code ທີ່ໂຕະ", "ເລືອກອາຫານຈານໂປດ", "ຢືນຢັນລາຍການ ແລ້ວລໍຖ້າຮັບອາຫານ"],
    aboutTitle: "ຍິນດີຕ້ອນຮັບສູ່ STAR Restaurant", aboutText: "ພວກເຮົາໃສ່ໃຈທຸກຈານ ເພື່ອໃຫ້ທຸກຄາບຂອງທ່ານເຕັມໄປດ້ວຍລົດຊາດທີ່ປະທັບໃຈ",
    contactText: "ແວ່ມາຫາພວກເຮົາ ແລ້ວໃຫ້ອາຫານຈານໂປດເຮັດໃຫ້ມື້ຂອງທ່ານພິເສດຂຶ້ນ",
  },
  en: {
    home: "Home", menu: "Menu", promotions: "Promotions", about: "About us", contact: "Contact", login: "Login",
    badge: "The flavors you love, made with care", headline: "Made to savor", headlineAccent: "Fresh every day",
    intro: "Enjoy your favorite dishes, quality ingredients, and a warm welcome at STAR Restaurant.",
    explore: "Explore the menu", offerTag: "Special offer", offerTitle: "A better deal for every meal",
    offerDescription: "Discover fresh favorites and special offers, thoughtfully selected by STAR Restaurant.",
    offerButton: "See today's menu", menuTitle: "Made for your cravings", menuDescription: "Freshly prepared favorites, every day.",
    dishesTitle: "Something for every taste", dishes: ["Thai papaya salad", "Fresh seafood", "Chef's special"],
    stepsTitle: "Order easily with QR Code", steps: ["Scan the QR Code at your table", "Choose your favorite dishes", "Confirm your order and enjoy"],
    aboutTitle: "Welcome to STAR Restaurant", aboutText: "We care about every plate, making each visit full of flavor and warmth.",
    contactText: "Visit us and make your day a little more delicious.",
  },
  ko: {
    home: "홈", menu: "메뉴", promotions: "프로모션", about: "소개", contact: "문의", login: "Login",
    badge: "그리운 맛, 정성을 담아 한 접시씩", headline: "한 입의 즐거움", headlineAccent: "매일 신선하게",
    intro: "STAR Restaurant에서 좋아하는 음식과 좋은 재료, 따뜻한 분위기를 만나보세요.",
    explore: "추천 메뉴 보기", offerTag: "특별 프로모션", offerTitle: "더 만족스러운 한 끼",
    offerDescription: "신선한 인기 메뉴와 STAR Restaurant이 준비한 특별 혜택을 만나보세요.",
    offerButton: "오늘의 메뉴 보기", menuTitle: "추천 메뉴", menuDescription: "매일 신선하게 준비하는 인기 메뉴",
    dishesTitle: "다양한 맛을 한곳에서", dishes: ["태국식 파파야 샐러드", "신선한 해산물", "오늘의 특별 메뉴"],
    stepsTitle: "QR 코드로 간편하게 주문", steps: ["테이블 QR 코드를 스캔하세요", "좋아하는 메뉴를 고르세요", "주문을 확인하고 기다리세요"],
    aboutTitle: "STAR Restaurant에 오신 것을 환영합니다", aboutText: "정성을 담은 한 접시로 매 방문을 맛있고 따뜻하게 만들어 드립니다.",
    contactText: "방문하셔서 오늘을 더 맛있게 만들어 보세요.",
  },
  vi: {
    home: "Trang chủ", menu: "Thực đơn", promotions: "Ưu đãi", about: "Giới thiệu", contact: "Liên hệ", login: "Login",
    badge: "Hương vị thân quen, chăm chút trong từng món", headline: "Ngon trọn vị", headlineAccent: "Tươi mới mỗi ngày",
    intro: "Thưởng thức món yêu thích, nguyên liệu chất lượng và không gian ấm áp tại STAR Restaurant.",
    explore: "Xem món nổi bật", offerTag: "Ưu đãi đặc biệt", offerTitle: "Bữa ngon, thêm tiết kiệm",
    offerDescription: "Khám phá món ngon tươi mới cùng ưu đãi được STAR Restaurant chọn riêng cho bạn.",
    offerButton: "Xem thực đơn hôm nay", menuTitle: "Món ngon mời bạn thử", menuDescription: "Món yêu thích, chế biến tươi mới mỗi ngày.",
    dishesTitle: "Đủ vị cho mọi sở thích", dishes: ["Gỏi đu đủ Thái", "Hải sản tươi", "Món đặc biệt"],
    stepsTitle: "Gọi món dễ dàng bằng QR Code", steps: ["Quét QR Code tại bàn", "Chọn món bạn yêu thích", "Xác nhận đơn và thưởng thức"],
    aboutTitle: "Chào mừng đến STAR Restaurant", aboutText: "Chúng tôi chăm chút từng món ăn để mỗi lần ghé thăm đều thật ngon miệng và ấm áp.",
    contactText: "Ghé thăm chúng tôi và làm ngày hôm nay thêm ngon miệng.",
  },
  zh: {
    home: "首页", menu: "菜单", promotions: "优惠活动", about: "关于我们", contact: "联系我们", login: "Login",
    badge: "熟悉的美味，用心呈现每一盘", headline: "每一口都美味", headlineAccent: "每日新鲜制作",
    intro: "欢迎在 STAR Restaurant 品尝喜爱的菜品、优质食材与温馨氛围。",
    explore: "查看推荐菜单", offerTag: "特别优惠", offerTitle: "美味每餐，更加实惠",
    offerDescription: "精选新鲜人气菜品与 STAR Restaurant 为您准备的专属优惠。",
    offerButton: "查看今日菜单", menuTitle: "为您推荐的美味", menuDescription: "每日新鲜烹制的人气菜品。",
    dishesTitle: "多种风味任您选择", dishes: ["泰式木瓜沙拉", "新鲜海鲜", "主厨推荐"],
    stepsTitle: "扫描二维码，轻松点餐", steps: ["扫描桌上的二维码", "选择喜爱的菜品", "确认订单，等待美味上桌"],
    aboutTitle: "欢迎来到 STAR Restaurant", aboutText: "我们用心烹制每一道菜，让每次到访都充满美味与温暖。",
    contactText: "欢迎光临，让今天多一份美味。",
  },
};

const menuPhotos = [
  papayaSalad,
  "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85",
];

export default function Home() {
  const { locale } = useLanguage();
  const text = messages[locale];

  return <main className="min-h-screen scroll-smooth bg-[#fffaf0] text-[#173b2d]">
    <header className="sticky top-0 z-30 border-b border-[#e7dcc7] bg-[#fffdf8]/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-3 sm:px-8">
        <a href="#home" className="flex shrink-0 items-center gap-3" aria-label="STAR Restaurant home">
          <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-[#e3b84f] bg-[#14543b] text-2xl text-[#ffd15d] shadow-md">★</span>
          <span className="leading-[0.95]"><strong className="block text-[23px] font-black tracking-tight text-[#14543b]">STAR</strong><small className="mt-1 block font-serif text-[13px] font-bold italic text-[#a46024]">Restaurant</small></span>
        </a>
        <nav className="order-3 flex w-full items-center gap-5 overflow-x-auto text-xs font-bold text-[#4f5c53] sm:order-none sm:w-auto sm:flex-1 sm:justify-center sm:gap-5 lg:gap-8 lg:text-sm" aria-label="Main navigation">
          <a className="whitespace-nowrap text-[#14543b] hover:text-[#b97b17]" href="#home">⌂ &nbsp;{text.home}</a>
          <a className="whitespace-nowrap hover:text-[#b97b17]" href="#menu">♜ &nbsp;{text.menu}</a>
          <a className="whitespace-nowrap hover:text-[#b97b17]" href="#promotions">✦ &nbsp;{text.promotions}</a>
          <a className="whitespace-nowrap hover:text-[#b97b17]" href="#about">◈ &nbsp;{text.about}</a>
          <a className="whitespace-nowrap hover:text-[#b97b17]" href="#contact">☎ &nbsp;{text.contact}</a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageControl inline />
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full bg-[#12613f] px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-[#14543b]/20 transition hover:bg-[#0d5035] sm:px-5"><span aria-hidden="true">♟</span>{text.login}<span className="text-xs transition group-open:rotate-180">⌄</span></summary>
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-[#e6dcc8] bg-white p-2 text-sm shadow-xl">
              <a href="/login" className="block rounded-xl px-3 py-2.5 font-bold text-[#174a34] hover:bg-[#f3f7f3]">{text.login} · STAR Restaurant</a>
            </div>
          </details>
        </div>
      </div>
    </header>

    <section id="home" className="relative isolate flex min-h-[690px] items-center overflow-hidden bg-[#18372a] px-5 py-14 text-white sm:px-8 lg:min-h-[calc(100svh-76px)] lg:py-16">
      <img src={diningBanner} alt="ลูกค้ากำลังสั่งอาหารด้วย QR Code ภายในร้านอาหาร" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#071d14]/90 via-[#102a1e]/65 to-[#102a1e]/15" />
      <div className="mx-auto grid w-full max-w-[1440px] items-center gap-10 lg:grid-cols-[1fr_0.8fr] lg:gap-16">
        <div className="max-w-[650px] py-7 lg:pl-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#ffd66b]/40 bg-[#133c2c]/75 px-4 py-2 text-xs font-extrabold text-[#ffdb7b] shadow-lg backdrop-blur"><span className="h-2 w-2 rounded-full bg-[#f8bd42]" />{text.badge}</p>
          <h1 className="mt-6 text-[clamp(3.1rem,6.1vw,5.8rem)] font-black leading-[1.02] tracking-[-0.045em] drop-shadow-[0_4px_16px_rgba(0,0,0,.4)]"><span className="block">{text.headline}</span><span className="mt-2 block text-[#ffc84c]">{text.headlineAccent}</span></h1>
          <p className="mt-6 max-w-xl text-base font-medium leading-8 text-white/90 drop-shadow sm:text-lg">{text.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#menu" className="rounded-full bg-[#f6bd45] px-6 py-3.5 text-sm font-black text-[#193c2c] shadow-xl transition hover:-translate-y-0.5 hover:bg-[#ffd36b]">{text.explore} <span aria-hidden="true">→</span></a>
            <a href="#promotions" className="rounded-full border border-white/60 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">{text.promotions}</a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-white/85 sm:text-sm"><span>✓ สดใหม่ทุกวัน</span><span>✓ วัตถุดิบคุณภาพ</span><span>✓ สั่งง่ายผ่าน QR</span></div>
        </div>
        <div className="relative mx-auto w-full max-w-[470px] lg:mr-8">
          <div className="absolute -right-4 -top-5 z-10 rounded-2xl bg-[#e3432e] px-4 py-2 text-sm font-black text-white shadow-xl shadow-black/20 sm:-right-7 sm:-top-6 sm:px-5 sm:py-3">{text.offerTag}<span className="ml-2 text-[#ffe18b]">★</span></div>
          <div className="overflow-hidden rounded-[30px] border border-white/70 bg-[#fffaf0] p-3 shadow-[0_28px_80px_rgba(0,0,0,.4)] sm:p-4">
            <img src={papayaSalad} alt="ส้มตำไทยจานสดใหม่" className="h-[280px] w-full rounded-[22px] object-cover sm:h-[330px]" />
            <div className="flex items-end justify-between gap-4 px-2 pb-2 pt-4 text-[#173b2d]">
              <div><span className="text-xs font-extrabold uppercase tracking-widest text-[#ad7223]">STAR recommendation</span><h2 className="mt-1 text-xl font-black sm:text-2xl">{text.dishes[0]}</h2><p className="mt-1 text-xs text-[#68766d]">{text.offerDescription}</p></div>
              <a href="#promotions" aria-label={text.offerButton} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#14543b] text-xl font-black text-white shadow-lg transition hover:scale-105">→</a>
            </div>
          </div>
          <span className="absolute -bottom-5 -left-5 rounded-2xl bg-[#f6bd45] px-4 py-2 text-xs font-black text-[#193c2c] shadow-xl">Fresh · Tasty · STAR</span>
        </div>
      </div>
    </section>

    <section id="menu" className="scroll-mt-24 bg-[#fffaf0] px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><span className="text-xs font-black uppercase tracking-[0.2em] text-[#b27625]">STAR menu</span><h2 className="mt-2 text-3xl font-black text-[#14543b] sm:text-4xl">{text.menuTitle}</h2><p className="mt-2 text-sm text-[#70776f]">{text.menuDescription}</p></div><span className="rounded-full bg-[#e7f0e7] px-4 py-2 text-xs font-bold text-[#14543b]">{text.dishesTitle}</span></div>
        <div className="grid gap-5 md:grid-cols-3">{text.dishes.map((dish, index) => <article key={dish} className="group overflow-hidden rounded-[24px] border border-[#e8dfcf] bg-white shadow-[0_12px_30px_rgba(32,53,36,.07)] transition hover:-translate-y-1 hover:shadow-xl"><div className="relative overflow-hidden"><img src={menuPhotos[index]} alt={dish} className="h-56 w-full object-cover transition duration-500 group-hover:scale-105"/><span className="absolute left-4 top-4 rounded-full bg-[#fffaf0]/95 px-3 py-1.5 text-[11px] font-black text-[#14543b]">{index === 0 ? text.offerTag : "STAR menu"}</span></div><div className="p-5"><h3 className="text-lg font-extrabold text-[#193a2f]">{dish}</h3><p className="mt-1 text-sm text-[#778078]">{text.menuDescription}</p><a href="#promotions" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#b27625] hover:text-[#14543b]">{text.explore} <span>→</span></a></div></article>)}</div>
      </div>
    </section>

    <section id="promotions" className="scroll-mt-24 bg-[#173e2d] px-5 py-14 text-white sm:px-8 lg:py-16">
      <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1fr_auto]">
        <div><span className="text-xs font-black uppercase tracking-[0.2em] text-[#ffd16a]">{text.offerTag}</span><h2 className="mt-2 text-3xl font-black sm:text-4xl">{text.offerTitle}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">{text.offerDescription}</p><a href="#menu" className="mt-6 inline-flex rounded-full bg-[#f6bd45] px-5 py-3 text-sm font-black text-[#193c2c] transition hover:bg-[#ffd36b]">{text.offerButton} →</a></div>
        <div className="grid h-28 w-28 place-items-center rounded-full border border-[#ffd16a]/50 bg-[#ffd16a]/10 text-center text-3xl text-[#ffd16a] shadow-[0_0_50px_rgba(255,209,106,.18)] sm:h-36 sm:w-36">★<span className="text-[10px] font-black uppercase tracking-widest">STAR</span></div>
      </div>
    </section>

    <section className="bg-[#f2ebdf] px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl"><h2 className="text-center text-3xl font-black text-[#14543b] sm:text-4xl">{text.stepsTitle}</h2><div className="mt-9 grid gap-4 md:grid-cols-3">{text.steps.map((step, i) => <article key={step} className="rounded-2xl border border-[#e4dac8] bg-white p-6 text-center shadow-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#14543b] text-lg font-black text-[#ffd16a]">{i + 1}</span><p className="mt-4 text-sm font-bold text-[#254737]">{step}</p></article>)}</div></div>
    </section>

    <section id="about" className="scroll-mt-24 bg-white px-5 py-14 text-center sm:px-8 lg:py-16"><div className="mx-auto max-w-3xl"><span className="text-xs font-black uppercase tracking-[0.2em] text-[#b27625]">STAR Restaurant</span><h2 className="mt-2 text-3xl font-black text-[#14543b]">{text.aboutTitle}</h2><p className="mt-4 text-sm leading-7 text-[#69756d]">{text.aboutText}</p></div></section>
    <footer id="contact" className="scroll-mt-24 bg-[#102a20] px-5 py-8 text-white sm:px-8"><div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-lg font-black">STAR Restaurant</strong><p className="mt-1 text-sm text-white/70">{text.contactText}</p></div><a href="/login" className="inline-flex w-fit rounded-full border border-[#ffd16a]/60 px-5 py-2.5 text-sm font-bold text-[#ffd16a] transition hover:bg-[#ffd16a] hover:text-[#173e2d]">{text.login} →</a></div></footer>
  </main>;
}
