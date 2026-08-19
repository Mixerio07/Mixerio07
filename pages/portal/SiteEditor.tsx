import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, RotateCcw } from "lucide-react";

// Структура по умолчанию = тексты, зашитые в лендинг (см. public/landing/index.html)
const DEFAULT: any = {
  hero: {
    label: "С 2015 года в энергетике. С 2024 — в цифровой инфраструктуре",
    title: "Проектирование и строительство объектов цифровой инфраструктуры<br><br><span></span>",
    desc: "Начинали с энергоснабжения промышленных объектов. Сегодня проектируем и строим ЦОДы, майнинг-фермы и ИИ-кластеры под ключ — от ТЭО до запуска.",
    stats: [
      { num: "18+", label: "Лет в энергетике" },
      { num: "50+", label: "ЦОД и майнинг-ферм" },
      { num: "110", label: "МВт суммарной мощности" },
      { num: "99,9%", label: "Uptime инфраструктуры" },
    ],
  },
  about: {
    title: "От энергоснабжения к цифровой инфраструктуре",
    text1: "11 лет назад мы начинали с проектирования и строительства энергоснабжения промышленных объектов — котельных, подстанций, ЛЭП. Прошли путь от бумажных чертежей до цифровых двойников.",
    text2: "Сегодня наша экспертиза — проектирование и строительство ЦОД, майнинг-ферм и ИИ-кластеров под ключ. Мы понимаем энергетику снизу вверх: от подстанции до ASIC-стойки. Это даёт нам преимущество перед другими IT-интеграторами.",
    features: [
      "Электроснабжение до 110 кВ под ключ",
      "Проектирование ЦОД и майнинг-ферм",
      "Тепло- и вентиляция для ASIC/GPU",
      "Монтаж и запуск за 90 дней",
    ],
  },
  servicesHeader: {
    label: "Инжиниринг",
    title: "Инфраструктура для цифровых активов",
    desc: "От подстанции до первой стойки: проектирование, строительство и запуск объектов для майнинга, ИИ и блокчейна",
  },
  services: [],
  itHeader: {
    label: "Цифровая трансформация",
    title: "IT-инфраструктура для цифровой экономики",
    desc: "Разработка и внедрение программно-аппаратных комплексов для майнинга, блокчейна и ИИ. От концепции до промышленной эксплуатации.",
  },
  it: [],
  projectsHeader: {
    label: "Портфолио",
    title: "Построенные объекты",
    desc: "ЦОД, майнинг-фермы и энергетические объекты, запущенные нашей командой",
  },
  projects: [],
  contacts: {
    ctaTitle: "Запустим вашу ферму",
    ctaDesc: "Рассчитаем ROI, подберём площадку и подготовим ТЭО для вашего объекта цифровой инфраструктуры",
    ctaBtn: "Получить расчёт",
    footerAddress: "ООО «КОНТЭК Инжиниринг»<br>\n195221, г. Санкт-Петербург,<br>\nКлючевая ул., д. 30, «THE OFFICE», оф. 305<br><br>\nТел.: (812) 249-91-15<br>\nE-mail: info@kontek.ru",
  },
};

