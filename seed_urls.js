// seed_urls.js — Список проверенных URL AnimeOn и утилиты форматирования

const DEFAULT_TARGET_PATHS = [
  "/",
  "/catalog",
  "/schedule",
  "/collections",
  "/news",
  "/together",
  "/leaderboard",
  "/catalog/genre/ekshen",
  "/catalog/genre/komediya",
  "/catalog/genre/fentezi",
  "/catalog/genre/priklyucheniya",
  "/catalog/genre/fantastika",
  "/catalog/genre/drama",
  "/catalog/genre/romantika",
  "/catalog/genre/sverhestestvennoe",
  "/catalog/genre/tayna",
  "/catalog/genre/povsednevnost",
  "/catalog/genre/sport",
  "/catalog/genre/triller",
  "/catalog/genre/uzhasy",
  "/catalog/genre/syonen",
  "/catalog/genre/syodze",
  "/catalog/genre/seynen",
  "/anime/van-pis-21",
  "/anime/naruto-20",
  "/anime/ataka-titanov-16498",
  "/anime/magicheskaya-bitva-40748",
  "/anime/klinok-rassekayuschiy-demonov-38000",
  "/anime/chelovek-benzopila-reze-57555",
  "/anime/tetrad-smerti-1535",
  "/anime/provozhayuschaya-v-posledniy-put-friren-52991",
  "/anime/provozhayuschaya-v-posledniy-put-friren-2-59978",
  "/anime/reinkarnaciya-bezrabotnogo-istoriya-o-priklyucheniyah-v-drugom-mire-3-59193",
  "/anime/o-moem-pererozhdenii-v-sliz-4-59970",
  "/anime/vrata-shteyna-9253",
  "/anime/stalnoy-alhimik-bratstvo-5114",
  "/anime/tokiyskiy-gul-22319",
  "/anime/re-zero-zhizn-s-nulya-v-alternativnom-mire-31240",
  "/anime/re-zero-zhizn-s-nulya-v-alternativnom-mire-4-61316",
  "/anime/mastera-mecha-onlayn-11757",
  "/anime/ohotnik-h-ohotnik-2011-11061",
  "/anime/bezdomnyy-bog-20507",
  "/anime/vanpanchmen-30276",
  "/anime/monolog-farmacevta-3-61987",
  "/anime/rebenok-idola-3-60058",
  "/anime/adskiy-ray-2-55825",
  "/anime/chernyy-klever-2-61967",
  "/anime/gintama-final-39486",
  "/anime/kiberpank-beguschie-po-krayu-2-61990",
  "/anime/neveroyatnoe-priklyuchenie-dzhodzho-gonka-stalnoy-shar-61469",
  "/anime/net-igry-net-zhizni-19815",
  "/anime/ubiyca-akame-22199",
  "/anime/parazit-uchenie-o-zhizni-22535",
  "/anime/dobro-pozhalovat-v-klass-prevoshodstva-4-vtoroy-god-pervyy-semestr-59708",
  "/anime/gorod-v-kotorom-menya-net-31043",
  "/anime/etot-zamechatelnyy-mir-30831",
  "/anime/11-glaz-13419",
  "/anime/7-semyan-38735",
  "/anime/12-let-bienie-malenkogo-serdca-2-33419",
  "/anime/doktor-stoun-nauchnoe-buduschee-chast-3-62568",
  "/anime/boevoy-kontinent-2-neprevzoydennyy-klan-tan-51836",
  "/anime/bezuprechnyy-mir-47405",
  "/anime/raskolotaya-bitvoy-sineva-nebes-5-51039",
  "/anime/puteshestvie-k-bessmertiyu-5-63240",
  "/anime/protivostoyanie-svyatogo-55809",
  "/anime/povelitel-besstrashnogo-duha-41409",
  "/anime/okutyvaya-nebesa-51289",
  "/anime/skazanie-o-pastuhe-bogov-59953",
  "/anime/praktikuya-ci-sto-tysyach-let-54437",
  "/anime/ataka-titanov-2-25777",
  "/anime/ataka-titanov-3-chast-2-38524",
  "/anime/forma-golosa-28851",
  "/anime/tvoe-imya-32281",
  "/anime/unesennye-prizrakami-199",
  "/anime/plamennaya-brigada-pozharnyh-tretya-glava-chast-2-59229",
  "/anime/tokiyskie-mstiteli-bitva-treh-nebozhiteley-59088",
  "/anime/atele-koldovskih-kolpakov-51553",
  "/anime/mech-i-zhezl-vistorii-2-59983",
  "/anime/o-moem-pererozhdenii-v-mech-2-53913",
  "/anime/pererozhdenie-v-aristokrata-so-sposobnostyu-analiza-3-60601",
  "/anime/voennaya-hronika-romelii-59787",
  "/anime/ledyanaya-stena-2-64534",
  "/anime/ty-i-ya-polnye-protivopolozhnosti-60371",
  "/anime/dazhe-u-studsoveta-est-kosyaki-61578",
  "/anime/istoriya-o-perekure-za-supermarketom-62076",
  "/anime/svadba-svetlyachkov-63293",
  "/anime/tabakoshka-63403",
  "/anime/detektiv-konan-235",
  "/anime/gintama-4-28977",
  "/anime/mechty-letnih-dney-9874",
  "/anime/magicheskiy-issledovatel-56733",
  "/anime/mastera-na-vse-ruki-vygnali-iz-otryada-geroev-61128",
  "/anime/osvobodite-etu-vedmu-62927",
  "/anime/prigovorennyy-byt-geroem-tyuremnye-zapisi-devyat-tysyach-chetvertogo-shtrafnogo-otryada-geroev-56009",
  "/anime/ya-ochnulsya-buduchi-pilotom-silneyshego-kosmicheskogo-korablya-a-potomu-reshil-stat-mezhgalakticheskim-naemnikom-60948",
  "/anime/ya-perevoplotilsya-v-goblina-voprosy-est-63712",
  "/anime/ya-podruzhilsya-so-vtoroy-samoy-simpatichnoy-devushkoy-v-klasse-56734",
  "/anime/ya-vedma-kotoruyu-vozlyublennyy-poprosil-sozdat-lyubovnoe-zele-63409"
];

