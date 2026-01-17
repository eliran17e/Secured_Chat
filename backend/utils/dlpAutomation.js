const fs = require('fs');

// Build a normalized set of sensitive terms from recipeEmbeddings.json and static list
let sensitiveTerms = null;
let goodTerms = null;

function normalizeToken(token) {
    return String(token || '')
        .toLowerCase()
        .normalize('NFKC')
        .replace(/[\p{P}\p{S}]/gu, ' ') // punctuation/symbols → space
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(text) {
    const norm = normalizeToken(text);
    return norm ? norm.split(' ') : [];
}

function ensureSensitiveTermsLoaded() {
    if (sensitiveTerms) return sensitiveTerms;
    const set = new Set();

    // Static risky terms (extend as needed)
    [
        // Confidentiality / leakage
        'secret', 'confidential', 'proprietary', 'classified', 'restricted',
        'leak', 'leaking', 'leakage', 'disclose', 'breach', 'exfiltrate', 'exfiltration', 'dump', 'sensitive',
        // HE
        'סוד', 'סודי', 'חסוי', 'קנייני', 'מסווג', 'מוגבל', 'דליפה', 'דליפות', 'זליגה', 'חשיפה', 'לחשוף', 'פרצה',
        // ES
        'secreto','confidencial','clasificado','restringido','filtración','fuga','divulgar','divulgación','sensible',
        // FR
        'secret','confidentiel','classifié','restreint','fuite','divulgation','sensible',
        // AR
        'سر','سري','سريّة','تسريب','تسريبات','كشف','اختراق','حسّاس',
        // RU
        'секрет','конфиденциально','секретно','утечка','утечки','раскрытие','взлом','чувствительный',
        // ZH (Simplified)
        '机密','保密','绝密','受限','泄露','泄漏','外泄','披露','敏感','漏洞',

        // Malicious intent (EN)
        'steal', 'theft', 'hack', 'hacking', 'exploit', 'bypass', 'backdoor', 'ransom', 'ransomware',

        // Malicious intent (HE)
        'גניבה', 'לגנוב', 'שוד', 'פריצה', 'לפרוץ', 'האקר', 'האק', 'לעקוף', 'עקיפה', 'דלת אחורית', 'כופרה',
        'לשאוב', 'שאיבה', 'מידע סודי', 'מידע רגיש',
        // Malicious intent (ES)
        'robar','robo','hack','hacker','piratear','explotar','bypass','puerta trasera','ransomware',
        // Malicious intent (FR)
        'vol','voler','pirater','piratage','exploit','contourner','porte dérobée','rançongiciel',
        // Malicious intent (AR)
        'سرقة','اسرق','اختراق','هاكر','استغلال','تجاوز','باب خلفي','برمجية فدية',
        // Malicious intent (RU)
        'кража','украсть','взлом','хакер','эксплойт','обход','бекдор','вымогатель',
        // Malicious intent (ZH)
        '盗取','窃取','黑客','入侵','攻击','利用','绕过','后门','勒索软件',

        // Credentials and auth (trimmed to most common)
        'password', 'token', 'api_key', 'apikey', 'secret_key', 'client_secret', 'privatekey', 'ssh', 'rsa',
        // HE
        'סיסמה', 'סיסמא', 'טוקן', 'מפתח', 'מפתח סודי', 'מפתח api', 'סוד לקוח', 'מפתח פרטי', 'אימות', 'כניסה',
        // ES
        'contraseña','token','clave','llave','llave privada','secreto','api','api_key','secreto del cliente','autenticación',
        // FR
        'motdepasse','mot de passe','jeton','clé','clé privée','secret client','api','authentification',
        // AR
        'كلمة المرور','رمز','مفتاح','مفتاح خاص','سر العميل','api','مصادقة',
        // RU
        'пароль','токен','ключ','секретный ключ','приватный ключ','секрет клиента','api','аутентификация',
        // ZH
        '密码','口令','令牌','访问令牌','密钥','秘钥','私钥','客户端密钥','认证','身份验证','api',

        // Personal/financial info (trimmed)
        'ssn', 'passport', 'credit', 'card', 'cvv', 'iban', 'swift', 'email', 'phone',
        // HE
        'מספר זהות', 'תעודת זהות', 'דרכון', 'אשראי', 'כרטיס אשראי', 'מספר כרטיס', 'סי וי וי', 'cvv', 'חשבון בנק',
        'iban', 'swift', 'מספר חשבון', 'מספר בנק', 'מספר ניתוב', 'מס זיהוי', 'תאריך לידה', 'דוא"ל', 'אימייל', 'טלפון', 'כתובת',
        // ES
        'dni','pasaporte','crédito','tarjeta','cvv','iban','swift','correo','email','teléfono','dirección',
        // FR
        'cin','passeport','crédit','carte','cvv','iban','swift','courriel','email','téléphone','adresse',
        // AR
        'رقم الهوية','جواز السفر','ائتمان','بطاقة','سي في في','iban','swift','بريد','هاتف','عنوان',
        // RU
        'паспорт','кредит','карта','cvv','iban','swift','почта','электронная почта','телефон','адрес',
        // ZH
        '身份证','护照','信用卡','卡号','安全码','邮箱','电子邮件','电话','地址','银行账号','账户',

        // Source code/config (trimmed)
        '.env', 'dotenv', 'pem', 'vault', 'secrets',

        // Domain-specific (recipes)
        'recipe', 'ingredients', 'formula', 'gorgonzola', 'mozzarella', 'parmesan', 'tomato', 'sauce', 'dough',
    ].forEach(t => set.add(normalizeToken(t)));

    // From recipeEmbeddings.json → include recipe names and ingredient tokens
    try {
        const raw = fs.readFileSync('recipeEmbeddings.json', 'utf8');
        const items = JSON.parse(raw);
        for (const it of items) {
            if (it?.name) tokenize(it.name).forEach(tok => set.add(tok));
            if (Array.isArray(it?.ingredients)) {
                for (const ing of it.ingredients) tokenize(ing).forEach(tok => set.add(tok));
            }
        }
    } catch {}

    sensitiveTerms = set;
    return sensitiveTerms;
}

function ensureGoodTermsLoaded() {
    if (goodTerms) return goodTerms;
    // Common benign chat terms; extend over time
    const list = [
        'hi','hello','hey','yo','thanks','thank','please','sorry','ok','okay','cool','great','nice','good','bad',
        'yes','no','maybe','sure','fine','done','later','bye','goodbye','welcome','cheers','congrats','well',
        'morning','evening','night','today','tomorrow','yesterday','soon','now','later','minute','second','hour',
        'how','are','you','doing','what','when','where','why','who','which','because',
        'see','you','soon','lol','haha','brb','gtg','idk','imo','imho','pls','thx','np',
        // HE common chat
        'שלום','היי','הי','תודה','בבקשה','מצוין','מעולה','אחלה','סבבה','כן','לא','אולי','ברור','בסדר',
        'ביי','להתראות','בוקר','בוקר טוב','ערב טוב','לילה טוב','היום','מחר','אתמול','עכשיו','אחר כך','מיד',
        'שניה','שנייה','דקה','שעה','מה','מתי','איפה','למה','מי','איך','איזה','בגלל',
        'נתראה','בקרוב','חח','חחח','לול','תכף','עוד מעט'
    ];
    goodTerms = new Set(list.map(normalizeToken));
    return goodTerms;
}

// Prefilter: returns { action: 'allow'|'check'|'block', matches: string[] }
function prefilterMessage(message, matchesThreshold = 1) {
    const text = String(message || '');
    const tokens = tokenize(text);
    if (tokens.length === 0) return { action: 'allow', matches: [] };

    const terms = ensureSensitiveTermsLoaded();
    const goods = ensureGoodTermsLoaded();
    const matches = [];
    const significant = [];
    for (const tok of tokens) {
        if (tok.length <= 2) continue; // skip very short tokens
        significant.push(tok);
        if (terms.has(tok)) matches.push(tok);
    }

    // Strict allow: only if all meaningful tokens are in the good whitelist and no sensitive matches
    const allGood = significant.length > 0 && significant.every(t => goods.has(t));
    if (allGood && matches.length === 0) return { action: 'allow', matches };

    if (matches.length >= matchesThreshold) return { action: 'block', matches };

    // No sensitive matches and not all-good → conservative: check
    return { action: 'check', matches };
}

module.exports = { prefilterMessage, ensureSensitiveTermsLoaded };