// Полные дефолтные списки берём из лендинга — чтобы редактор открывался с ними
const DEFAULT_LISTS = {
  services: [
    { icon: "fa-bolt", title: "Электроснабжение для майнинга", desc: "Полный цикл подключения объектов к электрическим сетям напряжением до 110 кВ и сетям газоснабжения. От заявки в сетевую компанию до акта технологического присоединения.", items: ["Технологическое присоединение до 110 кВ", "Проектирование подстанций и РТП", "Увеличение мощности под ASIC-фермы", "Согласование с Ростехнадзором", "Ввод в эксплуатацию", "Постановка на учет объектов и внесение в соответствующие реестры"] },
    { icon: "fa-server", title: "Проектирование ЦОД и майнинг-ферм", desc: "Разработка проектной документации для ЦОД, майнинг-ферм и ИИ-кластеров с учётом требований к энергоэффективности и охлаждению.", items: ["ТЭО и концепция объекта", "Проект энергоснабжения", "Системы прецизионного охлаждения", "СКС и сети передачи данных"] },
    { icon: "fa-temperature-low", title: "Охлаждение и вентиляция", desc: "Проектирование и монтаж систем охлаждения для ASIC- и GPU-ферм. От иммерсионных систем до промышленных чиллеров.", items: ["Иммерсионное охлаждение ASIC", "Промышленные чиллеры и фанкойлы", "Системы горячего и холодного коридоров", "Системы мониторинга окружающей среды (СМОС) в реальном времени"] },
    { icon: "fa-hard-hat", title: "Строительство под ключ", desc: "Строительство и реконструкция объектов под ЦОД и майнинг-фермы. От нулевого цикла до ввода в эксплуатацию", items: ["Капитальное строительство и реконструкция", "Технологические присоединения к энергосетям", "Монтаж оборудования", "Установка ДГУ и ИБП"] },
    { icon: "fa-chart-line", title: "Энергоаудит и оптимизация", desc: "Аудит существующих объектов для снижения затрат на электроэнергию и повышения эффективности.", items: ["Энергетический паспорт объекта", "Анализ PUE и WUE", "Оптимизация тарифов на электроэнергию", "Программа энергоэффективности"] },
    { icon: "fa-shield-halved", title: "Информационная безопасность", desc: "Защита ИТ-инфраструктуры объектов критической информационной инфраструктуры. Соответствие 187-ФЗ и требованиям регуляторов.", items: ["Аудит ИБ и оценка рисков", "Защита периметра и СЗИ", "Соответствие 187-ФЗ, 244-ФЗ, 152-ФЗ", "Внедрение SIEM и SOC"] },
  ],
  it: [
    { badge: "Флагман", icon: "fa-server", title: "ЦОД и майнинг-фермы под ключ", desc: "Полный цикл создания объектов для добычи криптовалюты и обучения ИИ-моделей: от выбора площадки до запуска первой стойки.", items: ["ТЭО для выбора площадки", "Проектирование инженерных систем", "Системы бесперебойного питания и ДГУ", "Иммерсионное и воздушное охлаждение", "Монтаж стоек и коммутация", "Пусконаладка и ввод в эксплуатацию"] },
    { icon: "fa-bitcoin-sign", title: "Блокчейн-инфраструктура", desc: "Развёртывание нод, валидаторов и инфраструктуры для блокчейн-проектов. Локальные решения без зависимости от облаков.", items: ["Развёртывание нод и валидаторов", "Локальные блокчейн-сети", "Инфраструктура для DeFi-протоколов", "Мониторинг и резервирование нод", "Техническая поддержка 24/7"] },
    { icon: "fa-brain", title: "ИИ-кластеры и GPU-фермы", desc: "Проектирование и сборка вычислительных кластеров для обучения нейросетей и инференса ИИ-моделей.", items: ["Подбор GPU и конфигурация кластера", "Системы охлаждения GPU", "Оптимизация энергопотребления", "Интеграция с фреймворками PyTorch/TensorFlow", "Масштабирование под задачи заказчика"] },
    { icon: "fa-microchip", title: "АСУ ТП и мониторинг", desc: "Программно-аппаратные комплексы для диспетчеризации и удалённого управления объектами цифровой инфраструктуры.", items: ["SCADA-системы для ЦОД", "Узлы учёта электроэнергии с удалённой передачей", "Мониторинг температуры и влажности", "Автоматизация аварийного отключения", "Интеграция с пулами и майнинг-ПО"] },
    { icon: "fa-chart-line", title: "Бизнес-аналитика и инвестиции", desc: "Подготовка обоснований для инвесторов и банков. Расчёт ROI, сроков окупаемости и оптимальных тарифов.", items: ["ТЭО и бизнес-план майнинг-фермы", "Расчёт ROI и срока окупаемости", "Анализ энерготарифов по регионам", "Инвестиционные презентации", "Роадмап развития объекта"] },
    { icon: "fa-network-wired", title: "Сети и телекоммуникации", desc: "Проектирование и монтаж сетевой инфраструктуры для объектов с высокими требованиями к пропускной способности.", items: ["СКС категории 6A/7/8 для ЦОД", "Оптические магистрали 10/40/100 Гбит/с", "Резервирование каналов связи", "Wi-Fi и беспроводные сети предприятий", "Организация каналов приёма и передачи данных"] },
  ],
  projects: [
    { icon: "fa-server", title: "Технологическое присоединение электроустановок ПАО «НОВАТЭК» комплекс Усть-Луга.", desc: "Проектирование и строительство подводящих электрических сетей, от источника ПС 110/10 кВт до объекта. 16 МВт." },
    { icon: "fa-bolt", title: "ASIC-ферма 9,2 МВт, Красноярский край", desc: "Реконструкция промздания под майнинг-ферму на 6500 ASIC. Монтаж ДГУ, ИБП и системы горячего и холодного коридоров." },
    { icon: "fa-temperature-low", title: "GPU-кластер для ИИ, СПб", desc: "Сборка и запуск кластера из 128 GPU для обучения LLM. Система жидкостного охлаждения с PUE 1,15." },
    { icon: "fa-network-wired", title: "Блокчейн-ноды, дата-центр", desc: "Развёртывание инфраструктуры для 50+ валидаторов. Резервирование каналов, мониторинг uptime 99,99%." },
    { icon: "fa-industry", title: "Подстанция 110/10 кВ «Ниссан»", desc: "Классический энергопроект: прокладка КЛ-110 кВ и строительство ПС для промышленного объекта." },
    { icon: "fa-fire", title: "Реконструкция тепловых сетей (около 10 км)", desc: "Замена всех подводящих коммуникаций к котельным (газопровод, водопровод, канализация, электроснабжение)." },
    { icon: "fa-chart-line", title: "Электроснабжение Базы хоккейного клуба СКА.", desc: "Проектирование и строительство подводящих электрических сетей 10-0,4 кВ, 4 МВт." },
    { icon: "fa-shield-halved", title: "Защита КИИ", desc: "Внедрение комплекса СЗИ и SIEM для критической информационной инфраструктуры." },
  ],
};