// Преобразование пути в красивое читаемое название
function formatTitleFromPath(path) {
  if (!path || path === '/') return 'Главная страница';
  if (path === '/catalog') return 'Каталог аниме';
  if (path === '/schedule') return 'Расписание онгоингов';
  if (path === '/collections') return 'Коллекции';
  if (path === '/leaderboard') return 'Таблица лидеров';
  if (path === '/news') return 'Новости';
  if (path === '/together') return 'Совместный просмотр';

  if (path.startsWith('/catalog/genre/')) {
    const genre = path.replace('/catalog/genre/', '').replace(/\/$/, '');
    return `Жанр: ${genre.charAt(0).toUpperCase() + genre.slice(1)}`;
  }

  if (path.startsWith('/anime/')) {
    const raw = path.replace('/anime/', '').replace(/\/$/, '');
    // Удаляем ID в конце
    const cleanSlug = raw.replace(/-\d+$/, '').replace(/-[a-zA-Z0-9]{5,}$/, '');

    // Таблица транслитерации для аккуратных названий
    const subs = [
      ['sch', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'],
      ['ts', 'ц'], ['yu', 'ю'], ['ya', 'я'], ['yo', 'ё'],
      ['ye', 'е'], ['kh', 'х'], ['iy', 'ий'], ['yy', 'ый'],
      ['ey', 'ей'], ['oy', 'ой'], ['ay', 'ай'], ['uy', 'уй'],
      ['a', 'а'], ['b', 'б'], ['v', 'в'], ['g', 'г'], ['d', 'д'],
      ['e', 'е'], ['z', 'з'], ['i', 'и'], ['y', 'ы'], ['k', 'к'],
      ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'],
      ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'], ['f', 'ф'],
      ['h', 'х'], ['c', 'к']
    ];

    const words = cleanSlug.split('-');
    const ruWords = words.map(w => {
      let res = w.toLowerCase();
      for (const [eng, ru] of subs) {
        res = res.replaceAll(eng, ru);
      }
      return res.charAt(0).toUpperCase() + res.slice(1);
    });

    return ruWords.join(' ');
  }

  return path;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_TARGET_PATHS, formatTitleFromPath };
}