function fullDefault() {
  const d = JSON.parse(JSON.stringify(DEFAULT));
  d.services = JSON.parse(JSON.stringify(DEFAULT_LISTS.services));
  d.it = JSON.parse(JSON.stringify(DEFAULT_LISTS.it));
  d.projects = JSON.parse(JSON.stringify(DEFAULT_LISTS.projects));
  d.gallery = [];
  return d;
}

const SECTIONS = [
  { id: "hero", label: "Главный экран" },
  { id: "about", label: "О компании" },
  { id: "services", label: "Услуги" },
  { id: "it", label: "IT-решения" },
  { id: "projects", label: "Проекты" },
  { id: "contacts", label: "CTA и контакты" },
];

const inputCls = "bg-slate-800 border-slate-700 text-sm";
const labelCls = "block text-xs text-slate-500 mb-1";

function Field({ label, value, onChange, area }: any) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {area ? (
        <Textarea value={value ?? ""} onChange={(e: any) => onChange(e.target.value)} className={inputCls} />
      ) : (
        <Input value={value ?? ""} onChange={(e: any) => onChange(e.target.value)} className={inputCls} />
      )}
    </div>
  );
}

export default function SiteEditor() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [data, setData] = useState<any | null>(null);
  const [section, setSection] = useState("hero");
  const [saved, setSaved] = useState(false);

  const contentQuery = trpc.site.get.useQuery(undefined, { enabled: isAdmin });
  const saveMut = trpc.site.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      utils.site.get.invalidate();
    },
    onError: (e) => alert(e.message),
  });

  useEffect(() => {
    if (contentQuery.data !== undefined) {
      const base = fullDefault();
      if (contentQuery.data && Object.keys(contentQuery.data).length) {
        // merge: сохранённое в БД поверх дефолта
        const merged = { ...base, ...contentQuery.data };
        merged.hero = { ...base.hero, ...(contentQuery.data as any).hero };
        merged.about = { ...base.about, ...(contentQuery.data as any).about };
        merged.servicesHeader = { ...base.servicesHeader, ...(contentQuery.data as any).servicesHeader };
        merged.itHeader = { ...base.itHeader, ...(contentQuery.data as any).itHeader };
        merged.projectsHeader = { ...base.projectsHeader, ...(contentQuery.data as any).projectsHeader };
        merged.contacts = { ...base.contacts, ...(contentQuery.data as any).contacts };
        setData(merged);
      } else {
        setData(base);
      }
    }
  }, [contentQuery.data]);

  if (!isAdmin) {
    return (
      <PortalLayout title="Управление сайтом">
        <div className="text-slate-400">Раздел доступен только администратору.</div>
      </PortalLayout>
    );
  }

  if (!data) {
    return (
      <PortalLayout title="Управление сайтом">
        <div className="text-slate-500">Загрузка…</div>
      </PortalLayout>
    );
  }

  const upd = (path: string[], value: any) => {
    setData((d: any) => {
      const copy = JSON.parse(JSON.stringify(d));
      let node = copy;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = value;
      return copy;
    });
  };

  const listEditor = (
    listKey: "services" | "it" | "projects",
    hasItems: boolean,
    hasBadge = false,
  ) => {
    const list = data[listKey] ?? [];
    const setItem = (idx: number, field: string, value: any) =>
      upd([listKey], list.map((it: any, i: number) => (i === idx ? { ...it, [field]: value } : it)));
    return (
      <div className="space-y-4">
        {list.map((it: any, idx: number) => (
          <div key={idx} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">#{idx + 1}</span>
              <button
                onClick={() => {
                  if (confirm("Удалить элемент?"))
                    upd([listKey], list.filter((_: any, i: number) => i !== idx));
                }}
                className="text-slate-500 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {hasBadge && (
                <Field label="Бейдж" value={it.badge} onChange={(v: string) => setItem(idx, "badge", v)} />
              )}
              <Field label="Иконка (FontAwesome, напр. fa-bolt)" value={it.icon} onChange={(v: string) => setItem(idx, "icon", v)} />
              <Field label="Название" value={it.title} onChange={(v: string) => setItem(idx, "title", v)} />
            </div>
            <Field label="Описание" area value={it.desc} onChange={(v: string) => setItem(idx, "desc", v)} />
            {hasItems && (
              <Field
                label="Пункты (каждый с новой строки)"
                area
                value={(it.items ?? []).join("\n")}
                onChange={(v: string) => setItem(idx, "items", v.split("\n").map((s) => s.trim()).filter(Boolean))}
              />
            )}
          </div>
        ))}
        <Button
          variant="outline"
          className="border-slate-600 text-slate-300"
          onClick={() =>
            upd([listKey], [
              ...list,
              hasItems
                ? { icon: "fa-bolt", title: "Новый элемент", desc: "", items: [] }
                : { icon: "fa-bolt", title: "Новый элемент", desc: "" },
            ])
          }
        >
          <Plus size={14} className="mr-1" /> Добавить
        </Button>
      </div>
    );
  };

  return (
    <PortalLayout title="Управление сайтом">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-4 py-2 rounded-md text-xs transition-colors ${
              section === s.id ? "bg-[#991b1b] text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            className="border-slate-600 text-slate-300"
            onClick={() => {
              if (confirm("Вернуть все тексты к исходным значениям? Текущие правки будут стёрты."))
                setData(fullDefault());
            }}
          >
            <RotateCcw size={14} className="mr-1" /> К исходным
          </Button>
          <Button
            onClick={() => saveMut.mutate({ json: JSON.stringify(data) })}
            disabled={saveMut.isPending}
            className="bg-[#991b1b] hover:bg-[#b91c1c] text-white"
          >
            <Save size={14} className="mr-1" />
            {saveMut.isPending ? "Сохранение…" : saved ? "Сохранено ✓" : "Сохранить и опубликовать"}
          </Button>
        </div>
      </div>

      <div className="bg-[#1e293b] border border-slate-700/50 rounded-lg p-5 space-y-4 max-w-4xl">
        {section === "hero" && (
          <>
            <Field label="Лейбл над заголовком" value={data.hero.label} onChange={(v: string) => upd(["hero", "label"], v)} />
            <Field label="Заголовок (HTML, <br> для переноса)" area value={data.hero.title} onChange={(v: string) => upd(["hero", "title"], v)} />
            <Field label="Описание" area value={data.hero.desc} onChange={(v: string) => upd(["hero", "desc"], v)} />
            <div className="text-xs uppercase tracking-wider text-slate-500 pt-2">Статистика</div>
            <div className="grid md:grid-cols-2 gap-3">
              {data.hero.stats.map((s: any, i: number) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Field label={`Число ${i + 1}`} value={s.num} onChange={(v: string) => upd(["hero", "stats"], data.hero.stats.map((x: any, j: number) => (j === i ? { ...x, num: v } : x)))} />
                  <Field label={`Подпись ${i + 1}`} value={s.label} onChange={(v: string) => upd(["hero", "stats"], data.hero.stats.map((x: any, j: number) => (j === i ? { ...x, label: v } : x)))} />
                </div>
              ))}
            </div>
          </>
        )}

        {section === "about" && (
          <>
            <Field label="Заголовок" value={data.about.title} onChange={(v: string) => upd(["about", "title"], v)} />
            <Field label="Абзац 1" area value={data.about.text1} onChange={(v: string) => upd(["about", "text1"], v)} />
            <Field label="Абзац 2" area value={data.about.text2} onChange={(v: string) => upd(["about", "text2"], v)} />
            <div className="text-xs uppercase tracking-wider text-slate-500 pt-2">Преимущества</div>
            <div className="grid md:grid-cols-2 gap-3">
              {data.about.features.map((f: string, i: number) => (
                <Field
                  key={i}
                  label={`Преимущество ${i + 1}`}
                  value={f}
                  onChange={(v: string) => upd(["about", "features"], data.about.features.map((x: string, j: number) => (j === i ? v : x)))}
                />
              ))}
            </div>
          </>
        )}

        {section === "services" && (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Лейбл" value={data.servicesHeader.label} onChange={(v: string) => upd(["servicesHeader", "label"], v)} />
              <Field label="Заголовок" value={data.servicesHeader.title} onChange={(v: string) => upd(["servicesHeader", "title"], v)} />
              <Field label="Описание" value={data.servicesHeader.desc} onChange={(v: string) => upd(["servicesHeader", "desc"], v)} />
            </div>
            <div className="text-xs uppercase tracking-wider text-slate-500 pt-2">Карточки услуг</div>
            {listEditor("services", true)}
          </>
        )}

        {section === "it" && (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Лейбл" value={data.itHeader.label} onChange={(v: string) => upd(["itHeader", "label"], v)} />
              <Field label="Заголовок" value={data.itHeader.title} onChange={(v: string) => upd(["itHeader", "title"], v)} />
              <Field label="Описание" value={data.itHeader.desc} onChange={(v: string) => upd(["itHeader", "desc"], v)} />
            </div>
            <div className="text-xs uppercase tracking-wider text-slate-500 pt-2">Карточки IT-направлений</div>
            {listEditor("it", true, true)}
          </>
        )}

        {section === "projects" && (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Лейбл" value={data.projectsHeader.label} onChange={(v: string) => upd(["projectsHeader", "label"], v)} />
              <Field label="Заголовок" value={data.projectsHeader.title} onChange={(v: string) => upd(["projectsHeader", "title"], v)} />
              <Field label="Описание" value={data.projectsHeader.desc} onChange={(v: string) => upd(["projectsHeader", "desc"], v)} />
            </div>
            <div className="text-xs uppercase tracking-wider text-slate-500 pt-2">Проекты</div>
            {listEditor("projects", false)}
          </>
        )}

        {section === "contacts" && (
          <>
            <Field label="Заголовок CTA" value={data.contacts.ctaTitle} onChange={(v: string) => upd(["contacts", "ctaTitle"], v)} />
            <Field label="Описание CTA" area value={data.contacts.ctaDesc} onChange={(v: string) => upd(["contacts", "ctaDesc"], v)} />
            <Field label="Текст кнопки" value={data.contacts.ctaBtn} onChange={(v: string) => upd(["contacts", "ctaBtn"], v)} />
            <Field label="Адрес и контакты в подвале (HTML, <br> для переноса)" area value={data.contacts.footerAddress} onChange={(v: string) => upd(["contacts", "footerAddress"], v)} />
          </>
        )}
      </div>

      <div className="mt-4 text-xs text-slate-500 max-w-4xl">
        После нажатия «Сохранить и опубликовать» изменения сразу видны всем посетителям сайта —
        страница берёт тексты из базы данных. Кнопка «К исходным» возвращает шаблонные тексты (нужно сохранить).
      </div>
    </PortalLayout>
  );
}
